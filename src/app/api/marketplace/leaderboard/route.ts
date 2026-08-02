import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { resolveItemCatalog } from "@/lib/ffxiv/item-catalog"
import { scanWorld, type ItemMarketStat, type ScanResult } from "@/lib/ffxiv/market-scan"
import type {
  ArbitrageOpportunity,
  CraftOpportunity,
  SupplyGapOpportunity,
} from "@/lib/ffxiv/opportunities"
import type { TaxRates } from "@/lib/ffxiv/universalis"
import { fetchWorldTopology } from "@/lib/ffxiv/universalis"
import { WORLDS, DATA_CENTERS } from "@/lib/ffxiv/xivapi"

// Stage 1 (~50-90s) + stage 2 (~10-20s) puts a cold scan near two minutes.
// Only the first scan of a world ever pays it; everything after is served from
// cache while a refresh runs in the background.
export const maxDuration = 300

// Universalis's aggregated stats are a rolling 4-day average, so refreshing
// much more often has diminishing returns.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000
// Must match the defaults in acquire_marketplace_lease (migration 015).
const MANUAL_COOLDOWN_MS = 15 * 60 * 1000

function dataCenterOf(world: string): string {
  for (const [dc, worlds] of Object.entries(DATA_CENTERS)) {
    if (worlds.includes(world)) return dc
  }
  return ""
}

/** Versioned JSONB envelope. A missing or older `v` means "treat as stale". */
interface VersionedPayload<T> {
  v: number
  items: T[]
}

function readPayload<T>(raw: unknown): T[] {
  if (!raw || typeof raw !== "object") return []
  const p = raw as Partial<VersionedPayload<T>>
  if (p.v !== 1 || !Array.isArray(p.items)) return []
  return p.items
}

function wrap<T>(items: T[]): VersionedPayload<T> {
  return { v: 1, items }
}

type ScanRow = {
  world: string
  data_center: string
  scanned_at: string
  scan_completed_at: string | null
  min_velocity_threshold: number
  best_sellers: ItemMarketStat[]
  most_valuable: ItemMarketStat[]
  supply_gaps: unknown
  arbitrage: unknown
  crafting_profits: unknown
  tax_rates: TaxRates | null
  shortlist_size: number | null
  refresh_started_at: string | null
  refresh_error: string | null
  last_manual_refresh_at: string | null
}

const SCAN_COLUMNS =
  "world, data_center, scanned_at, scan_completed_at, min_velocity_threshold, " +
  "best_sellers, most_valuable, supply_gaps, arbitrage, crafting_profits, " +
  "tax_rates, shortlist_size, refresh_started_at, refresh_error, last_manual_refresh_at"

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

type Named = { itemId: number }

/**
 * Resolves names and icons once for every row across all four tabs, so a scan
 * makes one catalogue pass rather than four.
 */
async function buildNameLookup(...groups: Named[][]) {
  const ids = groups.flat().map((r) => r.itemId)
  const catalog = await resolveItemCatalog(ids)
  return (itemId: number) => ({
    name: catalog.get(itemId)?.name ?? `Item #${itemId}`,
    iconUrl: catalog.get(itemId)?.iconUrl ?? null,
  })
}

function withRank<T extends Named>(rows: T[], lookup: (id: number) => { name: string; iconUrl: string | null }) {
  return rows.map((r, i) => ({ ...r, rank: i + 1, ...lookup(r.itemId) }))
}

// ---------------------------------------------------------------------------
// Lease + terminal writes (spec §6)
// ---------------------------------------------------------------------------

type ServiceClient = ReturnType<typeof createServiceClient>

async function acquireLease(
  supabase: ServiceClient,
  world: string,
  manual: boolean
): Promise<string | null> {
  const token = randomUUID()
  const { data, error } = await supabase.rpc("acquire_marketplace_lease", {
    p_world: world,
    p_data_center: dataCenterOf(world),
    p_token: token,
    p_manual: manual,
  })
  if (error) {
    console.error("[marketplace] lease acquire failed:", error.message)
    return null
  }
  return data === true ? token : null
}

/**
 * Success write. Refreshes the shipped scanner columns as well as the new
 * opportunity ones — dropping them would silently freeze the Best Sellers and
 * Most Valuable tabs at whatever they last held.
 */
async function writeSuccess(
  supabase: ServiceClient,
  world: string,
  token: string,
  result: ScanResult
): Promise<number> {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("marketplace_scans")
    .update({
      // shipped scanner outputs (migration 014)
      best_sellers: result.bestSellers,
      most_valuable: result.mostValuable,
      items_scanned: result.itemsScanned,
      items_failed: result.itemsFailed,
      scan_duration_ms: result.scanDurationMs,
      min_velocity_threshold: result.minVelocityThreshold,
      scanned_at: nowIso,
      updated_at: nowIso,
      // opportunity outputs (migration 015)
      supply_gaps: wrap(result.supplyGaps),
      arbitrage: wrap(result.arbitrage),
      tax_rates: result.taxRates,
      shortlist_size: result.shortlistSize,
      // crafting (migration 016)
      crafting_profits: wrap(result.craftingProfits),
      // state
      scan_completed_at: nowIso,
      refresh_error: null,
      refresh_started_at: null,
      refresh_lease_token: null,
    })
    .eq("world", world)
    .eq("refresh_lease_token", token)
    .select("world")

  if (error) {
    console.error("[marketplace] success write failed:", error.message)
    return 0
  }
  return data?.length ?? 0
}

