"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CUSTOM_DELIVERY_CLIENTS,
  DISPLAY_GROUPS,
  DELIVERIES_PER_CLIENT,
  WEEKLY_DELIVERY_CAP,
  SATISFACTION_COLORS,
  SATISFACTION_LABELS,
  maskToDeliveryCount,
  type CustomDeliveryClient,
} from "@/lib/ffxiv/custom-deliveries"
import { getWeeklyResetPeriod } from "@/lib/ffxiv/resets"
import { useSpoilerSettings } from "@/hooks/useSpoilerSettings"
import { isExpansionHidden, type ExpansionId } from "@/lib/spoiler"

interface ClientProgress {
  client_key: string
  satisfaction_level: number
  deliveries_mask: number
  delivery_period: string
}

// ─── Individual client card ───────────────────────────────────────────────────

function ClientCard({
  client,
  progress,
  period,
  onDeliveryToggle,
  onSatisfactionUp,
  onSatisfactionDown,
}: {
  client: CustomDeliveryClient
  progress: ClientProgress
  period: string
  onDeliveryToggle: (clientKey: string, bit: number, value: boolean) => void
  onSatisfactionUp: (clientKey: string) => void
  onSatisfactionDown: (clientKey: string) => void
}) {
  const currentMask = progress.delivery_period === period ? progress.deliveries_mask : 0
  const deliveryCount = maskToDeliveryCount(currentMask)
  const allDone = deliveryCount >= DELIVERIES_PER_CLIENT
  const isMaxSatisfaction = progress.satisfaction_level >= client.maxSatisfaction
  const isMinSatisfaction = progress.satisfaction_level <= 1
  const satisfactionLabel = SATISFACTION_LABELS[progress.satisfaction_level] ?? `Level ${progress.satisfaction_level}`
  const satisfactionColor = SATISFACTION_COLORS[progress.satisfaction_level] ?? "bg-secondary text-secondary-foreground"

  return (
    <div className={cn(
      "rounded-lg border border-border bg-card/60 p-3.5 space-y-3 min-w-0",
      allDone && "border-border/50 opacity-80"
    )}>
      {/* Name + badge on left, level controls on right */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 min-w-0">
          <p className="text-sm font-semibold leading-tight">{client.name}</p>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
              satisfactionColor
            )}>
              {satisfactionLabel}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {progress.satisfaction_level}/{client.maxSatisfaction}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSatisfactionUp(client.key)}
            disabled={isMaxSatisfaction}
            className="h-6 px-1.5 text-[10px]"
          >
            Level +
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSatisfactionDown(client.key)}
            disabled={isMinSatisfaction}
            className="h-6 px-1.5 text-[10px]"
          >
            Level −
          </Button>
        </div>
      </div>

      {/* Delivery checkboxes */}
      <div className="flex items-center gap-3 flex-wrap">
        {[0, 1, 2, 3, 4, 5].map((bit) => {
          const checked = Boolean((currentMask >> bit) & 1)
          const disabled = !checked && allDone
          return (
            <label
              key={bit}
              className={cn(
                "flex flex-col items-center gap-1.5 cursor-pointer",
                disabled && "cursor-not-allowed opacity-40"
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(val) => onDeliveryToggle(client.key, bit, Boolean(val))}
                className="size-5"
              />
              <span className="text-xs text-muted-foreground leading-none font-medium">{bit + 1}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main grid ────────────────────────────────────────────────────────────────

export function CustomDeliveriesGrid({
  characterId,
  onDeliveriesRemainingChange,
}: {
  characterId: string
  onDeliveriesRemainingChange?: (remaining: number) => void
}) {
  const period = getWeeklyResetPeriod()
  const { hidden } = useSpoilerSettings()
  const visibleClients = CUSTOM_DELIVERY_CLIENTS.filter(
    (c) => !isExpansionHidden(c.expansion as ExpansionId, hidden)
  )
  const visibleGroups = DISPLAY_GROUPS.filter((g) =>
    visibleClients.some((c) => c.displayGroup === g.id)
  )

  const [progressMap, setProgressMap] = useState<Record<string, ClientProgress>>({})
  const [loading, setLoading] = useState(true)

  const latestProgressRef = useRef<Record<string, ClientProgress>>({})
  const committedProgressRef = useRef<Record<string, ClientProgress>>({})
  const satisfactionTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/custom-deliveries?characterId=${characterId}&period=${encodeURIComponent(period)}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    const map: Record<string, ClientProgress> = {}
    for (const row of data.progress as ClientProgress[]) map[row.client_key] = row
    for (const client of CUSTOM_DELIVERY_CLIENTS) {
      if (!map[client.key]) {
        map[client.key] = { client_key: client.key, satisfaction_level: 1, deliveries_mask: 0, delivery_period: "" }
      }
    }
    latestProgressRef.current = map
    committedProgressRef.current = { ...map }
    setProgressMap(map)
    setLoading(false)
  }, [characterId, period])

  useEffect(() => { load() }, [load])

  const totalDeliveriesDone = visibleClients.reduce((sum, client) => {
    const prog = progressMap[client.key]
    const currentMask = prog?.delivery_period === period ? (prog.deliveries_mask ?? 0) : 0
    return sum + maskToDeliveryCount(currentMask)
  }, 0)

  useEffect(() => {
    if (!loading) {
      onDeliveriesRemainingChange?.(Math.max(0, WEEKLY_DELIVERY_CAP - totalDeliveriesDone))
    }
  }, [totalDeliveriesDone, loading, onDeliveriesRemainingChange])

  const handleDeliveryToggle = useCallback(
    async (clientKey: string, bit: number, value: boolean) => {
      const prev = latestProgressRef.current[clientKey]
      const prevMask = prev.delivery_period === period ? prev.deliveries_mask : 0
      const newMask = value ? prevMask | (1 << bit) : prevMask & ~(1 << bit)
      const updated = { ...prev, deliveries_mask: newMask, delivery_period: period }

      latestProgressRef.current = { ...latestProgressRef.current, [clientKey]: updated }
      setProgressMap((p) => ({ ...p, [clientKey]: updated }))

      const res = await fetch("/api/custom-deliveries/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, clientKey, deliveryMask: newMask, period }),
      })
      if (!res.ok) {
        latestProgressRef.current = { ...latestProgressRef.current, [clientKey]: prev }
        setProgressMap((p) => ({ ...p, [clientKey]: prev }))
      } else {
        committedProgressRef.current = { ...committedProgressRef.current, [clientKey]: updated }
      }
    },
    [characterId, period]
  )

  const handleSatisfactionChange = useCallback(
    (clientKey: string, delta: 1 | -1) => {
      const current = latestProgressRef.current[clientKey]
      const client = CUSTOM_DELIVERY_CLIENTS.find((c) => c.key === clientKey)!
      const newLevel = Math.min(Math.max(current.satisfaction_level + delta, 1), client.maxSatisfaction)
      if (newLevel === current.satisfaction_level) return

      const updated = { ...current, satisfaction_level: newLevel }
      latestProgressRef.current = { ...latestProgressRef.current, [clientKey]: updated }
      setProgressMap((p) => ({ ...p, [clientKey]: updated }))

      clearTimeout(satisfactionTimerRef.current[clientKey])
      satisfactionTimerRef.current[clientKey] = setTimeout(async () => {
        const finalLevel = latestProgressRef.current[clientKey]?.satisfaction_level
        if (finalLevel == null) return

        const res = await fetch("/api/custom-deliveries/satisfaction-set", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId, clientKey, satisfactionLevel: finalLevel }),
        })
        if (res.ok) {
          committedProgressRef.current = {
            ...committedProgressRef.current,
            [clientKey]: latestProgressRef.current[clientKey],
          }
        } else {
          const committed = committedProgressRef.current[clientKey]
          if (committed) {
            latestProgressRef.current = { ...latestProgressRef.current, [clientKey]: committed }
            setProgressMap((p) => ({ ...p, [clientKey]: committed }))
          }
        }
      }, 600)
    },
    [characterId]
  )

  useEffect(() => {
    return () => { Object.values(satisfactionTimerRef.current).forEach(clearTimeout) }
  }, [])

  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">Loading custom delivery data…</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold">Custom Deliveries</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track your 6 weekly deliveries per client and satisfaction progress
        </p>
      </div>

      {/* Expansion columns */}
      <div className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="flex gap-4">
          {visibleGroups.map((group) => {
            const clients = visibleClients.filter((c) => c.displayGroup === group.id)
            return (
              <div key={group.id} className="flex flex-col gap-3 w-[240px]">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </p>
                {clients.map((client) => (
                  <ClientCard
                    key={client.key}
                    client={client}
                    progress={progressMap[client.key]}
                    period={period}
                    onDeliveryToggle={handleDeliveryToggle}
                    onSatisfactionUp={(key) => handleSatisfactionChange(key, 1)}
                    onSatisfactionDown={(key) => handleSatisfactionChange(key, -1)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
