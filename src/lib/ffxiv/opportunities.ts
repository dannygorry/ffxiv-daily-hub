import type {
  Quality,
  UniversalisAggregatedItem,
  UniversalisSupplyDetail,
} from "./universalis"

// ---------------------------------------------------------------------------
// Shared shape
// ---------------------------------------------------------------------------

export type ConfidenceTier = "fresh" | "aging" | "excluded"

export type PenaltyCode =
  | "stale_region_source"
  | "low_sale_count"
  | "thin_listings"
  | "unknown_region_freshness"
  | "estimated_ingredient_price"
  | "outlier_listing_rejected"
  | "partial_batch"

/** Subtractive weights applied to a starting score of 1.0, floored at 0. */
export const PENALTY_WEIGHTS: Record<PenaltyCode, number> = {
  stale_region_source: 0.3,
  low_sale_count: 0.25,
  thin_listings: 0.2,
  unknown_region_freshness: 0.2,
  estimated_ingredient_price: 0.15,
  outlier_listing_rejected: 0.15,
  partial_batch: 0.1,
}

const AGING_PENALTY = 0.2

export interface Confidence {
  tier: ConfidenceTier
  score: number
  penalties: PenaltyCode[]
}

/**
 * One ranked opportunity. Quality-scoped: every figure on the row is computed
 * within `quality`, never mixed across NQ/HQ.
 *
 * Profit-bearing rows carry pre-tax `grossRevenue` / `cost` rather than a
 * finished net, so the client can recompute and re-sort when the home-city tax
 * selector changes. A baked net would silently mis-rank at a different rate.
 */
export interface Opportunity {
  itemId: number
  quality: Quality
  confidence: Confidence
  /** Pre-tax revenue for one unit-equivalent of the trade. */
  grossRevenue: number
  /** Acquisition cost. Zero for supply gaps, which model unmet demand not a buy. */
  cost: number
  /** Tax rate used for server-side ranking; the client may recompute at another. */
  taxRateUsed: number
}

export interface SupplyGapOpportunity extends Opportunity {
  kind: "supply_gap"
  unitsForSale: number
  listingsCount: number
  velocity: number
  /** unitsForSale / velocity. null when supply is 0 — an empty market, not infinity. */
  daysOfSupply: number | null
  avgSalePrice: number
  /** velocity * avgSalePrice. A ranking signal, not a profit forecast. */
  unmetDemandPerDay: number
}

export interface ArbitrageOpportunity extends Opportunity {
  kind: "arbitrage"
  buyWorldId: number
  buyPrice: number
  homeSalePrice: number
  velocity: number
  /** Same data centre as home, so no cross-DC travel required. */
  sameDataCenter: boolean
}

// ---------------------------------------------------------------------------
// Freshness / confidence
// ---------------------------------------------------------------------------

export const FRESH_MS = 24 * 60 * 60 * 1000
export const EXCLUDE_MS = 72 * 60 * 60 * 1000
/** Below this, the row gets a low-confidence visual treatment (still shown). */
export const LOW_CONFIDENCE_SCORE = 0.4

export function tierForAge(ageMs: number | null): ConfidenceTier {
  if (ageMs == null) return "excluded"
  if (ageMs > EXCLUDE_MS) return "excluded"
  return ageMs > FRESH_MS ? "aging" : "fresh"
}

