"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RefreshCw, Coins, TriangleAlert, Info } from "lucide-react"
import { DATA_CENTERS } from "@/lib/ffxiv/xivapi"

// ---------------------------------------------------------------------------
// Types (mirror of the API response)
// ---------------------------------------------------------------------------

type Quality = "nq" | "hq"
type Status = "initializing" | "refreshing" | "ready" | "failed"

interface Confidence {
  tier: "fresh" | "aging" | "excluded"
  score: number
  penalties: string[]
}

interface BaseRow {
  itemId: number
  rank: number
  name: string
  iconUrl: string | null
}

interface LeaderboardRow extends BaseRow {
  value: number | null
  valueQuality: Quality | null
  velocity: number
}

interface OpportunityRow extends BaseRow {
  quality: Quality
  confidence: Confidence
  grossRevenue: number
  cost: number
  taxRateUsed: number
}

interface SupplyGapRow extends OpportunityRow {
  unitsForSale: number
  listingsCount: number
  velocity: number
  daysOfSupply: number | null
  avgSalePrice: number
  unmetDemandPerDay: number
}

interface ArbitrageRow extends OpportunityRow {
  buyWorldId: number
  buyWorldName: string
  buyPrice: number
  homeSalePrice: number
  velocity: number
  sameDataCenter: boolean
}

interface CraftIngredient {
  itemId: number
  qty: number
  unitPrice: number
  estimated: boolean
  crafted: boolean
}

interface CraftRow extends OpportunityRow {
  recipeId: number
  resultQty: number
  craftType: string | null
  jobLevel: number | null
  resultUnitPrice: number
  velocity: number
  ingredients: CraftIngredient[]
}

