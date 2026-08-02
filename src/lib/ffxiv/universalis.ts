const UNIVERSALIS_BASE = "https://universalis.app/api/v2"
const USER_AGENT = "ffxiv-daily-hub/1.0 (+https://github.com/dannygorry/ffxiv-daily-hub)"

const BATCH_SIZE = 100
// Universalis documents a hard cap of 8 simultaneous connections per IP.
// Measured live against ~16,800 real marketable items (not the ~8,900 originally
// estimated from doc prose): at concurrency 8, a full scan takes ~50-90s depending
// on network variance — see maxDuration in the leaderboard route for how that's handled.
const CONCURRENCY = 8
const MAX_RETRIES = 3

export interface UniversalisPriceStat {
  world?: { price: number }
  dc?: { price: number; worldId?: number }
  // The region scope also names the world selling at that price — this is what
  // makes cross-DC arbitrage possible with no extra requests.
  region?: { price: number; worldId: number }
}

export interface UniversalisVelocityStat {
  world?: { quantity: number }
}

export interface UniversalisQualityBlock {
  minListing?: UniversalisPriceStat
  recentPurchase?: { world?: { price: number; timestamp: number } }
  averageSalePrice?: UniversalisPriceStat
  dailySaleVelocity?: UniversalisVelocityStat
}

export interface UniversalisAggregatedItem {
  itemId: number
  nq: UniversalisQualityBlock
  hq: UniversalisQualityBlock
  worldUploadTimes?: { worldId: number; timestamp: number }[]
}

interface UniversalisAggregatedResponse {
  results: UniversalisAggregatedItem[]
  failedItems: number[]
}

async function universalisFetch(path: string): Promise<Response> {
  return fetch(`${UNIVERSALIS_BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  })
}

export async function fetchMarketableItemIds(): Promise<number[]> {
  const res = await universalisFetch("/marketable")
  if (!res.ok) throw new Error(`Universalis marketable fetch failed: ${res.status}`)
  return res.json()
}

async function fetchAggregatedBatch(world: string, itemIds: number[]): Promise<UniversalisAggregatedResponse> {
  if (itemIds.length === 0) return { results: [], failedItems: [] }
  if (itemIds.length > BATCH_SIZE) throw new Error(`Batch of ${itemIds.length} exceeds Universalis's ${BATCH_SIZE}-item limit`)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await universalisFetch(`/aggregated/${encodeURIComponent(world)}/${itemIds.join(",")}`)
    if (res.ok) return res.json()

    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500))
      continue
    }

    // Any other failure (or exhausted retries): treat the whole batch as failed
    // rather than aborting the scan — a leaderboard missing a few hundred of
    // ~8,900 items is still a perfectly good leaderboard.
    return { results: [], failedItems: itemIds }
  }

  return { results: [], failedItems: itemIds }
}

export async function fetchAllAggregatedStats(
  world: string,
  itemIds: number[]
): Promise<{ items: UniversalisAggregatedItem[]; failedItemIds: number[] }> {
  const batches: number[][] = []
  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    batches.push(itemIds.slice(i, i + BATCH_SIZE))
  }

  const items: UniversalisAggregatedItem[] = []
  const failedItemIds: number[] = []

  let nextBatchIndex = 0
  async function worker() {
    while (true) {
      const batchIndex = nextBatchIndex++
      if (batchIndex >= batches.length) return
      const { results, failedItems } = await fetchAggregatedBatch(world, batches[batchIndex])
      items.push(...results)
      failedItemIds.push(...failedItems)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker()))

  return { items, failedItemIds }
}

// ---------------------------------------------------------------------------
// Stage 2: supply detail (CurrentlyShown)
// ---------------------------------------------------------------------------

/** Per-quality supply snapshot for one item on one world. */
export interface UniversalisSupplyDetail {
  itemId: number
  quality: Quality
  unitsForSale: number
  listingsCount: number
  /** Universalis upload time for this world, in ms since epoch. Drives freshness. */
  lastUploadTime: number | null
}

export type Quality = "nq" | "hq"

// Only the fields we actually use. Keeping this list tight is what holds the
// payload near ~12KB per 100 items even though the endpoint itself is slow.
const SUPPLY_FIELDS = [
  "items.unitsForSale",
  "items.listingsCount",
  "items.lastUploadTime",
].join(",")