export function buildConfidence(tier: ConfidenceTier, penalties: PenaltyCode[]): Confidence {
  let score = 1
  for (const p of penalties) score -= PENALTY_WEIGHTS[p]
  if (tier === "aging") score -= AGING_PENALTY
  return { tier, score: Math.max(0, Number(score.toFixed(3))), penalties: [...penalties] }
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** A listing this far above the historical average is a troll price, not a market. */
export const OUTLIER_MULTIPLE = 5

/**
 * Rejects a listing price that is implausibly above the historical average.
 * Item 5544 was observed listed at 230,000 against a 730 average — using the
 * listing directly would have produced a fabricated 315x margin.
 */
export function isOutlierListing(listingPrice: number, avgSalePrice: number | null): boolean {
  if (avgSalePrice == null || avgSalePrice <= 0) return false
  return listingPrice > avgSalePrice * OUTLIER_MULTIPLE
}

/**
 * The average sale price itself can be poisoned, and the guard above does not
 * catch it because it only questions the listing.
 *
 * Observed live: Iolite Earrings (8284) HQ on Excalibur had one sale at
 * 210,000,000 followed by 9,992 / 6,985 / 6,000 / 5,999. Universalis's 4-day
 * `averageSalePrice` came back as 210,000,000 — the single freak sale *is* the
 * average. Ranking off that produced a fabricated 199,499,310 gil margin at the
 * top of the arbitrage board.
 *
 * The cross-check is what people are asking right now: a real market's average
 * sits within a small multiple of the cheapest live listing. Iolite's HQ world
 * listing was 9,989 against that 210,000,000 "average" — a 21,000x gap.
 */
export const MAX_AVG_TO_LISTING = 10

export function isPoisonedAverage(
  avgSalePrice: number,
  referenceListing: number | null
): boolean {
  if (referenceListing == null || referenceListing <= 0) return false
  return avgSalePrice > referenceListing * MAX_AVG_TO_LISTING
}

/**
 * Independent sanity bound on arbitrage itself. Genuine cross-world margins run
 * ~1.2-3x; anything past this is a data artefact on one side of the trade, not
 * an opportunity. Catches the "buy at 1 gil, sell at 33,000,000" shape even when
 * both figures individually look survivable.
 */
export const MAX_ARBITRAGE_MULTIPLE = 50

/** Under ~4 sales in the 4-day window; the velocity figure is noise-dominated. */
export function isLowSaleCount(velocity: number): boolean {
  return velocity > 0 && velocity < 1
}

/** One or two sellers set the entire price. */
export function isThinListings(listingsCount: number): boolean {
  return listingsCount > 0 && listingsCount <= 2
}

// ---------------------------------------------------------------------------
// Reading the aggregated payload
// ---------------------------------------------------------------------------

function block(agg: UniversalisAggregatedItem, quality: Quality) {
  return quality === "hq" ? agg.hq : agg.nq
}

export function avgPriceOf(agg: UniversalisAggregatedItem, quality: Quality): number | null {
  return block(agg, quality)?.averageSalePrice?.world?.price ?? null
}

export function velocityOf(agg: UniversalisAggregatedItem, quality: Quality): number {
  return block(agg, quality)?.dailySaleVelocity?.world?.quantity ?? 0
}

export function regionMinListingOf(
  agg: UniversalisAggregatedItem,
  quality: Quality
): { price: number; worldId: number } | null {
  const r = block(agg, quality)?.minListing?.region
  if (!r || typeof r.price !== "number" || typeof r.worldId !== "number") return null
  return { price: r.price, worldId: r.worldId }
}

/**
 * Home-world reality check for `isPoisonedAverage`: the cheapest live ask, or
 * failing that the most recent actual sale, on the player's own world.
 *
 * Deliberately does NOT fall back to dc/region. An item with nothing listed at
 * home is the flagship supply-gap case, and judging its home average against
 * some other world's cheap listing rejects it wrongly — an early build of this
 * guard cut supply gaps from 50 rows to 5 by doing exactly that. Comparing a
 * world's average only to evidence from that same world is the whole point.
 *
 * Returns null when the home world offers no evidence either way, in which case
 * the average is left alone rather than assumed bad.
 */
export function referenceListingOf(
  agg: UniversalisAggregatedItem,
  quality: Quality
): number | null {
  const b = block(agg, quality)
  return b?.minListing?.world?.price ?? b?.recentPurchase?.world?.price ?? null
}

export function uploadTimeForWorld(
  agg: UniversalisAggregatedItem,
  worldId: number
): number | null {
  return agg.worldUploadTimes?.find((w) => w.worldId === worldId)?.timestamp ?? null
}

// ---------------------------------------------------------------------------
// Shortlist (§5) — deterministic union of four ranked candidate lists
// ---------------------------------------------------------------------------

export interface Candidate {
  itemId: number
  quality: Quality
  avgPrice: number
  velocity: number
  regionMargin: number
}

export const SHORTLIST_CAP = 1000
const TAKE_VELOCITY = 300
const TAKE_THROUGHPUT = 300
const TAKE_VALUE = 200
const TAKE_MARGIN = 200
/** List C floor: slow movers still need to actually move. */
const VALUE_LIST_MIN_VELOCITY = 0.25

/**
 * Deterministic tie-break: higher price, then higher velocity, then lower id.
 * Ties must never resolve by array order or the shortlist stops being
 * reproducible across runs for identical input.
 */
function compareTieBreak(a: Candidate, b: Candidate): number {
  if (b.avgPrice !== a.avgPrice) return b.avgPrice - a.avgPrice
  if (b.velocity !== a.velocity) return b.velocity - a.velocity
  return a.itemId - b.itemId
}

function rankedBy(
  candidates: Candidate[],
  key: (c: Candidate) => number,
  take: number,
  filter?: (c: Candidate) => boolean
): Candidate[] {
  return candidates
    .filter((c) => (filter ? filter(c) : true))
    .sort((a, b) => {
      const d = key(b) - key(a)
      return d !== 0 ? d : compareTieBreak(a, b)
    })
    .slice(0, take)
}

export function candidateKey(c: { itemId: number; quality: Quality }): string {
  return `${c.itemId}:${c.quality}`
}

/**
 * Builds the stage-2 shortlist as a union of four rankings rather than one.
 *
 * A single "velocity x price" ranking would drop high-value slow movers, which
 * is exactly the category the supply-gap engine exists to surface — so list C
 * carries them, and list D guarantees arbitrage candidates survive to stage 2.
 */
export function buildShortlist(candidates: Candidate[], cap = SHORTLIST_CAP): Candidate[] {
  const eligible = candidates.filter((c) => c.avgPrice > 0 && c.velocity > 0)

  const lists = [
    rankedBy(eligible, (c) => c.velocity, TAKE_VELOCITY),
    rankedBy(eligible, (c) => c.velocity * c.avgPrice, TAKE_THROUGHPUT),
    rankedBy(eligible, (c) => c.avgPrice, TAKE_VALUE, (c) => c.velocity >= VALUE_LIST_MIN_VELOCITY),
    rankedBy(eligible, (c) => c.regionMargin, TAKE_MARGIN, (c) => c.regionMargin > 0),
  ]

  // Round-robin the union so an over-cap result starves no single list.
  const seen = new Set<string>()
  const out: Candidate[] = []
  const cursors = lists.map(() => 0)
  let exhausted = false
  while (out.length < cap && !exhausted) {
    exhausted = true
    for (let i = 0; i < lists.length && out.length < cap; i++) {
      const list = lists[i]
      while (cursors[i] < list.length) {
        const c = list[cursors[i]++]
        const k = candidateKey(c)
        if (seen.has(k)) continue
        seen.add(k)
        out.push(c)
        exhausted = false
        break
      }
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Rankers
// ---------------------------------------------------------------------------

export const OPPORTUNITY_LIMIT = 50
export const DEFAULT_TAX_RATE = 0.05
/** Below this, the market clears in under a day — a real gap. */
export const TIGHT_DAYS_OF_SUPPLY = 2

export interface SupplyGapInput {
  agg: UniversalisAggregatedItem
  supply: UniversalisSupplyDetail
  quality: Quality
  partialBatch: boolean
  now: number
}

export function buildSupplyGap(input: SupplyGapInput): SupplyGapOpportunity | null {
  const { agg, supply, quality, partialBatch, now } = input

  const avgSalePrice = avgPriceOf(agg, quality)
  const velocity = velocityOf(agg, quality)
  if (avgSalePrice == null || avgSalePrice <= 0 || velocity <= 0) return null

  // A single freak sale can become the whole 4-day average. Cross-check against
  // the cheapest live listing before quoting a price back to the user.
  if (isPoisonedAverage(avgSalePrice, referenceListingOf(agg, quality))) return null

  const ageMs = supply.lastUploadTime == null ? null : now - supply.lastUploadTime
  const tier = tierForAge(ageMs)
  if (tier === "excluded") return null

  const penalties: PenaltyCode[] = []
  if (isLowSaleCount(velocity)) penalties.push("low_sale_count")
  if (isThinListings(supply.listingsCount)) penalties.push("thin_listings")
  if (partialBatch) penalties.push("partial_batch")

  const daysOfSupply = supply.unitsForSale === 0 ? null : supply.unitsForSale / velocity
  // Only surface genuinely tight markets; everything else is just a listing.
  if (daysOfSupply != null && daysOfSupply > TIGHT_DAYS_OF_SUPPLY) return null

  return {
    kind: "supply_gap",
    itemId: agg.itemId,
    quality,
    confidence: buildConfidence(tier, penalties),
    unitsForSale: supply.unitsForSale,
    listingsCount: supply.listingsCount,
    velocity,
    daysOfSupply,
    avgSalePrice,
    unmetDemandPerDay: velocity * avgSalePrice,
    // A supply gap is unmet demand, not a purchase — there is nothing to buy,
    // so cost is 0 and gross is the per-unit price the market has been paying.
    grossRevenue: avgSalePrice,
    cost: 0,
    taxRateUsed: DEFAULT_TAX_RATE,
  }
}

export function rankSupplyGaps(
  gaps: SupplyGapOpportunity[],
  limit = OPPORTUNITY_LIMIT
): SupplyGapOpportunity[] {
  return [...gaps]
    .sort((a, b) => {
      const d = b.unmetDemandPerDay - a.unmetDemandPerDay
      if (d !== 0) return d
      if (b.avgSalePrice !== a.avgSalePrice) return b.avgSalePrice - a.avgSalePrice
      return a.itemId - b.itemId
    })
    .slice(0, limit)
}

export interface ArbitrageInput {
  agg: UniversalisAggregatedItem
  quality: Quality
  /** Universalis world id of the player's home world. */
  homeWorldId: number
  /** World ids sharing the home data centre, for the travel-cost hint. */
  sameDcWorldIds: Set<number>
  partialBatch: boolean
  now: number
}

export function buildArbitrage(input: ArbitrageInput): ArbitrageOpportunity | null {
  const { agg, quality, homeWorldId, sameDcWorldIds, partialBatch, now } = input

  const homeSalePrice = avgPriceOf(agg, quality)
  const velocity = velocityOf(agg, quality)
  const region = regionMinListingOf(agg, quality)
  if (homeSalePrice == null || homeSalePrice <= 0 || velocity <= 0 || region == null) return null
  // Buying from your own world isn't arbitrage.
  if (region.worldId === homeWorldId) return null

  const penalties: PenaltyCode[] = []

  // Three independent ways this trade can be fictional, and all three have been
  // observed in live data:
  //
  //   1. The buy listing is a troll price (item 5544: listed 230,000 against a
  //      730 average).
  //   2. The home sale "average" is one freak sale (item 8284 HQ: a single
  //      210,000,000 sale against a 9,989 live listing).
  //   3. Neither figure looks individually absurd but the implied markup does
  //      (buy at 1 gil, sell at 33,000,000).
  if (isOutlierListing(region.price, homeSalePrice)) return null
  if (isPoisonedAverage(homeSalePrice, referenceListingOf(agg, quality))) return null
  if (region.price > 0 && homeSalePrice > region.price * MAX_ARBITRAGE_MULTIPLE) return null

  const netAtDefault = homeSalePrice * (1 - DEFAULT_TAX_RATE) - region.price
  if (netAtDefault <= 0) return null

  // Freshness of the *buy* world, which stage 2 never queries — worldUploadTimes
  // from the aggregated payload is the only signal available for it.
  const homeUpload = uploadTimeForWorld(agg, homeWorldId)
  const buyUpload = uploadTimeForWorld(agg, region.worldId)

  if (buyUpload == null) {
    penalties.push("unknown_region_freshness")
  } else if (homeUpload != null && homeUpload - buyUpload > FRESH_MS) {
    penalties.push("stale_region_source")
  }

  // Tier is driven by the buy side: that's the data the player acts on.
  const ageMs = buyUpload == null ? null : now - buyUpload
  const tier = buyUpload == null ? "aging" : tierForAge(ageMs)
  if (tier === "excluded") return null

  if (isLowSaleCount(velocity)) penalties.push("low_sale_count")
  if (partialBatch) penalties.push("partial_batch")

  return {
    kind: "arbitrage",
    itemId: agg.itemId,
    quality,
    confidence: buildConfidence(tier, penalties),
    buyWorldId: region.worldId,
    buyPrice: region.price,
    homeSalePrice,
    velocity,
    sameDataCenter: sameDcWorldIds.has(region.worldId),
    grossRevenue: homeSalePrice,
    cost: region.price,
    taxRateUsed: DEFAULT_TAX_RATE,
  }
}

export function rankArbitrage(
  rows: ArbitrageOpportunity[],
  limit = OPPORTUNITY_LIMIT
): ArbitrageOpportunity[] {
  const net = (r: ArbitrageOpportunity) => r.grossRevenue * (1 - r.taxRateUsed) - r.cost
  return [...rows]
    .sort((a, b) => {
      const d = net(b) - net(a)
      if (d !== 0) return d
      // Prefer same-DC at equal margin: the trip is cheaper.
      if (a.sameDataCenter !== b.sameDataCenter) return a.sameDataCenter ? -1 : 1
      return a.itemId - b.itemId
    })
    .slice(0, limit)
}
