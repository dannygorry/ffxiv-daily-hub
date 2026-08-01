import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveItemCatalog } from "@/lib/ffxiv/item-catalog"
import { DEFAULT_MIN_VELOCITY, scanWorld, type ItemMarketStat } from "@/lib/ffxiv/market-scan"
import { WORLDS, DATA_CENTERS } from "@/lib/ffxiv/xivapi"

// A full scan is ~16,800 items in batches of 100 at concurrency 8 (see universalis.ts) —
// measured live at ~50-90s depending on network variance, so 60s is not enough headroom.
export const maxDuration = 150

const CACHE_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

function dataCenterOf(world: string): string {
  for (const [dc, worlds] of Object.entries(DATA_CENTERS)) {
    if (worlds.includes(world)) return dc
  }
  return ""
}

type ScanRow = {
  world: string
  data_center: string
  scanned_at: string
  min_velocity_threshold: number
  best_sellers: ItemMarketStat[]
  most_valuable: ItemMarketStat[]
}

async function enrich(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stats: ItemMarketStat[]
) {
  const catalog = await resolveItemCatalog(supabase, stats.map((s) => s.itemId))
  return stats.map((s, i) => ({
    ...s,
    rank: i + 1,
    name: catalog.get(s.itemId)?.name ?? `Item #${s.itemId}`,
    iconUrl: catalog.get(s.itemId)?.iconUrl ?? null,
  }))
}

async function runScanAndUpsert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  world: string,
  minVelocity: number
) {
  const result = await scanWorld(world, { minVelocity })
  await supabase.from("marketplace_scans").upsert(
    {
      world,
      data_center: dataCenterOf(world),
      scanned_at: new Date().toISOString(),
      scan_duration_ms: result.scanDurationMs,
      items_scanned: result.itemsScanned,
      items_failed: result.itemsFailed,
      min_velocity_threshold: result.minVelocityThreshold,
      best_sellers: result.bestSellers,
      most_valuable: result.mostValuable,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "world" }
  )
  return result
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const world = req.nextUrl.searchParams.get("world")
  if (!world || !WORLDS.includes(world)) {
    return NextResponse.json({ error: "Invalid or missing world" }, { status: 400 })
  }
  const minVelocityParam = req.nextUrl.searchParams.get("minVelocity")
  const minVelocity = minVelocityParam ? Number(minVelocityParam) : DEFAULT_MIN_VELOCITY

  const { data: cached } = await supabase
    .from("marketplace_scans")
    .select("world, data_center, scanned_at, min_velocity_threshold, best_sellers, most_valuable")
    .eq("world", world)
    .maybeSingle<ScanRow>()

  const nonDefaultThreshold = minVelocity !== DEFAULT_MIN_VELOCITY

  // v1 only serves the default threshold from cache; a non-default threshold
  // always forces a fresh scan since only the top-N per default threshold is cached.
  if (!cached || nonDefaultThreshold) {
    try {
      const result = await runScanAndUpsert(supabase, world, minVelocity)
      return NextResponse.json({
        world,
        dataCenter: dataCenterOf(world),
        scannedAt: new Date().toISOString(),
        stale: false,
        refreshing: false,
        minVelocityThreshold: result.minVelocityThreshold,
        bestSellers: await enrich(supabase, result.bestSellers),
        mostValuable: await enrich(supabase, result.mostValuable),
      })
    } catch (err) {
      console.error("[marketplace leaderboard GET] scan failed:", err)
      return NextResponse.json({ error: "Failed to scan marketplace data" }, { status: 502 })
    }
  }

  const scannedAt = new Date(cached.scanned_at).getTime()
  const stale = Date.now() - scannedAt > CACHE_TTL_MS

  if (stale) {
    after(async () => {
      try {
        await runScanAndUpsert(supabase, world, cached.min_velocity_threshold)
      } catch (err) {
        console.error("[marketplace leaderboard] background rescan failed:", err)
      }
    })
  }

  return NextResponse.json({
    world: cached.world,
    dataCenter: cached.data_center,
    scannedAt: cached.scanned_at,
    stale,
    refreshing: stale,
    minVelocityThreshold: cached.min_velocity_threshold,
    bestSellers: await enrich(supabase, cached.best_sellers),
    mostValuable: await enrich(supabase, cached.most_valuable),
  })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const world = req.nextUrl.searchParams.get("world")
  if (!world || !WORLDS.includes(world)) {
    return NextResponse.json({ error: "Invalid or missing world" }, { status: 400 })
  }

  try {
    const result = await runScanAndUpsert(supabase, world, DEFAULT_MIN_VELOCITY)
    return NextResponse.json({
      world,
      dataCenter: dataCenterOf(world),
      scannedAt: new Date().toISOString(),
      stale: false,
      refreshing: false,
      minVelocityThreshold: result.minVelocityThreshold,
      bestSellers: await enrich(supabase, result.bestSellers),
      mostValuable: await enrich(supabase, result.mostValuable),
    })
  } catch (err) {
    console.error("[marketplace leaderboard PUT] scan failed:", err)
    return NextResponse.json({ error: "Failed to scan marketplace data" }, { status: 502 })
  }
}
