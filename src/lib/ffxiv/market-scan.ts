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
  buildVendor,
  candidateKey,
  ingredientUnitPrice,
  rankArbitrage,
  rankCrafts,
  rankSupplyGaps,
  rankVendor,
  regionMinListingOf,
  velocityOf,
  type ArbitrageOpportunity,
  type Candidate,
  type CraftOpportunity,
  type SupplyGapOpportunity,
  type VendorOpportunity,
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
  vendorFlips: VendorOpportunity[]
  /** False when recipe_cache is empty — the Crafting tab degrades, others don't. */
  recipesAvailable: boolean
  /** False until a warm has marked vendor items — same degradation rule. */
  vendorDataAvailable: boolean
  taxRates: TaxRates
  shortlistSize: number
  itemsScanned: number
  itemsFailed: number
  scanDurationMs: number
  minVelocityThreshold: number
}

/** Static Item flags needed by the craft and vendor rules, keyed by item id. */
interface ItemFlags {
  canBeHq: boolean | null
  isUntradable: boolean | null
  soldByVendor: boolean | null
  vendorPrice: number | null
}

async function loadItemFlags(itemIds: number[]): Promise<Map<number, ItemFlags>> {
  const flags = new Map<number, ItemFlags>()
  if (itemIds.length === 0) return flags

  const supabase = createServiceClient()
  const PAGE = 1000
  for (let i = 0; i < itemIds.length; i += PAGE) {
    const { data, error } = await supabase
      .from("item_catalog")
      .select("item_id, can_be_hq, is_untradable, sold_by_vendor, vendor_price")
      .in("item_id", itemIds.slice(i, i + PAGE))

    if (error) {
      console.error("[market-scan] item flag load failed:", error.message)
      break
    }
    for (const r of data ?? []) {
      flags.set(r.item_id, {
        canBeHq: r.can_be_hq,
        isUntradable: r.is_untradable,
        soldByVendor: r.sold_by_vendor,
        vendorPrice: r.vendor_price,
      })
    }
  }
  return flags
}

/** Every item the catalogue knows an NPC vendor sells. */
async function loadVendorItemIds(): Promise<number[]> {
  const supabase = createServiceClient()
  const out: number[] = []
  const PAGE = 1000

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("item_catalog")
      .select("item_id")
      .eq("sold_by_vendor", true)
      .order("item_id", { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) {
      console.error("[market-scan] vendor item load failed:", error.message)
      break
    }
    if (!data || data.length === 0) break
    out.push(...data.map((r) => r.item_id))
    if (data.length < PAGE) break
  }
  return out
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
  // An item can have several recipes. Which is cheapest depends on live
  // material prices, so all of them are evaluated and the lowest computed cost
  // wins — picking by ingredient count was a proxy that has no relationship to
  // actual cost, and routinely chose a two-ingredient recipe made of expensive
  // materials over a four-ingredient one made of cheap ones.
  const byResult = new Map<number, CachedRecipe[]>()
  for (const r of recipes) {
    const list = byResult.get(r.resultItemId)
    if (list) list.push(r)
    else byResult.set(r.resultItemId, [r])
  }

  const memo = new Map<number, number>()
  const inProgress = new Set<number>()
  let truncated = 0

  const costOf = (itemId: number, depth: number): number | null => {
    if (memo.has(itemId)) return memo.get(itemId) as number
    // Recipe graphs can contain cycles (A converts to B, B converts back).
    // Without this the recursion would not terminate on those pairs.
    if (inProgress.has(itemId)) return null

    const candidates = byResult.get(itemId)
    if (!candidates || candidates.length === 0) return null
    if (depth >= maxDepth) {
      truncated++
      return null
    }

    inProgress.add(itemId)
    let best: number | null = null

    for (const recipe of candidates) {
      let total = 0
      let viable = true
      for (const ing of recipe.ingredients) {
        const bought = ingredientUnitPrice(aggByItemId.get(ing.itemId))
        const deeper = costOf(ing.itemId, depth + 1)
        const unit =
          deeper != null && (bought == null || deeper < bought.price)
            ? deeper
            : bought?.price ?? null
        if (unit == null) {
          viable = false
          break
        }
        total += unit * ing.qty
      }
      if (!viable) continue

      const perUnit = total / Math.max(1, recipe.resultQty)
      if (best == null || perUnit < best) best = perUnit
    }

    inProgress.delete(itemId)
    if (best != null) memo.set(itemId, best)
    return best
  }

  for (const itemId of byResult.keys()) costOf(itemId, 0)

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
  // `failedItemIds` is reported at scan level only (itemsFailed). It is
  // intentionally not used per-row: a stage-1 failure means the item never
  // enters `items`, so no opportunity can be built from it to flag.
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
          // Unreachable by construction: `items` only contains successes, so a
          // stage-1 failure can never appear here. Only the supply-gap engine
          // has a real per-row partiality signal (a stage-2 supply failure,
          // which leaves the stage-1 row intact).
          partialBatch: false,
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
      // Reachable here: a stage-2 supply failure leaves the stage-1 aggregate
      // in place, so the row is built from incomplete data rather than dropped.
      partialBatch: supplyFailedSet.has(c.itemId),
      now,
    })
    if (row) supplyGapRows.push(row)
  }

  // --- Vendor arbitrage -----------------------------------------------------
  // Gated on the explicit sold_by_vendor flag from GilShopItem, never on a
  // non-null PriceMid: that field is set on thousands of items no NPC stocks.
  const vendorItemIds = await loadVendorItemIds()
  const vendorRows: VendorOpportunity[] = []

  if (vendorItemIds.length > 0) {
    const vendorFlags = await loadItemFlags(vendorItemIds)
    for (const itemId of vendorItemIds) {
      const agg = byItemId.get(itemId)
      if (!agg) continue
      const f = vendorFlags.get(itemId)
      const row = buildVendor({
        agg,
        soldByVendor: f?.soldByVendor ?? null,
        isUntradable: f?.isUntradable ?? null,
        vendorPrice: f?.vendorPrice ?? null,
        homeWorldId,
        // A stage-1 failure removes the item entirely, so it can never reach
        // here — this engine has no per-row partiality signal. Scan-level
        // `itemsFailed` covers it instead.
        partialBatch: false,
        now,
      })
      if (row) vendorRows.push(row)
    }
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
          homeWorldId,
          // As with vendor rows: a stage-1 failure drops the item before it can
          // reach here, so there is no reachable per-row signal.
          partialBatch: false,
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
    vendorFlips: rankVendor(vendorRows),
    recipesAvailable: recipes.length > 0,
    vendorDataAvailable: vendorItemIds.length > 0,
    taxRates,
    shortlistSize: shortlist.length,
    itemsScanned: items.length,
    itemsFailed: failedItemIds.length,
    scanDurationMs: Date.now() - startedAt,
    minVelocityThreshold: minVelocity,
  }
}
