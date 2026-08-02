import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildArbitrage,
  buildConfidence,
  buildCraft,
  buildShortlist,
  buildSupplyGap,
  buildVendor,
  ingredientUnitPrice,
  isOutlierListing,
  isPoisonedAverage,
  rankArbitrage,
  rankCrafts,
  tierForAge,
  PENALTY_WEIGHTS,
  type Candidate,
  type CraftOpportunity,
} from "./opportunities.ts"
import type { Quality, UniversalisAggregatedItem } from "./universalis.ts"

// These cases are the spec's verification scenarios, and most of them exist
// because the behaviour was wrong at some point during implementation. The
// numbers are real values observed on Excalibur/Gilgamesh, not invented ones.

const HOUR = 3_600_000
const NOW = 1_800_000_000_000
const HOME = 93

interface AggOpts {
  price?: number
  velocity?: number
  listing?: number
  regionListing?: { price: number; worldId: number }
  recentPurchase?: number
  uploads?: { worldId: number; timestamp: number }[]
  hqPrice?: number
  hqVelocity?: number
  hqListing?: number
}

function agg(itemId: number, o: AggOpts = {}): UniversalisAggregatedItem {
  return {
    itemId,
    nq: {
      averageSalePrice: o.price != null ? { world: { price: o.price } } : undefined,
      dailySaleVelocity: o.velocity != null ? { world: { quantity: o.velocity } } : undefined,
      recentPurchase:
        o.recentPurchase != null
          ? { world: { price: o.recentPurchase, timestamp: NOW - HOUR } }
          : undefined,
      minListing: {
        ...(o.listing != null ? { world: { price: o.listing } } : {}),
        ...(o.regionListing ? { region: o.regionListing } : {}),
      },
    },
    hq: {
      averageSalePrice: o.hqPrice != null ? { world: { price: o.hqPrice } } : undefined,
      dailySaleVelocity: o.hqVelocity != null ? { world: { quantity: o.hqVelocity } } : undefined,
      minListing: o.hqListing != null ? { world: { price: o.hqListing } } : {},
    },
    worldUploadTimes: o.uploads ?? [{ worldId: HOME, timestamp: NOW - HOUR }],
  }
}

const supply = (itemId: number, quality: Quality, units: number, listings: number, ageH = 1) => ({
  itemId,
  quality,
  unitsForSale: units,
  listingsCount: listings,
  lastUploadTime: NOW - ageH * HOUR,
})

describe("confidence scoring", () => {
  it("subtracts each penalty weight from 1.0", () => {
    const c = buildConfidence("fresh", ["thin_listings", "low_sale_count"])
    assert.equal(c.score, 1 - PENALTY_WEIGHTS.thin_listings - PENALTY_WEIGHTS.low_sale_count)
  })

  it("applies an extra penalty for aging data", () => {
    assert.equal(buildConfidence("aging", ["stale_region_source"]).score, 0.5)
  })

  it("floors at zero rather than going negative", () => {
    const all = Object.keys(PENALTY_WEIGHTS) as (keyof typeof PENALTY_WEIGHTS)[]
    assert.equal(buildConfidence("aging", all).score, 0)
  })

  it("tiers by upload age", () => {
    assert.equal(tierForAge(2 * HOUR), "fresh")
    assert.equal(tierForAge(48 * HOUR), "aging")
    assert.equal(tierForAge(80 * HOUR), "excluded")
    assert.equal(tierForAge(null), "excluded")
  })
})