/**
 * Failure write. Covers both failure outcomes with one statement by never
 * touching scan_completed_at or any payload column: a cold row's stays NULL,
 * and a previously-completed row keeps its timestamp and its last good results.
 */
async function writeFailure(
  supabase: ServiceClient,
  world: string,
  token: string,
  message: string
): Promise<void> {
  const { error } = await supabase
    .from("marketplace_scans")
    .update({
      refresh_error: message,
      updated_at: new Date().toISOString(),
      refresh_started_at: null,
      refresh_lease_token: null,
    })
    .eq("world", world)
    .eq("refresh_lease_token", token)

  if (error) console.error("[marketplace] failure write failed:", error.message)
}

/**
 * Runs a scan under an already-acquired lease and writes exactly one terminal
 * result.
 *
 * `terminalWriteDone` is what stops the `finally` stamping an error onto a
 * scan that actually succeeded. It is set even when the success write affects
 * zero rows: that means the lease expired and a newer scan took over, so these
 * results are stale and must be discarded — writing an error would be just as
 * wrong as writing the data.
 */
async function runScanUnderLease(
  supabase: ServiceClient,
  world: string,
  token: string
): Promise<ScanResult | null> {
  let terminalWriteDone = false
  let errorMessage = "scan failed"
  try {
    const result = await scanWorld(world)
    const rowCount = await writeSuccess(supabase, world, token, result)
    terminalWriteDone = true
    if (rowCount === 0) {
      console.warn(`[marketplace] lease lost mid-scan for ${world}; discarding results`)
      return null
    }
    return result
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[marketplace] scan failed for ${world}:`, err)
    return null
  } finally {
    if (!terminalWriteDone) await writeFailure(supabase, world, token, errorMessage)
  }
}

// ---------------------------------------------------------------------------
// Response shaping (spec §10.1)
// ---------------------------------------------------------------------------

type Status = "initializing" | "refreshing" | "ready" | "failed"

interface ResponseOpts {
  throttled?: boolean
  nextRefreshAt?: string | null
  refreshing?: boolean
}

async function shapeResponse(row: ScanRow, opts: ResponseOpts = {}) {
  const completed = row.scan_completed_at
  const hasError = Boolean(row.refresh_error)

  let status: Status
  if (!completed) {
    // Never finished a scan. `failed` only if we know why; otherwise a scan is
    // either running now or about to be — never "ready and empty".
    status = hasError ? "failed" : "initializing"
  } else if (opts.refreshing) {
    status = "refreshing"
  } else {
    status = "ready"
  }

  const bestSellers = row.best_sellers ?? []
  const mostValuable = row.most_valuable ?? []
  const supplyGaps = readPayload<SupplyGapOpportunity>(row.supply_gaps)
  const arbitrage = readPayload<ArbitrageOpportunity>(row.arbitrage)
  const crafting = readPayload<CraftOpportunity>(row.crafting_profits)

  // `failed` has no usable payload by definition — don't ship empty arrays that
  // could read as "we looked and found nothing".
  const payloadless = status === "failed"
  const lookup = payloadless
    ? () => ({ name: "", iconUrl: null })
    : await buildNameLookup(bestSellers, mostValuable, supplyGaps, arbitrage, crafting)

  // Arbitrage rows carry a numeric buyWorldId from the aggregated payload;
  // resolve it here so the client never needs the topology.
  let worldName: (id: number) => string = (id) => `World ${id}`
  if (!payloadless && arbitrage.length > 0) {
    try {
      const topo = await fetchWorldTopology()
      worldName = (id) => topo.byId.get(id) ?? `World ${id}`
    } catch {
      // Fall through to the numeric label rather than dropping the rows.
    }
  }

  return NextResponse.json({
    world: row.world,
    dataCenter: row.data_center,
    status,
    throttled: opts.throttled ?? false,
    nextRefreshAt: opts.nextRefreshAt ?? null,
    // scan_completed_at is the source of truth for freshness; scanned_at is
    // kept only so the already-shipped client keeps rendering.
    scannedAt: completed,
    refreshError: row.refresh_error,
    refreshing: status === "refreshing",
    minVelocityThreshold: row.min_velocity_threshold,
    taxRates: row.tax_rates ?? {},
    shortlistSize: row.shortlist_size ?? 0,
    bestSellers: payloadless ? [] : withRank(bestSellers, lookup),
    mostValuable: payloadless ? [] : withRank(mostValuable, lookup),
    supplyGaps: payloadless ? [] : withRank(supplyGaps, lookup),
    arbitrage: payloadless
      ? []
      : withRank(arbitrage, lookup).map((r) => ({ ...r, buyWorldName: worldName(r.buyWorldId) })),
    craftingProfits: payloadless ? [] : withRank(crafting, lookup),
    // An empty payload here means the recipe cache has never been warmed, which
    // is a different thing from "no profitable crafts" and reads differently.
    recipesAvailable: crafting.length > 0,
  })
}

async function readRow(supabase: ServiceClient, world: string): Promise<ScanRow | null> {
  const { data, error } = await supabase
    .from("marketplace_scans")
    .select(SCAN_COLUMNS)
    .eq("world", world)
    .maybeSingle<ScanRow>()

  // Log rather than swallow: a missing column here (migration 015 not applied)
  // otherwise looks identical to "this world has never been scanned", and the
  // caller degrades to a generic 503 with no clue why.
  if (error) console.error(`[marketplace] read failed for ${world}:`, error.message)
  return data
}

function validateWorld(req: NextRequest): string | null {
  const world = req.nextUrl.searchParams.get("world")
  return world && WORLDS.includes(world) ? world : null
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ---------------------------------------------------------------------------
// GET — cache-first, background refresh on TTL expiry
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const world = validateWorld(req)
  if (!world) return NextResponse.json({ error: "Invalid or missing world" }, { status: 400 })

  // Reads go through the service client too: RLS still permits authenticated
  // selects, but using one client keeps the row shape and error handling
  // identical between the read and write paths.
  const supabase = createServiceClient()

  // Warm the world topology before any scan so a topology failure surfaces
  // here rather than halfway through a two-minute scan.
  try {
    await fetchWorldTopology()
  } catch (err) {
    console.error("[marketplace] topology fetch failed:", err)
  }

  const row = await readRow(supabase, world)

  // Cold world: nothing cached at all. Take the lease and scan inline — there
  // is nothing to serve in the meantime.
  if (!row || !row.scan_completed_at) {
    const leaseHeld = Boolean(row?.refresh_started_at)
    if (leaseHeld) {
      // Another request is already scanning. Report initializing and let the
      // client poll rather than starting a second two-minute scan.
      return shapeResponse(row as ScanRow)
    }

    const token = await acquireLease(supabase, world, false)
    if (!token) {
      // Lost the race between the read and the acquire.
      const fresh = await readRow(supabase, world)
      return fresh
        ? shapeResponse(fresh)
        : NextResponse.json({ error: "Could not start a scan" }, { status: 503 })
    }

    await runScanUnderLease(supabase, world, token)
    const after_ = await readRow(supabase, world)
    return after_
      ? shapeResponse(after_)
      : NextResponse.json({ error: "Scan produced no row" }, { status: 500 })
  }

  // Warm cache. Serve immediately; refresh in the background if the TTL lapsed.
  const completedAt = new Date(row.scan_completed_at).getTime()
  const stale = Date.now() - completedAt > CACHE_TTL_MS
  let refreshing = Boolean(row.refresh_started_at)

  if (stale && !refreshing) {
    const token = await acquireLease(supabase, world, false)
    if (token) {
      refreshing = true
      after(async () => {
        await runScanUnderLease(supabase, world, token)
      })
    }
  }

  return shapeResponse(row, { refreshing })
}

// ---------------------------------------------------------------------------
// PUT — user-forced refresh, cooldown-limited (spec §6.5)
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const world = validateWorld(req)
  if (!world) return NextResponse.json({ error: "Invalid or missing world" }, { status: 400 })

  const supabase = createServiceClient()

  // The lease acquire also enforces the manual cooldown, atomically. A `false`
  // here means either a scan is already running or the cooldown is live —
  // re-read the row to tell the user which, and when they can retry.
  const token = await acquireLease(supabase, world, true)

  if (!token) {
    const row = await readRow(supabase, world)
    if (!row) return NextResponse.json({ error: "Could not start a scan" }, { status: 503 })

    const lastManual = row.last_manual_refresh_at
      ? new Date(row.last_manual_refresh_at).getTime()
      : null
    const cooldownActive = lastManual != null && Date.now() - lastManual < MANUAL_COOLDOWN_MS
    const nextRefreshAt = cooldownActive
      ? new Date(lastManual + MANUAL_COOLDOWN_MS).toISOString()
      : null

    // Throttled with no usable cache (the first manual scan failed) must read
    // as `failed`, not `ready` — there is genuinely nothing to show.
    return shapeResponse(row, {
      throttled: cooldownActive,
      nextRefreshAt,
      refreshing: !cooldownActive && Boolean(row.refresh_started_at),
    })
  }

  await runScanUnderLease(supabase, world, token)
  const row = await readRow(supabase, world)
  return row
    ? shapeResponse(row)
    : NextResponse.json({ error: "Scan produced no row" }, { status: 500 })
}
