"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  getNextOceanFishingWindows,
  formatOceanFishingCountdown,
  VOYAGES,
  RUBY_VOYAGES,
  type OceanFishingWindow,
  type ZoneStop,
  type VoyageCode,
} from "@/lib/ffxiv/ocean-fishing"

// ─── Shared constants ─────────────────────────────────────────────────────────

const TIME_ICON: Record<string, string> = { Day: "☀️", Sunset: "🌅", Night: "🌙" }

const INDIGO_COLORS: Record<VoyageCode, { text: string; border: string; bg: string }> = {
  N: { text: "text-sky-300",    border: "border-sky-500/30",    bg: "bg-sky-500/5"    },
  R: { text: "text-violet-300", border: "border-violet-500/30", bg: "bg-violet-500/5" },
  B: { text: "text-cyan-300",   border: "border-cyan-500/30",   bg: "bg-cyan-500/5"   },
  T: { text: "text-teal-300",   border: "border-teal-500/30",   bg: "bg-teal-500/5"   },
}

const RUBY_COLOR = { text: "text-rose-300", border: "border-rose-500/30", bg: "bg-rose-500/5" }

// ─── Shared components ────────────────────────────────────────────────────────

function ZoneCard({ zone, index }: { zone: ZoneStop; index: number }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center size-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0">
          {index + 1}
        </span>
        <span className="text-sm font-semibold">{zone.zoneName}</span>
      </div>

      <div className="space-y-1 pl-7">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Spectral Current
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>
            Trigger bait:{" "}
            <span className="font-semibold text-amber-300">{zone.spectralBait}</span>
          </span>
          <span>
            Spectral fish:{" "}
            <span className="font-semibold text-emerald-300">{zone.spectralFish}</span>
          </span>
        </div>
      </div>

      {zone.intuitionFish && (
        <div className="pl-7 rounded-md bg-amber-500/10 border border-amber-500/20 p-2.5 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
            Fisher&apos;s Intuition — {zone.intuitionFish}
          </div>
          <div className="text-xs text-muted-foreground">
            Bait: <span className="font-semibold text-foreground">{zone.intuitionBait}</span>
          </div>
          {zone.intuitionNote && (
            <div className="text-xs text-amber-300/80">{zone.intuitionNote}</div>
          )}
        </div>
      )}

      {zone.bonusFish && zone.bonusFish.length > 0 && (
        <div className="space-y-1.5 pl-7">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Side Objectives
          </div>
          <div className="space-y-1.5">
            {zone.bonusFish.map((bf, i) => (
              <div key={i}>
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-semibold text-violet-300 shrink-0">{bf.category}</span>
                  <span className="text-muted-foreground/50">—</span>
                  <span className="text-amber-300">{bf.bait}</span>
                </div>
                <div className="text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed">
                  {bf.fish.join(', ')}
                  {bf.note && <span className="ml-1 text-amber-400/50"> · {bf.note}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface GuideProps {
  routeLabel: string
  destination: string
  stops: [ZoneStop, ZoneStop, ZoneStop]
  colors: { text: string; border: string; bg: string }
  timeOfDay?: string
  departure?: Date
  boardingOpen?: boolean
}

function VoyageGuidePanel({
  routeLabel, destination, stops, colors, timeOfDay, departure, boardingOpen,
}: GuideProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className={cn("text-xl font-bold", colors.text)}>
            {routeLabel} — {destination}
          </h2>
          {boardingOpen && (
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Boarding Open
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {timeOfDay ? (
            <>
              {TIME_ICON[timeOfDay]} {timeOfDay}
              {departure && (
                <>
                  {" · Departs "}
                  {departure.toLocaleString([], {
                    weekday: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
                  })}
                </>
              )}
            </>
          ) : (
            "Departs alongside Indigo Route every 2 hours"
          )}
        </p>
      </div>

      <div className={cn("rounded-lg border p-4 space-y-2", colors.border, colors.bg)}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Bait Summary
        </p>
        <div className="flex flex-col gap-1">
          {stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground/60 w-3 text-center">{i + 1}</span>
              <span className="text-muted-foreground min-w-[180px] truncate">{stop.zoneName}</span>
              <span className="text-amber-300 font-medium">{stop.spectralBait}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Zone Guide
        </p>
        {stops.map((stop, i) => (
          <ZoneCard key={i} zone={stop} index={i} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border/40 pt-4">
        Data from community research — verify at{" "}
        <a href="https://ffxiv.pf-n.co/ocean-fishing" target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors">
          ffxiv.pf-n.co
        </a>
        {" "}or{" "}
        <a href="https://ffxivteamcraft.com/fishing/ocean-fishing" target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors">
          Teamcraft
        </a>
      </p>
    </div>
  )
}

// ─── Shared departure sidebar entry ───────────────────────────────────────────

function DepartureEntry({
  label, labelColor, timeOfDay, window, now, selected, onClick,
}: {
  label: string
  labelColor: string
  timeOfDay: string
  window: OceanFishingWindow
  now: Date
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-3.5 transition-colors space-y-1.5 cursor-pointer",
        selected ? "border-primary/50 bg-primary/5" : "border-border bg-card/60 hover:bg-accent/30",
        window.boardingOpen && "border-emerald-500/40 bg-emerald-500/5",
      )}
    >
      {window.boardingOpen && (
        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
          Boarding Now
        </div>
      )}
      <div className={cn("text-sm font-semibold leading-snug", labelColor)}>
        {label}
      </div>
      <div className="text-xs text-muted-foreground">
        {TIME_ICON[timeOfDay]} {timeOfDay}
      </div>
      <div className={cn("text-xs font-mono", window.boardingOpen ? "text-emerald-400" : "text-muted-foreground")}>
        {formatOceanFishingCountdown(window, now)}
      </div>
      <div className="text-[10px] text-muted-foreground/60">
        {window.departure.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        {" · "}
        {window.departure.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
      </div>
    </button>
  )
}

// ─── Indigo tab ───────────────────────────────────────────────────────────────

function IndigoTab({ windows, now }: { windows: OceanFishingWindow[]; now: Date }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const sel = windows[selectedIndex] ?? windows[0]
  const voyage = VOYAGES[sel.voyageCode]
  const colors = INDIGO_COLORS[sel.voyageCode]

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-60 shrink-0 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Upcoming Departures
        </p>
        {windows.map((w, i) => (
          <DepartureEntry
            key={i}
            label={VOYAGES[w.voyageCode].destination}
            labelColor={INDIGO_COLORS[w.voyageCode].text}
            timeOfDay={w.timeOfDay}
            window={w}
            now={now}
            selected={i === selectedIndex}
            onClick={() => setSelectedIndex(i)}
          />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <VoyageGuidePanel
          routeLabel="Indigo Route"
          destination={voyage.destination}
          stops={voyage.stops}
          colors={colors}
          timeOfDay={sel.timeOfDay}
          departure={sel.departure}
          boardingOpen={sel.boardingOpen}
        />
      </div>
    </div>
  )
}

// ─── Ruby tab ─────────────────────────────────────────────────────────────────

function RubyTab({ windows, now }: { windows: OceanFishingWindow[]; now: Date }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const sel = windows[selectedIndex] ?? windows[0]
  const rubyVoyage = RUBY_VOYAGES[sel.rubyVoyageIndex % 3]

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-60 shrink-0 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Upcoming Departures
        </p>
        {windows.map((w, i) => (
          <DepartureEntry
            key={i}
            label={RUBY_VOYAGES[w.rubyVoyageIndex % 3].destination}
            labelColor={RUBY_COLOR.text}
            timeOfDay={w.timeOfDay}
            window={w}
            now={now}
            selected={i === selectedIndex}
            onClick={() => setSelectedIndex(i)}
          />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <VoyageGuidePanel
          routeLabel="Ruby Route"
          destination={rubyVoyage.destination}
          stops={rubyVoyage.stops}
          colors={RUBY_COLOR}
          timeOfDay={sel.timeOfDay}
          departure={sel.departure}
          boardingOpen={sel.boardingOpen}
        />
      </div>
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

export function OceanFishingClient() {
  const [state, setState] = useState<{ windows: OceanFishingWindow[]; now: Date } | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setState({ windows: getNextOceanFishingWindows(6, now), now })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!state) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading schedule…</div>
  }

  return (
    <Tabs defaultValue="indigo" className="space-y-6">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="indigo" className="flex-1 sm:flex-none">Indigo Route</TabsTrigger>
        <TabsTrigger value="ruby" className="flex-1 sm:flex-none">Ruby Route</TabsTrigger>
      </TabsList>

      <TabsContent value="indigo">
        <IndigoTab windows={state.windows} now={state.now} />
      </TabsContent>

      <TabsContent value="ruby">
        <RubyTab windows={state.windows} now={state.now} />
      </TabsContent>
    </Tabs>
  )
}