describe("price guards", () => {
  it("rejects a troll listing far above the average (item 5544)", () => {
    assert.equal(isOutlierListing(230_000, 730), true)
    assert.equal(isOutlierListing(800, 730), false)
  })

  it("catches an average poisoned by one freak sale (item 8284 HQ)", () => {
    // 210,000,000 average against a 9,989 live listing.
    assert.equal(isPoisonedAverage(210_000_000, 9_989), true)
  })

  it("catches gil-transfer pricing that poisons the home listing too (item 3762)", () => {
    // The home check alone cannot see this: 50M against a 10M listing is only 5x.
    assert.equal(isPoisonedAverage(50_000_000, 10_000_000), false)
    // The region minimum resists it — one seller cannot poison ~100 worlds.
    assert.equal(isPoisonedAverage(50_000_000, 10_000_000, 2), true)
  })

  it("leaves genuinely expensive items alone", () => {
    // Crumbling Aqueduct Metal and Crumbling Aqueduct, same world, same scan.
    assert.equal(isPoisonedAverage(2_449_999, 1_500_000, 749_999), false)
    assert.equal(isPoisonedAverage(5_929_999, 4_400_000, 4_000_000), false)
  })

  it("allows a thin home market well above the cheapest world", () => {
    // An over-tight region threshold once cut supply gaps from 50 rows to 5.
    assert.equal(isPoisonedAverage(38_000_000, 37_500_000, 1_000_000), false)
  })

  it("cannot judge without a reference, and does not guess", () => {
    assert.equal(isPoisonedAverage(210_000_000, null), false)
  })
})

describe("shortlist", () => {
  const fixture = (): Candidate[] => {
    const out: Candidate[] = []
    for (let i = 1; i <= 400; i++) {
      out.push({ itemId: i, quality: "nq", avgPrice: 100, velocity: 50 - i / 100, regionMargin: 0 })
    }
    // Throughput 4,500 sits below every filler's 4,600-4,999, and velocity 0.3
    // is nowhere near the top by velocity — only list C can rescue it.
    out.push({ itemId: 99_999, quality: "nq", avgPrice: 15_000, velocity: 0.3, regionMargin: 0 })
    return out
  }

  it("is deterministic for identical input", () => {
    assert.deepEqual(buildShortlist(fixture()), buildShortlist(fixture()))
  })

  it("rescues a high-value slow mover that velocity and throughput both drop", () => {
    const cands = fixture()
    const picked = buildShortlist(cands)
    assert.ok(picked.some((c) => c.itemId === 99_999))

    const byVelocity = [...cands].sort((a, b) => b.velocity - a.velocity).slice(0, 300)
    const byThroughput = [...cands]
      .sort((a, b) => b.velocity * b.avgPrice - a.velocity * a.avgPrice)
      .slice(0, 300)
    assert.ok(!byVelocity.some((c) => c.itemId === 99_999))
    assert.ok(!byThroughput.some((c) => c.itemId === 99_999))
  })

  it("emits no duplicate item/quality pairs and honours the cap", () => {
    const picked = buildShortlist(fixture())
    assert.equal(new Set(picked.map((c) => `${c.itemId}:${c.quality}`)).size, picked.length)
    assert.equal(buildShortlist(fixture(), 10).length, 10)
  })

  it("drops candidates with no price or no velocity", () => {
    assert.equal(
      buildShortlist([{ itemId: 1, quality: "nq", avgPrice: 0, velocity: 5, regionMargin: 0 }])
        .length,
      0
    )
  })
})

describe("supply gap", () => {
  const base = { quality: "nq" as Quality, partialBatch: false, now: NOW }

  it("reports an empty market as null days-of-supply, not infinity", () => {
    const row = buildSupplyGap({
      ...base,
      agg: agg(1, { price: 7_399, velocity: 2.3, listing: 7_000 }),
      supply: supply(1, "nq", 0, 0),
    })
    assert.ok(row)
    assert.equal(row.daysOfSupply, null)
    assert.equal(row.cost, 0)
    assert.equal(row.unmetDemandPerDay, 2.3 * 7_399)
  })

  it("excludes data older than 72 hours", () => {
    const row = buildSupplyGap({
      ...base,
      agg: agg(1, { price: 7_399, velocity: 2.3, listing: 7_000 }),
      supply: supply(1, "nq", 0, 0, 80),
    })
    assert.equal(row, null)
  })

  it("ignores well-supplied markets", () => {
    const row = buildSupplyGap({
      ...base,
      agg: agg(1, { price: 7_399, velocity: 2.3, listing: 7_000 }),
      supply: supply(1, "nq", 500, 40),
    })
    assert.equal(row, null)
  })

  it("keeps HQ figures separate from NQ", () => {
    const row = buildSupplyGap({
      ...base,
      quality: "hq",
      agg: agg(2, {
        price: 100,
        velocity: 9,
        listing: 100,
        hqPrice: 5_000,
        hqVelocity: 1.5,
        hqListing: 4_800,
      }),
      supply: supply(2, "hq", 1, 1),
    })
    assert.ok(row)
    assert.equal(row.avgSalePrice, 5_000)
    assert.equal(row.velocity, 1.5)
  })
})

