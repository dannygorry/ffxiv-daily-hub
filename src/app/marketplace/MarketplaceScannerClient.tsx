"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { RefreshCw, Coins } from "lucide-react"
import { DATA_CENTERS } from "@/lib/ffxiv/xivapi"

interface LeaderboardRow {
  itemId: number
  rank: number
  name: string
  iconUrl: string | null
  nqAvgPrice: number | null
  hqAvgPrice: number | null
  value: number | null
  valueQuality: "nq" | "hq" | null
  velocity: number
}

interface LeaderboardResponse {
  world: string
  dataCenter: string
  scannedAt: string
  stale: boolean
  refreshing: boolean
  minVelocityThreshold: number
  bestSellers: LeaderboardRow[]
  mostValuable: LeaderboardRow[]
}

// A background rescan of a world takes ~50-90s (measured live against the real
// ~16,800-item marketable catalog), so the poll window needs to comfortably outlast that.
const POLL_INTERVAL_MS = 8000
const MAX_POLL_ATTEMPTS = 15

function formatGil(n: number | null): string {
  if (n == null) return "—"
  return Math.round(n).toLocaleString()
}

function formatVelocity(n: number): string {
  return n.toFixed(1)
}

function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No qualifying items found.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-2 font-medium">Item</th>
            <th className="py-2 pr-2 font-medium text-right">Avg. price</th>
            <th className="py-2 pr-2 font-medium text-right">Sales/day</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemId} className="border-b border-border/50">
              <td className="py-2 pr-2 text-muted-foreground">{row.rank}</td>
              <td className="py-2 pr-2">
                <div className="flex items-center gap-2">
                  {row.iconUrl ? (
                    <Image src={row.iconUrl} alt="" width={28} height={28} className="rounded" unoptimized />
                  ) : (
                    <div className="size-7 rounded bg-muted shrink-0" />
                  )}
                  <span>{row.name}</span>
                </div>
              </td>
              <td className="py-2 pr-2 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span>{formatGil(row.value)} gil</span>
                  {row.valueQuality && (
                    <Badge variant={row.valueQuality === "hq" ? "default" : "secondary"} className="text-[10px]">
                      {row.valueQuality.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </td>
              <td className="py-2 pr-2 text-right">{formatVelocity(row.velocity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 rounded bg-muted animate-pulse" />
      ))}
    </div>
  )
}

export function MarketplaceScannerClient({ defaultWorld }: { defaultWorld: string | null }) {
  const [world, setWorld] = useState<string | null>(defaultWorld)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollAttempts = useRef(0)

  const load = useCallback(async (targetWorld: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketplace/leaderboard?world=${encodeURIComponent(targetWorld)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load marketplace data")
      setData(json)
      pollAttempts.current = 0
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marketplace data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (world) load(world)
  }, [world, load])

  // Stale-while-revalidate: if the server is refreshing this world's cache in
  // the background, poll a few times until it flips to fresh.
  useEffect(() => {
    if (!data?.refreshing || !world) return
    if (pollAttempts.current >= MAX_POLL_ATTEMPTS) return

    const timer = setTimeout(async () => {
      pollAttempts.current += 1
      try {
        const res = await fetch(`/api/marketplace/leaderboard?world=${encodeURIComponent(world)}`)
        const json = await res.json()
        if (res.ok) setData(json)
      } catch {
        // Ignore — will retry on the next poll tick, or give up after MAX_POLL_ATTEMPTS.
      }
    }, POLL_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [data?.refreshing, world])

  const handleRefresh = useCallback(async () => {
    if (!world) return
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketplace/leaderboard?world=${encodeURIComponent(world)}`, {
        method: "PUT",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to refresh marketplace data")
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh marketplace data")
    } finally {
      setRefreshing(false)
    }
  }, [world])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="size-6 text-primary" /> Marketplace Scanner
          </h1>
          <p className="text-sm text-muted-foreground">
            Best-selling and most valuable items on a world&apos;s market board.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={world ?? undefined} onValueChange={setWorld}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select a world" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DATA_CENTERS).map(([dc, worlds]) => (
                <SelectGroup key={dc}>
                  <SelectLabel>{dc}</SelectLabel>
                  {worlds.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={!world || refreshing || loading}
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {!world && (
        <p className="text-sm text-muted-foreground">Pick a world above to see its marketplace leaderboards.</p>
      )}

      {loading && !data && (
        <p className="text-sm text-muted-foreground">
          Scanning the market board for the first time on this world — this can take up to a minute.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {world && (
        <>
          {data && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Scanned {new Date(data.scannedAt).toLocaleString()}</span>
              {data.refreshing && <Badge variant="secondary">Updating prices…</Badge>}
            </div>
          )}

          <Tabs defaultValue="best-sellers">
            <TabsList>
              <TabsTrigger value="best-sellers">Best Sellers</TabsTrigger>
              <TabsTrigger value="most-valuable">Most Valuable</TabsTrigger>
            </TabsList>
            <TabsContent value="best-sellers">
              {loading || !data ? <LeaderboardSkeleton /> : <LeaderboardTable rows={data.bestSellers} />}
            </TabsContent>
            <TabsContent value="most-valuable">
              {loading || !data ? (
                <LeaderboardSkeleton />
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    Only items selling at least {data.minVelocityThreshold.toFixed(1)}/day qualify, so a single rare
                    flip can&apos;t dominate the list.
                  </p>
                  <LeaderboardTable rows={data.mostValuable} />
                </>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
