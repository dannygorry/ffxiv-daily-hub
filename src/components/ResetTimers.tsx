"use client"

import { useEffect, useState } from "react"
import {
  formatCountdown,
  getNextDailyReset,
  getNextWeeklyReset,
  getNextJumboReset,
} from "@/lib/ffxiv/resets"
import { Card, CardContent } from "@/components/ui/card"

interface TimerEntry {
  label: string
  emoji: string
  getNext: () => Date
  color: string
}

const TIMERS: TimerEntry[] = [
  {
    label: "Daily Reset",
    emoji: "🔄",
    getNext: () => getNextDailyReset(),
    color: "text-sky-400",
  },
  {
    label: "Weekly Reset",
    emoji: "📅",
    getNext: () => getNextWeeklyReset(),
    color: "text-violet-400",
  },
  {
    label: "Jumbo Cactpot",
    emoji: "🌵",
    getNext: () => getNextJumboReset(),
    color: "text-primary",
  },
]

export function ResetTimers() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {TIMERS.map(({ label, emoji, getNext, color }) => {
        const ms = now ? getNext().getTime() - now.getTime() : 0
        return (
          <Card key={label} className="bg-card border-border">
            <CardContent className="py-4 px-5 flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">
                {emoji} {label}
              </span>
              <span className={`font-mono text-xl font-bold tabular-nums ${color}`}>
                {now ? formatCountdown(ms) : "--:--:--"}
              </span>
              <span className="text-xs text-muted-foreground">
                {now
                  ? getNext().toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })
                  : ""}
              </span>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
