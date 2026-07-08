"use client"

import { useEffect, useState, useMemo } from "react"
import {
  ZONES,
  REGIONS,
  WEATHER_ICON,
  getUpcomingWeather,
  getWeatherWindowStart,
  type WeatherWindow,
  type Zone,
} from "@/lib/ffxiv/weather"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const DEFAULT_ZONES = [
  "eastern-la-noscea",
  "upper-la-noscea",
  "coerthas-western",
  "mor-dhona",
  "azim-steppe",
  "thavnair",
]

function WeatherWindowCard({ win, isCurrent }: { win: WeatherWindow; isCurrent: boolean }) {
  const icon = WEATHER_ICON[win.weather]
  const timeStr = win.startTime.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
  return (
    <div
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-md ${
        isCurrent ? "bg-primary/15 ring-1 ring-primary/40" : "bg-secondary/40"
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium text-foreground">{win.weather}</span>
      <span className="text-[10px] text-muted-foreground">{timeStr}</span>
      {isCurrent && (
        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 mt-0.5">
          Now
        </Badge>
      )}
    </div>
  )
}

function ZoneWeather({ zone, now }: { zone: Zone; now: Date }) {
  const windows = useMemo(() => getUpcomingWeather(zone, now, 4), [zone, now])
  const currentWindowStart = getWeatherWindowStart(now)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold text-foreground">{zone.name}</CardTitle>
        <p className="text-xs text-muted-foreground">{zone.region}</p>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="flex gap-2 flex-wrap">
          {windows.map((w, i) => (
            <WeatherWindowCard
              key={i}
              win={w}
              isCurrent={w.startTime.getTime() === currentWindowStart.getTime()}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function WeatherWidget() {
  const [now, setNow] = useState<Date | null>(null)
  const [selectedZones, setSelectedZones] = useState<string[]>(DEFAULT_ZONES)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])

  const zones = useMemo(
    () => ZONES.filter((z) => selectedZones.includes(z.id)),
    [selectedZones]
  )

  if (!now) return <div className="text-muted-foreground text-sm">Loading weather...</div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {ZONES.filter((z) => DEFAULT_ZONES.includes(z.id)).map((z) => (
          <button
            key={z.id}
            onClick={() =>
              setSelectedZones((prev) =>
                prev.includes(z.id)
                  ? prev.filter((id) => id !== z.id)
                  : [...prev, z.id]
              )
            }
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              selectedZones.includes(z.id)
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {z.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {zones.map((zone) => (
          <ZoneWeather key={zone.id} zone={zone} now={now} />
        ))}
      </div>
    </div>
  )
}