describe("arbitrage", () => {
  const base = {
    quality: "nq" as Quality,
    homeWorldId: HOME,
    sameDcWorldIds: new Set([HOME, 35]),
    partialBatch: false,
    now: NOW,
  }

  it("applies tax to the sale side only", () => {
    const row = buildArbitrage({
      ...base,
      agg: agg(10, {
        price: 1_000,
        velocity: 5,
        listing: 1_000,
        regionListing: { price: 400, worldId: 35 },
        uploads: [
          { worldId: HOME, timestamp: NOW - HOUR },
          { worldId: 35, timestamp: NOW - 2 * HOUR },
        ],
      }),
    })
    assert.ok(row)
    assert.equal(row.grossRevenue * (1 - row.taxRateUsed) - row.cost, 550)
    assert.equal(row.sameDataCenter, true)
  })

  it("flags a buy world with no upload record rather than assuming it is fresh", () => {
    const row = buildArbitrage({
      ...base,
      agg: agg(11, {
        price: 1_000,
        velocity: 5,
        listing: 1_000,
        regionListing: { price: 400, worldId: 77 },
        uploads: [{ worldId: HOME, timestamp: NOW - HOUR }],
      }),
    })
    assert.ok(row)
    assert.ok(row.confidence.penalties.includes("unknown_region_freshness"))
    assert.ok(row.confidence.score < 1)
  })

  it("flags a buy world whose data lags home by more than a day", () => {
    const row = buildArbitrage({
      ...base,
      agg: agg(12, {
        price: 1_000,
        velocity: 5,
        listing: 1_000,
        regionListing: { price: 400, worldId: 35 },
        uploads: [
          { worldId: HOME, timestamp: NOW - HOUR },
          { worldId: 35, timestamp: NOW - 40 * HOUR },
        ],
      }),
    })
    assert.ok(row)
    assert.ok(row.confidence.penalties.includes("stale_region_source"))
  })

  it("rejects impossible markups, negative margins, and self-purchases", () => {
    const common = { price: 1_000, velocity: 5, listing: 1_000 }
    // buy at 1 gil, sell at 33,000,000
    assert.equal(
      buildArbitrage({
        ...base,
        agg: agg(13, {
          price: 33_151_499,
          velocity: 2,
          listing: 33_000_000,
          regionListing: { price: 1, worldId: 35 },
        }),
      }),
      null
    )
    assert.equal(
      buildArbitrage({
        ...base,
        agg: agg(14, { ...common, regionListing: { price: 400, worldId: HOME } }),
      }),
      null
    )
    assert.equal(
      buildArbitrage({
        ...base,
        agg: agg(15, {
          price: 500,
          velocity: 5,
          listing: 500,
          regionListing: { price: 600, worldId: 35 },
        }),
      }),
      null
    )
  })

  it("prefers same-data-centre at an equal margin", () => {
    const mk = (id: number, sameDc: boolean) => ({
      kind: "arbitrage" as const,
      itemId: id,
      quality: "nq" as Quality,
      confidence: buildConfidence("fresh", []),
      grossRevenue: 1_000,
      cost: 500,
      taxRateUsed: 0.05,
      buyWorldId: 35,
      buyPrice: 500,
      homeSalePrice: 1_000,
      velocity: 1,
      sameDataCenter: sameDc,
    })
    assert.equal(rankArbitrage([mk(1, false), mk(2, true)])[0].itemId, 2)
  })
})

