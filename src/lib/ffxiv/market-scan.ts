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
  buildCraft,
  buildShortlist,
  buildSupplyGap,
  candidateKey,
  ingredientUnitPrice,
  rankArbitrage,
  rankCrafts,
  rankSupplyGaps,
  regionMinListingOf,
  velocityOf,
  type ArbitrageOpportunity,
  type Candidate,
  type CraftOpportunity,
  type SupplyGapOpportunity,
} from "./opportunities"
import { loadRecipeCache, type CachedRecipe } from "./recipes"
import { createServiceClient } from "@/lib/supabase/service"

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
  craftingProfits: CraftOpportunity[]
  /** False when recipe_cache is empty — the Crafting tab degrades, others don't. */
  recipesAvailable: boolean
  taxRates: TaxRates
  shortlistSize: number
  itemsScanned: number
  itemsFailed: number
  scanDurationMs: number
  minVelocityThreshold: number
}

/** Static Item flags needed by the craft rules, keyed by item id. */
interface ItemFlags {
  canBeHq: boolean | null
  isUntradable: boolean | null
}

async function loadItemFlags(itemIds: number[]): Promise<Map<number, ItemFlags>> {
  const flags = new Map<number, ItemFlags>()
  if (itemIds.length === 0) return flags

  const supabase = createServiceClient()
  const PAGE = 1000
  for (let i = 0; i < itemIds.length; i += PAGE) {
    const { data, error } = await supabase
      .from("item_catalog")
      .select("item_id, can_be_hq, is_untradable")
      .in("item_id", itemIds.slice(i, i + PAGE))

    if (error) {
      console.error("[market-scan] item flag load failed:", error.message)
      break
    }
    for (const r of data ?? []) {
      flags.set(r.item_id, { canBeHq: r.can_be_hq, isUntradable: r.is_untradable })
    }
  }
  return flags
}

/**
 * Cheapest way to obtain one unit of each craftable ingredient, resolved to a
 * bounded depth.
 *
 * Depth 2 mirrors how deep real crafting trees usefully go; beyond that the
 * cost of resolution outweighs the accuracy gained. Truncation is logged rather
 * than silently returning a cost that ignores a cheaper deeper path.
 */
function resolveSubCraftCosts(
  recipes: CachedRecipe[],
  aggByItemId: Map<number, UniversalisAggregatedItem>,
  maxDepth = 2
): Map<number, number> {
  const byResult = new Map<number, CachedRecipe>()
  for (const r of recipes) {
    // Cheapest-yielding recipe wins when an item has several.
    const existing = byResult.get(r.resultItemId)
    if (!existing || r.ingredients.length < existing.ingredients.length) {
      byResult.set(r.resultItemId, r)
    }
  }

  const memo = new Map<number, number>()
  let truncated = 0

  const costOf = (itemId: number, depth: number): number | null => {
    if (memo.has(itemId)) return memo.get(itemId) as number

    const recipe = byResult.get(itemId)
    if (!recipe) return null
    if (depth >= maxDepth) {
      truncated++
      return null
    }

    let total = 0
    for (const ing of recipe.ingredients) {
      const bought = ingredientUnitPrice(aggByItemId.get(ing.itemId))
      const deeper = costOf(ing.itemId, depth + 1)
      const unit =
        deeper != null && (bought == null || deeper < bought.price) ? deeper : bought?.price ?? null
      if (unit == null) return null
      total += unit * ing.qty
    }

    const perUnit = total / Math.max(1, recipe.resultQty)
    memo.set(itemId, perUnit)
    return perUnit
  }

  for (const r of recipes) costOf(r.resultItemId, 0)

  if (truncated > 0) {
    console.info(`[market-scan] sub-craft depth cap hit ${truncated} times (max depth ${maxDepth})`)
  }
  return memo
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

  // --- Crafting -------------------------------------------------------------
  // Reads the pre-warmed recipe cache; never fetches recipes itself. An empty
  // cache degrades this one tab and leaves the rest of the scan untouched.
  const recipes = await loadRecipeCache()
  const craftRows: CraftOpportunity[] = []
  const skipCounts = new Map<string, number>()

  if (recipes.length > 0) {
    const craftItemIds = [
      ...new Set(recipes.flatMap((r) => [r.resultItemId, ...r.ingredients.map((i) => i.itemId)])),
    ]
    const flags = await loadItemFlags(craftItemIds)
    const subCraft = resolveSubCraftCosts(recipes, byItemId)

    const canBeHq = (id: number) => flags.get(id)?.canBeHq ?? null
    const isUntradable = (id: number) => flags.get(id)?.isUntradable ?? null
    const subCraftCost = (id: number) => subCraft.get(id) ?? null

    for (const recipe of recipes) {
      for (const quality of QUALITIES) {
        const result = buildCraft({
          recipeId: recipe.recipeId,
          resultItemId: recipe.resultItemId,
          resultQty: recipe.resultQty,
          craftType: recipe.craftType,
          jobLevel: recipe.jobLevel,
          ingredients: recipe.ingredients,
          quality,
          aggByItemId: byItemId,
          canBeHq,
          isUntradable,
          subCraftCost,
          partialBatch: failedSet.has(recipe.resultItemId),
          now,
        })

        if ("skipped" in result) {
          skipCounts.set(result.skipped, (skipCounts.get(result.skipped) ?? 0) + 1)
        } else {
          craftRows.push(result)
        }
      }
    }

    console.info(
      `[market-scan] ${world}: ${craftRows.length} craft rows from ${recipes.length} recipes;`,
      Object.fromEntries(skipCounts)
    )
  }

  return {
    bestSellers: rankBestSellers(stats),
    mostValuable: rankMostValuable(stats, { minVelocity }),
    supplyGaps: rankSupplyGaps(supplyGapRows),
    arbitrage: rankArbitrage(arbitrageRows),
    craftingProfits: rankCrafts(craftRows),
    recipesAvailable: recipes.length > 0,
    taxRates,
    shortlistSize: shortlist.length,
    itemsScanned: items.length,
    itemsFailed: failedItemIds.length,
    scanDurationMs: Date.now() - startedAt,
    minVelocityThreshold: minVelocity,
  }
}
