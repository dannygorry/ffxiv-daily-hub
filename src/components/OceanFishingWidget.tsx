"use client"

import { useEffect, useState } from "react"
import { getNextOceanFishingWindows, formatOceanFishingCountdown, type OceanFishingWindow, type VoyageCode } from "@/lib/ffxiv/ocean-fishing"
import { cn } from "@/lib/utils"

const TIME_ICON: Record<string, string> = {
  Day: "☀️",
  Sunset: "🌅",
  Night: "🌙",
}

const VOYAGE_COLORS: Record<VoyageCode, string> = {
  N: "text-sky-300",
  R: "text-violet-300",
  B: "text-cyan-300",
  T: "text-teal-300",
}

function WindowCard({ window, now }: { window: OceanFishingWindow; now: Date }) {
  const textColor = VOYAGE_COLORS[window.voyageCode]
  return (
    <div
      className={cn(
        "flex-1 min-w-[180px] rounded-lg border p-4 space-y-2 transition-colors",
        window.boardingOpen
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border bg-card"
      )}
    >
      {window.boardingOpen && (
        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
          Boarding Now
        </div>
      )}
      <div className={cn("text-sm font-semibold leading-tight", textColor)}>
        {window.destination}
      </div>
      <div className="text-xs text-muted-foreground">
        {TIME_ICON[window.timeOfDay]} {window.timeOfDay}
      </div>
      <div className={cn("text-xs font-mono", window.boardingOpen ? "text-emerald-400" : "text-muted-foreground")}>
        {formatOceanFishingCountdown(window, now)}
      </div>
    </div>
  )
}

export function OceanFishingWidget() {
  const [state, setState] = useState<{ windows: OceanFishingWindow[]; now: Date } | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setState({ windows: getNextOceanFishingWindows(3, now), now })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!state) return null

  return (
    <div className="flex flex-wrap gap-3">
      {state.windows.map((w, i) => (
        <WindowCard key={i} window={w} now={state.now} />
      ))}
    </div>
  )
}