describe("crafting", () => {
  const priced = (id: number, price: number, velocity = 2) =>
    agg(id, { price, velocity, listing: price })

  const baseCraft = {
    recipeId: 1,
    resultItemId: 100,
    resultQty: 1,
    craftType: "Smithing" as string | null,
    jobLevel: 50 as number | null,
    ingredients: [{ itemId: 200, qty: 2 }],
    quality: "nq" as Quality,
    canBeHq: () => true,
    isUntradable: () => false,
    homeWorldId: HOME,
    partialBatch: false,
    now: NOW,
  }

  const mapOf = (...items: UniversalisAggregatedItem[]) =>
    new Map(items.map((i) => [i.itemId, i]))

  it("multiplies revenue by recipe yield", () => {
    // 840 of 13,892 recipes yield more than one; 796 of those yield exactly 3.
    const result = buildCraft({
      ...baseCraft,
      resultQty: 3,
      aggByItemId: mapOf(priced(100, 1_000), priced(200, 10)),
    })
    assert.ok(!("skipped" in result))
    assert.equal(result.grossRevenue, 3_000)
    assert.equal(result.cost, 20)
  })

  it("costs HQ output using NQ materials", () => {
    // HQ materials raise starting quality but are not required, so charging for
    // them invents a cost the player usually does not pay.
    const result = buildCraft({
      ...baseCraft,
      quality: "hq",
      aggByItemId: mapOf(
        agg(100, { price: 500, velocity: 2, listing: 500, hqPrice: 2_000, hqVelocity: 1, hqListing: 1_900 }),
        priced(200, 10)
      ),
    })
    assert.ok(!("skipped" in result))
    assert.equal(result.resultUnitPrice, 2_000)
    assert.equal(result.cost, 20) // NQ material price, not an HQ one
  })

  it("refuses to emit an HQ row when the item cannot be HQ", () => {
    const result = buildCraft({
      ...baseCraft,
      quality: "hq",
      canBeHq: () => false,
      aggByItemId: mapOf(priced(100, 1_000), priced(200, 10)),
    })
    assert.deepEqual(result, { skipped: "hq_not_supported" })
  })

  it("treats unknown HQ capability as restrictive", () => {
    const result = buildCraft({
      ...baseCraft,
      quality: "hq",
      canBeHq: () => null,
      aggByItemId: mapOf(priced(100, 1_000), priced(200, 10)),
    })
    assert.deepEqual(result, { skipped: "hq_not_supported" })
  })

  it("treats unknown ingredient tradability as restrictive", () => {
    // Accepting null as tradeable would let an unwarmed catalogue price recipes
    // around materials that cannot actually be bought.
    const result = buildCraft({
      ...baseCraft,
      isUntradable: () => null,
      aggByItemId: mapOf(priced(100, 1_000), priced(200, 10)),
    })
    assert.deepEqual(result, { skipped: "untradable_ingredient" })
  })

  it("excludes a recipe whose ingredient has no price at all", () => {
    const result = buildCraft({
      ...baseCraft,
      aggByItemId: mapOf(priced(100, 1_000)), // ingredient 200 absent
    })
    assert.deepEqual(result, { skipped: "unpriceable_ingredient" })
  })

  it("falls back to the historical average and says so", () => {
    const noListing = agg(200, { price: 40, velocity: 1 })
    const result = buildCraft({
      ...baseCraft,
      aggByItemId: mapOf(priced(100, 1_000), noListing),
    })
    assert.ok(!("skipped" in result))
    assert.ok(result.confidence.penalties.includes("estimated_ingredient_price"))
  })

  it("uses a cheaper sub-craft cost when one exists", () => {
    const result = buildCraft({
      ...baseCraft,
      subCraftCost: (id) => (id === 200 ? 3 : null),
      aggByItemId: mapOf(priced(100, 1_000), priced(200, 10)),
    })
    assert.ok(!("skipped" in result))
    assert.equal(result.cost, 6)
    assert.equal(result.ingredients[0].crafted, true)
  })

  it("keeps both qualities of the same recipe when retaining", () => {
    // Keying retention on recipeId alone let one quality overwrite the other
    // and silently shrank the retained set.
    const mk = (quality: Quality, net: number): CraftOpportunity => ({
      kind: "craft",
      itemId: 100,
      recipeId: 7,
      quality,
      confidence: buildConfidence("fresh", []),
      resultQty: 1,
      craftType: "Smithing",
      jobLevel: 50,
      resultUnitPrice: net,
      velocity: 1,
      ingredients: [],
      grossRevenue: net,
      cost: 0,
      taxRateUsed: 0,
    })
    const kept = rankCrafts([mk("nq", 100), mk("hq", 500)])
    assert.equal(kept.length, 2)
  })

  it("guarantees every craft type some representation", () => {
    const rows: CraftOpportunity[] = []
    let recipeId = 0
    for (const type of ["Smithing", "Cooking"]) {
      for (let i = 0; i < 300; i++) {
        // Smithing dominates by profit; Cooking would be cut by a flat top-N.
        const net = type === "Smithing" ? 1_000_000 - i : 10 - i / 100
        rows.push({
          kind: "craft",
          itemId: 1_000 + recipeId,
          recipeId: recipeId++,
          quality: "nq",
          confidence: buildConfidence("fresh", []),
          resultQty: 1,
          craftType: type,
          jobLevel: 1,
          resultUnitPrice: net,
          velocity: 1,
          ingredients: [],
          grossRevenue: net,
          cost: 0,
          taxRateUsed: 0,
        })
      }
    }
    const kept = rankCrafts(rows)
    assert.ok(kept.some((r) => r.craftType === "Cooking"))
  })
})

