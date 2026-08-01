import { fetchAllAggregatedStats, fetchMarketableItemIds, type UniversalisAggregatedItem } from "./universalis"

export const DEFAULT_MIN_VELOCITY = 1.0
export const LEADERBOARD_LIMIT = 50

export interface ItemMarketStat {
  itemId: number
  nqAvgPrice: number | null
  hqAvgPrice: number | null
  value: number | null
  valueQuality: "nq" | "hq" | null
  nqVelocity: number
  hqVelocity: number
  velocity: number
}

function priceOf(block: UniversalisAggregatedItem["nq"] | undefined): number | null {
  return block?.averageSalePrice?.world?.price ?? null
}

function velocityOf(block: UniversalisAggregatedItem["nq"] | undefined): number {
  return block?.dailySaleVelocity?.world?.quantity ?? 0
}

export function computeItemStat(agg: UniversalisAggregatedItem): ItemMarketStat {
  const nqAvgPrice = priceOf(agg.nq)
  const hqAvgPrice = priceOf(agg.hq)
  const nqVelocity = velocityOf(agg.nq)
  const hqVelocity = velocityOf(agg.hq)

  let value: number | null = null
  let valueQuality: "nq" | "hq" | null = null
  if (hqAvgPrice != null && (nqAvgPrice == null || hqAvgPrice >= nqAvgPrice)) {
    value = hqAvgPrice
    valueQuality = "hq"
  } else if (nqAvgPrice != null) {
    value = nqAvgPrice
    valueQuality = "nq"
  }

  return {
    itemId: agg.itemId,
    nqAvgPrice,
    hqAvgPrice,
    value,
    valueQuality,
    nqVelocity,
    hqVelocity,
    velocity: nqVelocity + hqVelocity,
  }
}

export function rankBestSellers(stats: ItemMarketStat[], limit = LEADERBOARD_LIMIT): ItemMarketStat[] {
  return [...stats]
    .filter((s) => s.velocity > 0)
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, limit)
}

export function rankMostValuable(
  stats: ItemMarketStat[],
  opts: { minVelocity: number; limit?: number }
): ItemMarketStat[] {
  return [...stats]
    .filter((s) => s.value != null && s.velocity >= opts.minVelocity)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, opts.limit ?? LEADERBOARD_LIMIT)
}

export interface ScanResult {
  bestSellers: ItemMarketStat[]
  mostValuable: ItemMarketStat[]
  itemsScanned: number
  itemsFailed: number
  scanDurationMs: number
  minVelocityThreshold: number
}

export async function scanWorld(world: string, opts?: { minVelocity?: number }): Promise<ScanResult> {
  const startedAt = Date.now()
  const minVelocity = opts?.minVelocity ?? DEFAULT_MIN_VELOCITY

  const marketableIds = await fetchMarketableItemIds()
  const { items, failedItemIds } = await fetchAllAggregatedStats(world, marketableIds)

  const stats = items.map(computeItemStat)

  return {
    bestSellers: rankBestSellers(stats),
    mostValuable: rankMostValuable(stats, { minVelocity }),
    itemsScanned: items.length,
    itemsFailed: failedItemIds.length,
    scanDurationMs: Date.now() - startedAt,
    minVelocityThreshold: minVelocity,
  }
}