interface SupplyItemResponse {
  unitsForSale?: number
  listingsCount?: number
  lastUploadTime?: number
}

async function fetchSupplyBatch(
  world: string,
  itemIds: number[],
  quality: Quality
): Promise<UniversalisSupplyDetail[]> {
  if (itemIds.length === 0) return []
  if (itemIds.length > BATCH_SIZE) {
    throw new Error(`Batch of ${itemIds.length} exceeds Universalis's ${BATCH_SIZE}-item limit`)
  }
  // A single-item request returns a bare object instead of an `items` map, and
  // drops the `items.` field prefix with it. Guard rather than silently mis-parse.
  if (itemIds.length < 2) {
    throw new Error("fetchSupplyBatch requires at least 2 item IDs (single-item responses use a different schema)")
  }

  // NOTE: `listings` is deliberately NOT passed. Setting `listings=0` zeroes out
  // unitsForSale and listingsCount rather than just trimming the response body —
  // the counts are computed over the listings actually loaded. The `fields`
  // filter is what keeps the payload small; omitting `listings` is what keeps
  // the numbers real.
  const query = `?hq=${quality === "hq"}&fields=${encodeURIComponent(SUPPLY_FIELDS)}`
  const path = `/${encodeURIComponent(world)}/${itemIds.join(",")}${query}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await universalisFetch(path)
    if (res.ok) {
      const data: { items?: Record<string, SupplyItemResponse> } = await res.json()
      const out: UniversalisSupplyDetail[] = []
      for (const [rawId, v] of Object.entries(data.items ?? {})) {
        out.push({
          itemId: Number(rawId),
          quality,
          unitsForSale: v.unitsForSale ?? 0,
          listingsCount: v.listingsCount ?? 0,
          lastUploadTime: v.lastUploadTime ?? null,
        })
      }
      return out
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500))
      continue
    }

    // Partial failure is tolerated the same way as stage 1: the shortlist is
    // large enough that losing a batch costs coverage, not correctness.
    return []
  }

  return []
}

/**
 * Fetches per-quality supply for a shortlist of items.
 *
 * Costs two requests per batch (one `hq=true`, one `hq=false`) because the
 * `hq` filter is the only way to split unitsForSale/listingsCount by quality —
 * the stackSizeHistogram variants do not reconcile with the filtered counts.
 * Price and velocity are NOT read here; those come quality-split from stage 1.
 */
export async function fetchSupplyDetail(
  world: string,
  itemIds: number[]
): Promise<{ details: UniversalisSupplyDetail[]; failedItemIds: number[] }> {
  const unique = [...new Set(itemIds)]
  // Fewer than 2 items can't be requested at all — the single-item response
  // uses a different schema. Not worth special-casing for a one-item shortlist.
  if (unique.length < 2) return { details: [], failedItemIds: unique }

  const batches: number[][] = []
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    batches.push(unique.slice(i, i + BATCH_SIZE))
  }
  // A trailing batch of exactly 1 (when the count is BATCH_SIZE*n + 1) would hit
  // the single-item schema. Rebalance by shifting one item back from the
  // previous batch so both end up with ≥2.
  const last = batches[batches.length - 1]
  if (batches.length > 1 && last.length === 1) {
    const prev = batches[batches.length - 2]
    last.unshift(prev.pop() as number)
  }

  // One job per (batch, quality) pair so both qualities share the worker pool
  // and the 8-connection cap covers them together.
  const jobs: { batch: number[]; quality: Quality }[] = []
  for (const batch of batches) {
    jobs.push({ batch, quality: "nq" }, { batch, quality: "hq" })
  }

  const details: UniversalisSupplyDetail[] = []
  const failed = new Set<number>()

  let nextJob = 0
  async function worker() {
    while (true) {
      const i = nextJob++
      if (i >= jobs.length) return
      const { batch, quality } = jobs[i]
      const got = await fetchSupplyBatch(world, batch, quality)
      if (got.length === 0 && batch.length > 0) {
        for (const id of batch) failed.add(id)
      }
      details.push(...got)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, () => worker()))

  return { details, failedItemIds: [...failed] }
}

// ---------------------------------------------------------------------------
// Recent-sale medians (outlier-resistant price check)
// ---------------------------------------------------------------------------

const MEDIAN_ENTRIES = 20

/**
 * Median unit sale price over the most recent sales, per item.
 *
 * Universalis's `averageSalePrice` is a mean, so two freak sales in a twelve-
 * sale window drag it far from reality. Observed on Gilgamesh: Hannish Bed sold
 * twice near 200,000 among ten sales around 14,320, and the mean came back as
 * 199,998 — a ~14x overstatement that clears both the home-listing guard (only
 * 4x over the listing) and the region backstop (only 14x over region).
 *
 * A median is unmoved by a couple of outliers, so it is the cheap sanity check
 * the mean-based guards cannot provide. Only ever run over a retained top-N,
 * which is one request per engine rather than thousands.
 */
export async function fetchRecentSaleMedians(
  world: string,
  itemIds: number[]
): Promise<Map<number, number>> {
  const medians = new Map<number, number>()
  const unique = [...new Set(itemIds)]
  if (unique.length < 2) return medians

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE)
    if (batch.length < 2) break

    // `listings=0` is safe here: it suppresses listing data we don't want and,
    // unlike the supply query, nothing we read is derived from listings.
    const path =
      `/${encodeURIComponent(world)}/${batch.join(",")}` +
      `?listings=0&entries=${MEDIAN_ENTRIES}&fields=${encodeURIComponent("items.recentHistory")}`

    try {
      const res = await universalisFetch(path)
      if (!res.ok) continue
      const data: {
        items?: Record<string, { recentHistory?: { pricePerUnit?: number }[] }>
      } = await res.json()

      for (const [rawId, item] of Object.entries(data.items ?? {})) {
        const prices = (item.recentHistory ?? [])
          .map((h) => h.pricePerUnit)
          .filter((p): p is number => typeof p === "number" && p > 0)
          .sort((a, b) => a - b)
        if (prices.length === 0) continue
        const mid = Math.floor(prices.length / 2)
        medians.set(
          Number(rawId),
          prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
        )
      }
    } catch {
      // Missing medians simply mean the check is skipped for those rows.
    }
  }

  return medians
}

// ---------------------------------------------------------------------------
// Tax rates
// ---------------------------------------------------------------------------

/** City name -> market board tax percentage (3 or 5 at time of writing). */
export type TaxRates = Record<string, number>

export async function fetchTaxRates(world: string): Promise<TaxRates> {
  const res = await universalisFetch(`/tax-rates?world=${encodeURIComponent(world)}`)
  if (!res.ok) return {}
  return res.json()
}

// ---------------------------------------------------------------------------
// World / data-centre topology
// ---------------------------------------------------------------------------
//
// The aggregated payload identifies the cheapest regional seller by numeric
// worldId, so arbitrage needs id -> name to display it and DC membership to
// tell a same-DC hop from a cross-DC trip. Both lists are small and change
// only when Square Enix adds a world, so one in-process cache per server
// instance is plenty — no database table required.

export interface UniversalisWorld {
  id: number
  name: string
}

export interface UniversalisDataCenter {
  name: string
  region: string
  worlds: number[]
}

export interface WorldTopology {
  byId: Map<number, string>
  byName: Map<string, number>
  /** World id -> data centre name. */
  dcOfWorldId: Map<number, string>
}

let topologyCache: WorldTopology | null = null

export async function fetchWorldTopology(): Promise<WorldTopology> {
  if (topologyCache) return topologyCache

  const [worldsRes, dcRes] = await Promise.all([
    universalisFetch("/worlds"),
    universalisFetch("/data-centers"),
  ])
  if (!worldsRes.ok || !dcRes.ok) {
    throw new Error(
      `Universalis topology fetch failed: worlds ${worldsRes.status}, data-centers ${dcRes.status}`
    )
  }

  const worlds: UniversalisWorld[] = await worldsRes.json()
  const dcs: UniversalisDataCenter[] = await dcRes.json()

  const byId = new Map<number, string>()
  const byName = new Map<string, number>()
  for (const w of worlds) {
    byId.set(w.id, w.name)
    byName.set(w.name, w.id)
  }

  const dcOfWorldId = new Map<number, string>()
  for (const dc of dcs) {
    for (const id of dc.worlds) dcOfWorldId.set(id, dc.name)
  }

  topologyCache = { byId, byName, dcOfWorldId }
  return topologyCache
}

/** Test seam — drops the in-process cache. */
export function __resetWorldTopologyCache() {
  topologyCache = null
}