describe("ingredient pricing", () => {
  it("prefers a live listing over the historical average", () => {
    const r = ingredientUnitPrice(agg(1, { price: 100, listing: 60 }))
    assert.deepEqual(r, { price: 60, estimated: false })
  })

  it("rejects an outlier listing and falls back, marking the estimate", () => {
    const r = ingredientUnitPrice(agg(1, { price: 100, listing: 5_000 }))
    assert.deepEqual(r, { price: 100, estimated: true })
  })

  it("returns null rather than zero when nothing is known", () => {
    assert.equal(ingredientUnitPrice(agg(1)), null)
    assert.equal(ingredientUnitPrice(undefined), null)
  })
})

describe("vendor arbitrage", () => {
  const base = {
    soldByVendor: true as boolean | null,
    isUntradable: false as boolean | null,
    vendorPrice: 5_000 as number | null,
    homeWorldId: HOME,
    partialBatch: false,
    now: NOW,
  }

  it("prices an NPC buy against the market sale", () => {
    const row = buildVendor({
      ...base,
      agg: agg(1, { price: 150_000, velocity: 0.3, listing: 140_000 }),
    })
    assert.ok(row)
    assert.equal(row.grossRevenue * (1 - row.taxRateUsed) - row.cost, 150_000 * 0.95 - 5_000)
  })

  it("requires an explicit vendor flag, never a bare PriceMid", () => {
    // PriceMid is populated on thousands of items no NPC stocks.
    for (const soldByVendor of [null, false]) {
      assert.equal(
        buildVendor({
          ...base,
          soldByVendor,
          agg: agg(1, { price: 150_000, velocity: 0.3, listing: 140_000 }),
        }),
        null
      )
    }
  })

  it("treats unknown tradability as restrictive", () => {
    assert.equal(
      buildVendor({
        ...base,
        isUntradable: null,
        agg: agg(1, { price: 150_000, velocity: 0.3, listing: 140_000 }),
      }),
      null
    )
  })

  it("rejects a poisoned market price", () => {
    // Hi-Potion showed a 50,000 average against a vendor price of 146.
    assert.equal(
      buildVendor({
        ...base,
        vendorPrice: 146,
        agg: agg(1, {
          price: 50_000,
          velocity: 0.3,
          listing: 200,
          regionListing: { price: 150, worldId: 35 },
        }),
      }),
      null
    )
  })
})
