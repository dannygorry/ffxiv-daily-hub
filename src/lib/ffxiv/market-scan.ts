import {
  fetchAllAggregatedStats,
  fetchMarketableItemIds,
  fetchSupplyDetail,
  fetchTaxRates,
  fetchWorldTopology,
  type Quality,
  type TaxRates,
  type UniversalisAggregatedItem,
  type UniversalisSupplyDetail,
} from "./universalis"
import {
  avgPriceOf,
  buildArbitrage,
  buildShortlist,
  buildSupplyGap,
  candidateKey,
  rankArbitrage,
  rankSupplyGaps,
  regionMinListingOf,
  velocityOf,
  type ArbitrageOpportunity,
  type Candidate,
  type SupplyGapOpportunity,
} from "./opportunities"

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

export function computeItemStat(agg: UniversalisAggregatedItem): ItemMarketStat {
  // avgPriceOf/velocityOf come from opportunities.ts so the two engines read
  // the aggregated payload through exactly one implementation.
  const nqAvgPrice = avgPriceOf(agg, "nq")
  const hqAvgPrice = avgPriceOf(agg, "hq")
  const nqVelocity = velocityOf(agg, "nq")
  const hqVelocity = velocityOf(agg, "hq")

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
  supplyGaps: SupplyGapOpportunity[]
  arbitrage: ArbitrageOpportunity[]
  taxRates: TaxRates
  shortlistSize: number
  itemsScanned: number
  itemsFailed: number
  scanDurationMs: number
  minVelocityThreshold: number
}

const QUALITIES: Quality[] = ["nq", "hq"]

/**
 * Builds the stage-2 candidate set from the stage-1 aggregated payload.
 * One candidate per (item, quality) — the two qualities compete independently.
 */
function candidatesFrom(items: UniversalisAggregatedItem[]): Candidate[] {
  const out: Candidate[] = []
  for (const agg of items) {
    for (const quality of QUALITIES) {
      const avgPrice = avgPriceOf(agg, quality)
      const velocity = velocityOf(agg, quality)
      if (avgPrice == null || avgPrice <= 0 || velocity <= 0) continue

      const region = regionMinListingOf(agg, quality)
      const regionMargin = region ? avgPrice - region.price : 0

      out.push({ itemId: agg.itemId, quality, avgPrice, velocity, regionMargin })
    }
  }
  return out
}

export async function scanWorld(world: string, opts?: { minVelocity?: number }): Promise<ScanResult> {
  const startedAt = Date.now()
  const minVelocity = opts?.minVelocity ?? DEFAULT_MIN_VELOCITY

  // --- Stage 1: aggregated stats for the whole marketable catalogue ---------
  const marketableIds = await fetchMarketableItemIds()
  const [{ items, failedItemIds }, topology, taxRates] = await Promise.all([
    fetchAllAggregatedStats(world, marketableIds),
    fetchWorldTopology(),
    fetchTaxRates(world),
  ])

  const stats = items.map(computeItemStat)
  const failedSet = new Set(failedItemIds)
  const byItemId = new Map(items.map((i) => [i.itemId, i]))
  const now = Date.now()

  // --- Arbitrage ranks straight off stage 1 (region data is already here) ---
  const homeWorldId = topology.byName.get(world) ?? null
  const homeDc = homeWorldId != null ? topology.dcOfWorldId.get(homeWorldId) : undefined
  const sameDcWorldIds = new Set<number>()
  if (homeDc) {
    for (const [id, dc] of topology.dcOfWorldId) {
      if (dc === homeDc) sameDcWorldIds.add(id)
    }
  }

  const arbitrageRows: ArbitrageOpportunity[] = []
  if (homeWorldId != null) {
    for (const agg of items) {
      for (const quality of QUALITIES) {
        const row = buildArbitrage({
          agg,
          quality,
          homeWorldId,
          sameDcWorldIds,
          partialBatch: failedSet.has(agg.itemId),
          now,
        })
        if (row) arbitrageRows.push(row)
      }
    }
  }

  // --- Stage 2: supply detail, shortlist only -------------------------------
  // The supply endpoint costs ~4.2s per 100 items against ~0.2s for aggregated,
  // so it runs over a bounded shortlist rather than the full catalogue. Two
  // requests per batch (hq=true / hq=false) are what make supply quality-scoped.
  const shortlist = buildShortlist(candidatesFrom(items))
  const shortlistItemIds = [...new Set(shortlist.map((c) => c.itemId))]

  const { details, failedItemIds: supplyFailed } = await fetchSupplyDetail(world, shortlistItemIds)
  const supplyFailedSet = new Set(supplyFailed)
  const supplyByKey = new Map<string, UniversalisSupplyDetail>()
  for (const d of details) supplyByKey.set(candidateKey(d), d)

  const supplyGapRows: SupplyGapOpportunity[] = []
  for (const c of shortlist) {
    const agg = byItemId.get(c.itemId)
    const supply = supplyByKey.get(candidateKey(c))
    if (!agg || !supply) continue

    const row = buildSupplyGap({
      agg,
      supply,
      quality: c.quality,
      partialBatch: failedSet.has(c.itemId) || supplyFailedSet.has(c.itemId),
      now,
    })
    if (row) supplyGapRows.push(row)
  }

  return {
    bestSellers: rankBestSellers(stats),
    mostValuable: rankMostValuable(stats, { minVelocity }),
    supplyGaps: rankSupplyGaps(supplyGapRows),
    arbitrage: rankArbitrage(arbitrageRows),
    taxRates,
    shortlistSize: shortlist.length,
    itemsScanned: items.length,
    itemsFailed: failedItemIds.length,
    scanDurationMs: Date.now() - startedAt,
    minVelocityThreshold: minVelocity,
  }
}
