"use client"

import { useEffect, useState } from "react"
import { getEorzeaTime } from "@/lib/ffxiv/weather"

export function EorzeaClock() {
  const [time, setTime] = useState<{ hours: number; minutes: number; seconds: number } | null>(null)

  useEffect(() => {
    const tick = () => setTime(getEorzeaTime(new Date()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return <span className="font-mono text-primary text-xl">--:--:--</span>

  const pad = (n: number) => String(n).padStart(2, "0")
  const period = time.hours >= 12 ? "ET" : "ET"
  const h12 = time.hours % 12 || 12
  const isDay = time.hours >= 6 && time.hours < 20

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
        Eorzea Time {isDay ? "☀️" : "🌙"}
      </span>
      <span className="font-mono text-primary text-2xl font-bold tabular-nums">
        {pad(h12)}:{pad(time.minutes)}:{pad(time.seconds)} {period}
      </span>
      <span className="font-mono text-muted-foreground text-sm tabular-nums">
        ({pad(time.hours)}:{pad(time.minutes)} / 24h)
      </span>
    </div>
  )
}
