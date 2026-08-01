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
