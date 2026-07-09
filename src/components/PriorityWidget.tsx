"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { getNextDailyReset, formatCountdown } from "@/lib/ffxiv/resets"

interface PriorityWidgetProps {
  dailyRemaining: number
  weeklyRemaining: number
  miniCactpotRemaining: number
  beastTribesRemaining: number | null
  deliveriesRemaining: number | null
}

function Divider() {
  return <div className="hidden sm:block h-4 w-px bg-border" />
}

function CountPill({
  value,
  label,
  color,
}: {
  value: number | null
  label: string
  color: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`font-mono font-bold text-lg tabular-nums ${color}`}>
        {value ?? "--"}
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

export function PriorityWidget({
  dailyRemaining,
  weeklyRemaining,
  miniCactpotRemaining,
  beastTribesRemaining,
  deliveriesRemaining,
}: PriorityWidgetProps) {
  const [countdown, setCountdown] = useState("")
  const [urgentCactpot, setUrgentCactpot] = useState(false)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const next = getNextDailyReset(now)
      const ms = next.getTime() - now.getTime()
      setCountdown(formatCountdown(ms))
      setUrgentCactpot(miniCactpotRemaining > 0 && ms < 30 * 60 * 1000)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [miniCactpotRemaining])

  return (
    <Card className="border-border">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3 px-4">
        <CountPill
          value={dailyRemaining}
          label={dailyRemaining === 1 ? "daily task left" : "daily tasks left"}
          color={dailyRemaining === 0 ? "text-emerald-400" : "text-amber-400"}
        />

        <Divider />

        <CountPill
          value={weeklyRemaining}
          label={weeklyRemaining === 1 ? "weekly task left" : "weekly tasks left"}
          color={weeklyRemaining === 0 ? "text-emerald-400" : "text-sky-400"}
        />

        {beastTribesRemaining !== null && (
          <>
            <Divider />
            <CountPill
              value={beastTribesRemaining}
              label="beast tribe quests left"
              color={beastTribesRemaining === 0 ? "text-emerald-400" : "text-violet-400"}
            />
          </>
        )}

        {deliveriesRemaining !== null && (
          <>
            <Divider />
            <CountPill
              value={deliveriesRemaining}
              label={deliveriesRemaining === 1 ? "delivery left" : "deliveries left"}
              color={deliveriesRemaining === 0 ? "text-emerald-400" : "text-orange-400"}
            />
          </>
        )}

        <Divider />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Reset in</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {countdown || "--:--:--"}
          </span>
        </div>

        {urgentCactpot && (
          <>
            <Divider />
            <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-1">
              <span className="text-sm">⚠️</span>
              <span className="text-xs font-medium text-amber-400">
                Mini Cactpot — {miniCactpotRemaining}{" "}
                {miniCactpotRemaining === 1 ? "ticket" : "tickets"} left, resets soon!
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