interface ScanResponse {
  world: string
  dataCenter: string
  status: Status
  throttled: boolean
  nextRefreshAt: string | null
  scannedAt: string | null
  refreshError: string | null
  refreshing: boolean
  taxRates: Record<string, number>
  shortlistSize: number
  recipesAvailable: boolean
  bestSellers: LeaderboardRow[]
  mostValuable: LeaderboardRow[]
  supplyGaps: SupplyGapRow[]
  arbitrage: ArbitrageRow[]
  craftingProfits: CraftRow[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 8000
const MAX_POLL_ATTEMPTS = 20
const DEFAULT_TAX_RATE = 0.05

/** Plain-language copy for each machine-readable penalty code. */
const PENALTY_LABELS: Record<string, { short: string; detail: string }> = {
  stale_region_source: {
    short: "Stale seller data",
    detail: "The seller world's prices were uploaded well before your home world's — the listing may be long gone.",
  },
  unknown_region_freshness: {
    short: "Unverified seller data",
    detail: "We couldn't confirm how fresh the seller world's data is.",
  },
  low_sale_count: {
    short: "Few sales",
    detail: "Under about four sales in the sampled window, so the rate is noisy.",
  },
  thin_listings: {
    short: "Thin market",
    detail: "One or two sellers control the entire price.",
  },
  outlier_listing_rejected: {
    short: "Outlier ignored",
    detail: "An implausibly high listing was excluded from the maths.",
  },
  estimated_ingredient_price: {
    short: "Estimated cost",
    detail: "No current listing, so a historical average was used instead.",
  },
  partial_batch: {
    short: "Partial data",
    detail: "Some requests for this item failed during the scan.",
  },
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const gil = (n: number | null) => (n == null ? "—" : `${Math.round(n).toLocaleString()}`)
const rate = (n: number) => n.toFixed(n < 10 ? 1 : 0)

function ItemCell({ row }: { row: BaseRow & { quality?: Quality } }) {
  return (
    <div className="flex items-center gap-2">
      {row.iconUrl ? (
        <Image src={row.iconUrl} alt="" width={28} height={28} className="rounded" unoptimized />
      ) : (
        <div className="size-7 rounded bg-muted shrink-0" />
      )}
      <span className="truncate">{row.name}</span>
      {row.quality === "hq" && (
        <Badge variant="default" className="text-[10px] shrink-0">HQ</Badge>
      )}
    </div>
  )
}

function ConfidenceChips({ confidence }: { confidence: Confidence }) {
  if (confidence.penalties.length === 0 && confidence.tier === "fresh") return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {confidence.tier === "aging" && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
          title="This data is between 24 and 72 hours old."
        >
          Aging data
        </span>
      )}
      {confidence.penalties.map((p) => {
        const label = PENALTY_LABELS[p] ?? { short: p, detail: p }
        return (
          <span
            key={p}
            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
            title={label.detail}
          >
            {label.short}
          </span>
        )
      })}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 rounded bg-muted animate-pulse" />
      ))}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{children}</p>
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) return <EmptyState>No qualifying items found on this world.</EmptyState>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-2 pr-2 font-medium w-8">#</th>
            <th className="py-2 pr-2 font-medium">Item</th>
            <th className="py-2 pr-2 font-medium text-right">Avg. price</th>
            <th className="py-2 pr-2 font-medium text-right">Sales/day</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.itemId}-${row.valueQuality}`} className="border-b border-border/50">
              <td className="py-2 pr-2 text-muted-foreground">{row.rank}</td>
              <td className="py-2 pr-2">
                <ItemCell row={{ ...row, quality: row.valueQuality ?? undefined }} />
              </td>
              <td className="py-2 pr-2 text-right">{gil(row.value)}</td>
              <td className="py-2 pr-2 text-right">{rate(row.velocity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SupplyGapTable({ rows }: { rows: SupplyGapRow[] }) {
  if (rows.length === 0) {
    return <EmptyState>No undersupplied items found. That&apos;s a normal result — tight markets are rare.</EmptyState>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-2 pr-2 font-medium w-8">#</th>
            <th className="py-2 pr-2 font-medium">Item</th>
            <th className="py-2 pr-2 font-medium text-right">Listed</th>
            <th className="py-2 pr-2 font-medium text-right">Sales/day</th>
            <th className="py-2 pr-2 font-medium text-right">Days of supply</th>
            <th className="py-2 pr-2 font-medium text-right">Avg. price</th>
            <th className="py-2 pr-2 font-medium text-right">Demand/day</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.itemId}-${row.quality}`} className="border-b border-border/50">
              <td className="py-2 pr-2 text-muted-foreground align-top">{row.rank}</td>
              <td className="py-2 pr-2">
                <ItemCell row={row} />
                <ConfidenceChips confidence={row.confidence} />
              </td>
              <td className="py-2 pr-2 text-right align-top">
                {row.unitsForSale === 0 ? (
                  <Badge variant="default" className="text-[10px]">None listed</Badge>
                ) : (
                  <span>
                    {row.unitsForSale.toLocaleString()}
                    <span className="text-muted-foreground"> / {row.listingsCount}</span>
                  </span>
                )}
              </td>
              <td className="py-2 pr-2 text-right align-top">{rate(row.velocity)}</td>
              <td className="py-2 pr-2 text-right align-top">
                {row.daysOfSupply == null ? "—" : row.daysOfSupply.toFixed(2)}
              </td>
              <td className="py-2 pr-2 text-right align-top">{gil(row.avgSalePrice)}</td>
              <td className="py-2 pr-2 text-right align-top">{gil(row.unmetDemandPerDay)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ArbitrageTable({ rows, taxRate }: { rows: ArbitrageRow[]; taxRate: number }) {
  // Net is recomputed here rather than read from the payload: the cached rows
  // were ranked at the default 5%, and a 3% home city changes both the margin
  // and the order.
  const priced = useMemo(
    () =>
      [...rows]
        .map((r) => ({ ...r, net: r.grossRevenue * (1 - taxRate) - r.cost }))
        .sort((a, b) => {
          if (b.net !== a.net) return b.net - a.net
          if (a.sameDataCenter !== b.sameDataCenter) return a.sameDataCenter ? -1 : 1
          return a.itemId - b.itemId
        }),
    [rows, taxRate]
  )

  if (priced.length === 0) {
    return <EmptyState>No profitable cross-world buys found for this world right now.</EmptyState>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-2 pr-2 font-medium w-8">#</th>
            <th className="py-2 pr-2 font-medium">Item</th>
            <th className="py-2 pr-2 font-medium">Buy from</th>
            <th className="py-2 pr-2 font-medium text-right">Buy price</th>
            <th className="py-2 pr-2 font-medium text-right">Sells here</th>
            <th className="py-2 pr-2 font-medium text-right">Net / unit</th>
            <th className="py-2 pr-2 font-medium text-right">Sales/day</th>
          </tr>
        </thead>
        <tbody>
          {priced.map((row) => (
            <tr key={`${row.itemId}-${row.quality}`} className="border-b border-border/50">
              <td className="py-2 pr-2 text-muted-foreground align-top">{row.rank}</td>
              <td className="py-2 pr-2">
                <ItemCell row={row} />
                <ConfidenceChips confidence={row.confidence} />
              </td>
              <td className="py-2 pr-2 align-top">
                <div className="flex items-center gap-1.5">
                  <span>{row.buyWorldName}</span>
                  <Badge variant={row.sameDataCenter ? "secondary" : "outline"} className="text-[10px]">
                    {row.sameDataCenter ? "Same DC" : "Cross-DC"}
                  </Badge>
                </div>
              </td>
              <td className="py-2 pr-2 text-right align-top">{gil(row.buyPrice)}</td>
              <td className="py-2 pr-2 text-right align-top">{gil(row.homeSalePrice)}</td>
              <td className="py-2 pr-2 text-right align-top font-medium">{gil(row.net)}</td>
              <td className="py-2 pr-2 text-right align-top">{rate(row.velocity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CraftTable({
  rows,
  taxRate,
  crafterLevels,
  onlyMine,
}: {
  rows: CraftRow[]
  taxRate: number
  crafterLevels: Record<string, number> | null
  onlyMine: boolean
}) {
  const priced = useMemo(() => {
    const filtered =
      onlyMine && crafterLevels
        ? rows.filter((r) => {
            if (!r.craftType) return false
            const level = crafterLevels[r.craftType]
            if (level == null) return false
            return r.jobLevel == null || r.jobLevel <= level
          })
        : rows
    return filtered
      .map((r) => ({ ...r, net: r.grossRevenue * (1 - taxRate) - r.cost }))
      .sort((a, b) => (b.net !== a.net ? b.net - a.net : a.recipeId - b.recipeId))
  }, [rows, taxRate, crafterLevels, onlyMine])

  if (priced.length === 0) {
    return (
      <EmptyState>
        {onlyMine && crafterLevels
          ? "No profitable recipes at your current crafter levels. Turn off the filter to see everything."
          : "No profitable recipes found on this world right now."}
      </EmptyState>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-2 pr-2 font-medium w-8">#</th>
            <th className="py-2 pr-2 font-medium">Craft</th>
            <th className="py-2 pr-2 font-medium">Job</th>
            <th className="py-2 pr-2 font-medium text-right">Yield</th>
            <th className="py-2 pr-2 font-medium text-right">Materials</th>
            <th className="py-2 pr-2 font-medium text-right">Sells for</th>
            <th className="py-2 pr-2 font-medium text-right">Net profit</th>
            <th className="py-2 pr-2 font-medium text-right">Sales/day</th>
          </tr>
        </thead>
        <tbody>
          {priced.map((row) => (
            <tr key={`${row.recipeId}-${row.quality}`} className="border-b border-border/50">
              <td className="py-2 pr-2 text-muted-foreground align-top">{row.rank}</td>
              <td className="py-2 pr-2">
                <ItemCell row={row} />
                <ConfidenceChips confidence={row.confidence} />
                {row.quality === "hq" && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Assumes NQ materials; does not model HQ success chance.
                  </p>
                )}
              </td>
              <td className="py-2 pr-2 align-top">
                {row.craftType ?? "—"}
                {row.jobLevel != null && (
                  <span className="text-muted-foreground"> · Lv{row.jobLevel}</span>
                )}
              </td>
              <td className="py-2 pr-2 text-right align-top">
                {row.resultQty > 1 ? `${row.resultQty}x` : "1x"}
              </td>
              <td className="py-2 pr-2 text-right align-top">{gil(row.cost)}</td>
              <td className="py-2 pr-2 text-right align-top">
                {gil(row.grossRevenue)}
                {row.resultQty > 1 && (
                  <span className="text-muted-foreground"> ({gil(row.resultUnitPrice)} ea)</span>
                )}
              </td>
              <td className="py-2 pr-2 text-right align-top font-medium">{gil(row.net)}</td>
              <td className="py-2 pr-2 text-right align-top">{rate(row.velocity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function MarketplaceScannerClient({
  defaultWorld,
  crafterLevels = null,
  characterName = null,
}: {
  defaultWorld: string | null
  /** Null when unknown — no linked character, or no cached Lodestone data. */
  crafterLevels?: Record<string, number> | null
  characterName?: string | null
}) {
  const [world, setWorld] = useState<string | null>(defaultWorld)
  const [onlyMyCrafts, setOnlyMyCrafts] = useState(true)
  const [data, setData] = useState<ScanResponse | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  // Errors are world-scoped so switching worlds clears the old one without an
  // extra setState in the effect.
  const [error, setError] = useState<{ world: string; message: string } | null>(null)
  // Keyed by city, not by rate: three cities all charge 5%, and a Select whose
  // options share a value matches every one of them, stacking all three labels
  // into the trigger.
  const [taxCity, setTaxCity] = useState<string | null>(null)
  const pollAttempts = useRef(0)

  const activeError = error && error.world === world ? error.message : null
  // Loading is derived rather than stored: if the response we hold isn't for
  // the selected world, we're still fetching it. Storing it would mean calling
  // setState synchronously in the effect body and cascading a render.
  const showingCurrentWorld = data?.world === world
  const isLoadingWorld = world != null && !showingCurrentWorld && !activeError
  // Everything the UI renders reads `view`, never `data`: on a world switch the
  // previous world's response is still in state, and showing it under the new
  // world's name would be quietly wrong.
  const view = showingCurrentWorld ? data : null

  useEffect(() => {
    if (!world) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/marketplace/leaderboard?world=${encodeURIComponent(world)}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(json.error ?? "Failed to load marketplace data")
        setError(null)
        setData(json)
        pollAttempts.current = 0
      } catch (err) {
        if (cancelled) return
        setError({ world, message: err instanceof Error ? err.message : "Failed to load marketplace data" })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [world])

  // Poll while a scan is in flight — both the first scan of a world and a
  // background refresh of a stale one.
  const inFlight = data?.status === "initializing" || data?.status === "refreshing"
  useEffect(() => {
    if (!inFlight || !world) return
    if (pollAttempts.current >= MAX_POLL_ATTEMPTS) return

    const timer = setTimeout(async () => {
      pollAttempts.current += 1
      try {
        const res = await fetch(`/api/marketplace/leaderboard?world=${encodeURIComponent(world)}`)
        const json = await res.json()
        if (res.ok) setData(json)
      } catch {
        // Transient; the next tick retries.
      }
    }, POLL_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [inFlight, data, world])

  const handleRefresh = useCallback(async () => {
    if (!world) return
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketplace/leaderboard?world=${encodeURIComponent(world)}`, {
        method: "PUT",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to refresh")
      setError(null)
      setData(json)
      pollAttempts.current = 0
    } catch (err) {
      setError({ world, message: err instanceof Error ? err.message : "Failed to refresh" })
    } finally {
      setRefreshing(false)
    }
  }, [world])

  const taxCities = useMemo(() => {
    const entries = Object.entries(view?.taxRates ?? {})
    return entries.length > 0 ? entries : null
  }, [view?.taxRates])

  // Falls back to the worst-case 5% until a city is chosen, matching the rate
  // the server ranked with.
  const taxRate = useMemo(() => {
    if (!taxCity) return DEFAULT_TAX_RATE
    const pct = view?.taxRates?.[taxCity]
    return typeof pct === "number" ? pct / 100 : DEFAULT_TAX_RATE
  }, [taxCity, view?.taxRates])

  const nextRefreshLabel = view?.nextRefreshAt
    ? new Date(view.nextRefreshAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null

  const showSkeleton = isLoadingWorld || view?.status === "initializing"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="size-6 text-primary" /> Marketplace Scanner
          </h1>
          <p className="text-sm text-muted-foreground">
            Best sellers, undersupplied items, and cross-world buys for a world&apos;s market board.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {taxCities && (
            <Select value={taxCity ?? undefined} onValueChange={setTaxCity}>
              <SelectTrigger className="w-[190px]" aria-label="Home city tax rate">
                <SelectValue placeholder={`Sell from — ${DEFAULT_TAX_RATE * 100}%`} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Sell from (tax)</SelectLabel>
                  {taxCities.map(([city, pct]) => (
                    <SelectItem key={city} value={city}>
                      {city} — {pct}%
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          <Select value={world ?? undefined} onValueChange={setWorld}>
            <SelectTrigger className="w-[200px]" aria-label="World">
              <SelectValue placeholder="Select a world" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DATA_CENTERS).map(([dc, worlds]) => (
                <SelectGroup key={dc}>
                  <SelectLabel>{dc}</SelectLabel>
                  {worlds.map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={!world || refreshing || isLoadingWorld}
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {!world && (
        <p className="text-sm text-muted-foreground">Pick a world above to scan its market board.</p>
      )}

      {activeError && <p className="text-sm text-destructive">{activeError}</p>}

      {/* "We haven't looked yet" — deliberately distinct from an empty result. */}
      {view?.status === "initializing" && (
        <p className="text-sm text-muted-foreground">
          First scan for {view.world} — this can take up to two minutes. Results appear automatically.
        </p>
      )}

      {view?.status === "failed" && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <TriangleAlert className="size-4 mt-0.5 shrink-0" />
          <span>
            The first scan for {view.world} failed{view.refreshError ? `: ${view.refreshError}` : "."}
            {view.throttled && nextRefreshLabel && ` You can retry at ${nextRefreshLabel}.`}
          </span>
        </div>
      )}

      {view?.status === "ready" && view.refreshError && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="size-4 mt-0.5 shrink-0" />
          <span>Showing the last successful scan — the most recent refresh failed.</span>
        </div>
      )}

      {view?.throttled && view.status !== "failed" && nextRefreshLabel && (
        <p className="text-sm text-muted-foreground">
          Already refreshed recently. You can force another refresh at {nextRefreshLabel}.
        </p>
      )}

      {world && view && view.status !== "failed" && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {view.scannedAt && <span>Scanned {new Date(view.scannedAt).toLocaleString()}</span>}
            {view.status === "refreshing" && <Badge variant="secondary">Updating prices…</Badge>}
            {view.shortlistSize > 0 && <span>· {view.shortlistSize} items checked for supply</span>}
          </div>

          <Tabs defaultValue="supply-gaps">
            <TabsList>
              <TabsTrigger value="supply-gaps">Supply Gaps</TabsTrigger>
              <TabsTrigger value="arbitrage">Arbitrage</TabsTrigger>
              <TabsTrigger value="crafting">Crafting</TabsTrigger>
              <TabsTrigger value="best-sellers">Best Sellers</TabsTrigger>
              <TabsTrigger value="most-valuable">Most Valuable</TabsTrigger>
            </TabsList>

            <TabsContent value="supply-gaps">
              {showSkeleton ? (
                <Skeleton />
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2 flex items-start gap-1.5">
                    <Info className="size-3.5 mt-0.5 shrink-0" />
                    Items selling steadily with little or nothing listed. Demand/day ranks the
                    opportunity — it is not a profit forecast, and prices are historical averages.
                  </p>
                  <SupplyGapTable rows={view.supplyGaps} />
                </>
              )}
            </TabsContent>

            <TabsContent value="arbitrage">
              {showSkeleton ? (
                <Skeleton />
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2 flex items-start gap-1.5">
                    <Info className="size-3.5 mt-0.5 shrink-0" />
                    Buy on another world, sell on {view.world}. You can buy while visiting any data
                    centre, but you can only sell at home. Listed prices are a snapshot and may
                    already be gone — verify travel availability before committing.
                  </p>
                  <ArbitrageTable rows={view.arbitrage} taxRate={taxRate} />
                </>
              )}
            </TabsContent>

            <TabsContent value="crafting">
              {showSkeleton ? (
                <Skeleton />
              ) : !view.recipesAvailable ? (
                <EmptyState>
                  Recipe data hasn&apos;t been loaded yet, so crafting profit can&apos;t be
                  calculated. The other tabs are unaffected.
                </EmptyState>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Info className="size-3.5 mt-0.5 shrink-0" />
                      Materials are costed at NQ prices, since HQ materials raise quality but
                      aren&apos;t required. Net profit excludes your time.
                    </p>
                    {crafterLevels ? (
                      <Button
                        variant={onlyMyCrafts ? "default" : "outline"}
                        size="sm"
                        onClick={() => setOnlyMyCrafts((v) => !v)}
                      >
                        {onlyMyCrafts
                          ? `Only ${characterName ?? "my"} crafters`
                          : "Showing all recipes"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Showing all recipes — link a character and generate its card to filter by
                        your crafter levels.
                      </span>
                    )}
                  </div>
                  <CraftTable
                    rows={view.craftingProfits}
                    taxRate={taxRate}
                    crafterLevels={crafterLevels}
                    onlyMine={onlyMyCrafts}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="best-sellers">
              {showSkeleton ? <Skeleton /> : <LeaderboardTable rows={view.bestSellers} />}
            </TabsContent>

            <TabsContent value="most-valuable">
              {showSkeleton ? <Skeleton /> : <LeaderboardTable rows={view.mostValuable} />}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
