"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { RELIC_TRACKS, ARMOR_GEAR_SETS, type RelicTrack } from "@/lib/ffxiv/relics"
import { JOB_ABBREVIATIONS, JOB_CLASS_IDS, JOB_ROLES, type JobRole } from "@/lib/ffxiv/ffxiv-jobs"

type ProgressMap = Record<string, string[]>
type RelicJob = RelicTrack["jobs"][number]

function pKey(e: string, c: string, j: string) {
  return `${e}:${c}:${j}`
}

function effCompleted(raw: string[], steps: { key: string }[]): string[] {
  if (!raw.length || raw.length === steps.length) return raw
  const s = new Set(raw)
  let hi = -1
  for (let i = steps.length - 1; i >= 0; i--) {
    if (s.has(steps[i].key)) { hi = i; break }
  }
  return hi <= 0 ? raw : steps.slice(0, hi + 1).map((r) => r.key)
}

const ROLE_TEXT: Record<JobRole | "none", string> = {
  tank: "text-sky-400",
  healer: "text-emerald-400",
  melee: "text-red-400",
  physical_ranged: "text-red-400",
  magical_ranged: "text-red-400",
  crafter: "text-orange-400",
  gatherer: "text-teal-400",
  limited: "text-pink-400",
  none: "text-foreground",
}

// Weapon item icon per expansion:stage — shows the weapon's visual form at that stage.
// Icon path format: https://xivapi.com/i/{folder}/{id}.png
// ARR/HW/SB/ShB/EW icons verified against XIVAPI; DT uses beta.xivapi.com (newer items).
const STAGE_ICONS: Record<string, string> = {
  // ARR — Zodiac Weapons (PLD: Curtana → Excalibur → Excalibur Zeta)
  "arr:weapon:Relic":               "https://xivapi.com/i/030000/030446.png",
  "arr:weapon:Zenith":              "https://xivapi.com/i/030000/030446.png",
  "arr:weapon:Atma":                "https://xivapi.com/i/030000/030486.png",
  "arr:weapon:Animus":              "https://xivapi.com/i/030000/030486.png",
  "arr:weapon:Novus":               "https://xivapi.com/i/030000/030486.png",
  "arr:weapon:Nexus":               "https://xivapi.com/i/030000/030486.png",
  "arr:weapon:Zodiac":              "https://xivapi.com/i/030000/030515.png",
  "arr:weapon:Zeta":                "https://xivapi.com/i/030000/030515.png",
  "arr:weapon:Kettle to the Mettle":"https://xivapi.com/i/030000/030515.png",
  // HW — Anima Weapons (PLD: Hauteclaire → Almace → Aettir → Aettir Lux)
  "hw:weapon:Animated":             "https://xivapi.com/i/030000/030520.png",
  "hw:weapon:Awoken":               "https://xivapi.com/i/030000/030520.png",
  "hw:weapon:Anima":                "https://xivapi.com/i/030000/030537.png",
  "hw:weapon:Hyperconductive":      "https://xivapi.com/i/030000/030537.png",
  "hw:weapon:Reconditioned":        "https://xivapi.com/i/030000/030545.png",
  "hw:weapon:Sharpened":            "https://xivapi.com/i/030000/030545.png",
  "hw:weapon:Complete":             "https://xivapi.com/i/030000/030551.png",
  "hw:weapon:Lux":                  "https://xivapi.com/i/030000/030552.png",
  // SB — Eurekan Weapons (PLD: Galatyn → Antea → Antea Physeos)
  "sb:weapon:Anemos":               "https://xivapi.com/i/030000/030575.png",
  "sb:weapon:Pagos":                "https://xivapi.com/i/030000/030586.png",
  "sb:weapon:Pyros":                "https://xivapi.com/i/030000/030586.png",
  "sb:weapon:Hydatos":              "https://xivapi.com/i/030000/030598.png",
  "sb:weapon:Baldesion Arsenal":    "https://xivapi.com/i/030000/030598.png",
  // ShB — Resistance Weapons (PLD: Honorbound → Law's Order → Blade's)
  "shb:weapon:Resistance":          "https://xivapi.com/i/030000/030620.png",
  "shb:weapon:Augmented":           "https://xivapi.com/i/030000/030620.png",
  "shb:weapon:Recollection":        "https://xivapi.com/i/030000/030620.png",
  "shb:weapon:Law's Order":         "https://xivapi.com/i/030000/030629.png",
  "shb:weapon:Blade's":             "https://xivapi.com/i/030000/030633.png",
  // EW — Manderville Weapons (each stage has a unique icon)
  "ew:weapon:Manderville":          "https://xivapi.com/i/030000/030654.png",
  "ew:weapon:Amazing":              "https://xivapi.com/i/030000/030660.png",
  "ew:weapon:Majestic":             "https://xivapi.com/i/030000/030665.png",
  "ew:weapon:Mandervillous":        "https://xivapi.com/i/030000/030670.png",
  // DT — Phantom Weapons (sequential icon IDs, newer items)
  "dt:weapon:Penumbrae":            "https://xivapi.com/i/030000/030694.png",
  "dt:weapon:Umbrae":               "https://beta.xivapi.com/api/1/asset/ui/icon/030000/030695_hr1.tex?format=png",
  "dt:weapon:Obscurum":             "https://beta.xivapi.com/api/1/asset/ui/icon/030000/030696_hr1.tex?format=png",
  "dt:weapon:Obscurum+":            "https://beta.xivapi.com/api/1/asset/ui/icon/030000/030696_hr1.tex?format=png",
  // Tools (expansion-level representative; WVR needle)
  "arr:tool":   "https://xivapi.com/i/035000/035512.png",
  "hw:tool":    "https://xivapi.com/i/035000/035501.png",
  "ew:tool":    "https://xivapi.com/i/039000/039502.png",
  "dt:tool":    "https://beta.xivapi.com/api/1/asset/ui/icon/039000/039513_hr1.tex?format=png",
}

function stageIconUrl(expansionKey: string, category: string, stage: string): string {
  return (
    STAGE_ICONS[`${expansionKey}:${category}:${stage}`] ??
    STAGE_ICONS[`${expansionKey}:${category}`] ??
    ""
  )
}

function ItemIcon({ url, size = 24 }: { url: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className="rounded mx-auto"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  )
}

function JobIcon({ jobName, size = 20 }: { jobName: string; size?: number }) {
  const abbr = JOB_ABBREVIATIONS[jobName]
  const role = ((JOB_ROLES[jobName] ?? "none") as JobRole | "none")
  const [failed, setFailed] = useState(false)
  const id = JOB_CLASS_IDS[jobName]

  if (!id || failed) {
    return (
      <span className={cn("text-[9px] font-bold leading-tight text-center block", ROLE_TEXT[role])}>
        {abbr ?? jobName.slice(0, 3).toUpperCase()}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://xivapi.com/i/062000/${String(62100 + id).padStart(6, "0")}.png`}
      alt={jobName}
      width={size}
      height={size}
      className="mx-auto rounded"
      style={{ width: size, height: size }}
      title={jobName}
      onError={() => setFailed(true)}
    />
  )
}

const WEAPON_COLS = RELIC_TRACKS.find(
  (t) => t.expansionKey === "dt" && t.category === "weapon"
)?.jobs ?? []
const ARMOR_COLS = RELIC_TRACKS.find((t) => t.category === "armor")?.jobs ?? []
const TOOL_COLS = RELIC_TRACKS.find((t) => t.category === "tool")?.jobs ?? []

function calcProgress(tracks: RelicTrack[], progressMap: ProgressMap) {
  let done = 0
  let total = 0
  for (const track of tracks) {
    for (const job of track.jobs) {
      const raw = progressMap[pKey(track.expansionKey, track.category, job.key)] ?? []
      done += effCompleted(raw, track.steps).length
      total += track.steps.length
    }
  }
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
}

function ProgressBar({ pct, colorClass, height = "h-2" }: { pct: number; colorClass: string; height?: string }) {
  return (
    <div className={cn(height, "rounded-full bg-muted overflow-hidden")}>
      <div
        className={cn("h-full rounded-full transition-all duration-700", pct === 100 ? "bg-emerald-500" : colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function TotalProgress({ progressMap }: { progressMap: ProgressMap }) {
  const weaponTracks = RELIC_TRACKS.filter((t) => t.category === "weapon")
  const armorTracks  = RELIC_TRACKS.filter((t) => t.category === "armor")
  const toolTracks   = RELIC_TRACKS.filter((t) => t.category === "tool")

  const overall = calcProgress(RELIC_TRACKS, progressMap)
  const weapons = calcProgress(weaponTracks, progressMap)
  const armor   = calcProgress(armorTracks,  progressMap)
  const tools   = calcProgress(toolTracks,   progressMap)

  const categories = [
    { label: "Weapons", color: "bg-sky-400",    ...weapons },
    { label: "Armor",   color: "bg-violet-400", ...armor   },
    { label: "Tools",   color: "bg-amber-400",  ...tools   },
  ]

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      {/* Header + big % */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Overall Relic Completion</p>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {overall.done.toLocaleString()} / {overall.total.toLocaleString()} steps
          </p>
        </div>
        <span className={cn("text-3xl font-bold tabular-nums", overall.pct === 100 ? "text-emerald-400" : "text-foreground")}>
          {overall.pct}%
        </span>
      </div>

      {/* Main bar */}
      <ProgressBar pct={overall.pct} colorClass="bg-primary" height="h-3" />

      {/* Category breakdown */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-1 pt-1">
        {categories.map(({ label, pct, done, total, color }) => (
          <div key={label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
              <span className={cn("text-xs tabular-nums font-semibold", pct === 100 ? "text-emerald-400" : "text-foreground/80")}>
                {pct}%
              </span>
            </div>
            <ProgressBar pct={pct} colorClass={color} height="h-1.5" />
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {done.toLocaleString()} / {total.toLocaleString()} steps
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RelicOverview({ progressMap }: { progressMap: ProgressMap }) {
  const weaponTracks = RELIC_TRACKS.filter((t) => t.category === "weapon")
  const armorTracks = RELIC_TRACKS.filter((t) => t.category === "armor")
  const toolTracks = RELIC_TRACKS.filter((t) => t.category === "tool")

  return (
    <div className="space-y-10">
      <TotalProgress progressMap={progressMap} />
      <OverviewGrid
        title="Weapons"
        tracks={weaponTracks}
        columnJobs={WEAPON_COLS}
        progressMap={progressMap}
      />
      <OverviewGrid
        title="Armor"
        tracks={armorTracks}
        columnJobs={ARMOR_COLS}
        progressMap={progressMap}
        isArmorSlots
      />
      <OverviewGrid
        title="Tools"
        tracks={toolTracks}
        columnJobs={TOOL_COLS}
        progressMap={progressMap}
      />
    </div>
  )
}

function OverviewGrid({
  title,
  tracks,
  columnJobs,
  progressMap,
  isArmorSlots = false,
}: {
  title: string
  tracks: RelicTrack[]
  columnJobs: RelicJob[]
  progressMap: ProgressMap
  isArmorSlots?: boolean
}) {
  if (!tracks.length || !columnJobs.length) return null

  return (
    <div>
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      <div className="rounded-lg border border-border">
        <table className="border-collapse text-xs min-w-full">
          <thead className="sticky top-14 z-20">
            {isArmorSlots ? (
              <>
                {/* Row 1: gear set group headers */}
                <tr className="bg-muted border-t border-border shadow-sm">
                  <th
                    rowSpan={2}
                    className="text-left px-3 py-2 text-muted-foreground font-semibold whitespace-nowrap sticky left-0 bg-muted z-10 min-w-[160px] border-b border-border"
                  >
                    Step
                  </th>
                  {ARMOR_GEAR_SETS.map((gs) => (
                    <th
                      key={gs}
                      colSpan={5}
                      className="px-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-l border-b border-border bg-muted"
                    >
                      {gs}
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="px-3 py-2 text-right text-muted-foreground font-semibold whitespace-nowrap border-l border-b border-border bg-muted min-w-[52px]"
                  >
                    %
                  </th>
                </tr>
                {/* Row 2: slot names within each group */}
                <tr className="bg-muted border-b border-border">
                  {columnJobs.map((job) => (
                    <th
                      key={job.key}
                      className={cn(
                        "px-1 py-1 text-center min-w-[32px] bg-muted",
                        job.label === "Head" && "border-l border-border"
                      )}
                    >
                      <span className="text-[9px] font-medium text-muted-foreground/70">
                        {job.label.slice(0, 2)}
                      </span>
                    </th>
                  ))}
                </tr>
              </>
            ) : (
              <tr className="bg-muted border-y border-border shadow-sm">
                <th className="text-left px-3 py-2 text-muted-foreground font-semibold whitespace-nowrap sticky left-0 bg-muted z-10 min-w-[160px]">
                  Step
                </th>
                {columnJobs.map((job) => (
                  <th key={job.key} className="px-1 py-2 text-center min-w-[40px] bg-muted">
                    <div className="flex flex-col items-center gap-0.5">
                      <JobIcon jobName={job.key} size={20} />
                      <span className="text-[9px] text-muted-foreground">
                        {JOB_ABBREVIATIONS[job.key] ?? job.label}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-muted-foreground font-semibold whitespace-nowrap border-l border-border bg-muted min-w-[52px]">
                  %
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {tracks.flatMap((track) => {
              const jobSet = new Set(track.jobs.map((j) => j.key))
              const trackJobs = columnJobs.filter((j) => jobSet.has(j.key))
              const rows: React.ReactNode[] = []

              // Track-level completion %
              const totalCells = trackJobs.length * track.steps.length
              const doneCells = trackJobs.reduce((acc, job) => {
                const raw = progressMap[pKey(track.expansionKey, track.category, job.key)] ?? []
                return acc + effCompleted(raw, track.steps).length
              }, 0)
              const trackPct = totalCells > 0 ? Math.round((doneCells / totalCells) * 100) : 0

              // Expansion group header
              rows.push(
                <tr key={`hdr-${track.expansionKey}-${track.category}`}>
                  <td
                    colSpan={1 + columnJobs.length}
                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/20 border-t-2 border-border sticky left-0"
                  >
                    {track.expansionLabel} — {track.categoryLabel}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-[10px] font-bold bg-muted/20 border-t-2 border-border border-l border-border/40 whitespace-nowrap">
                    <span className={cn(trackPct === 100 ? "text-emerald-400" : "text-muted-foreground/60")}>
                      {trackPct}%
                    </span>
                  </td>
                </tr>
              )

              // Step rows — label is text-only; icon appears in completed cells
              for (const step of track.steps) {
                const iconUrl = isArmorSlots
                  ? ""
                  : stageIconUrl(track.expansionKey, track.category, step.stage)

                const stepDone = trackJobs.filter((job) => {
                  const raw = progressMap[pKey(track.expansionKey, track.category, job.key)] ?? []
                  return effCompleted(raw, track.steps).includes(step.key)
                }).length
                const stepTotal = trackJobs.length
                const stepPct = stepTotal > 0 ? Math.round((stepDone / stepTotal) * 100) : 0

                rows.push(
                  <tr
                    key={`${track.expansionKey}-${track.category}-${step.key}`}
                    className="border-t border-border/20 hover:bg-muted/10"
                  >
                    <td className="px-3 py-1.5 text-xs text-foreground/80 whitespace-nowrap sticky left-0 bg-card z-10 border-r border-border/20">
                      {step.label}
                    </td>
                    {columnJobs.map((job) => {
                      const isSetBoundary = isArmorSlots && job.label === "Head"
                      if (!jobSet.has(job.key)) {
                        return <td key={job.key} className={cn("px-1 py-1.5 text-center bg-muted/5", isSetBoundary && "border-l border-border/40")} />
                      }
                      const raw = progressMap[pKey(track.expansionKey, track.category, job.key)] ?? []
                      const eff = effCompleted(raw, track.steps)
                      const completed = eff.includes(step.key)

                      return (
                        <td key={job.key} className={cn("px-1 py-1.5 text-center", isSetBoundary && "border-l border-border/40")}>
                          {completed ? (
                            isArmorSlots ? (
                              <span className="text-emerald-400 font-bold text-sm leading-none block text-center">✓</span>
                            ) : (
                              <ItemIcon url={iconUrl} size={24} />
                            )
                          ) : (
                            <span className="block size-3.5 mx-auto rounded-full border border-border/30" />
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 text-right tabular-nums border-l border-border/20 whitespace-nowrap">
                      <span className={cn(
                        "text-xs",
                        stepPct === 100 ? "text-emerald-400 font-medium" : stepDone > 0 ? "text-foreground/60" : "text-muted-foreground/30"
                      )}>
                        {stepPct === 100 ? "✓" : stepDone > 0 ? `${stepDone}/${stepTotal}` : "—"}
                      </span>
                    </td>
                  </tr>
                )
              }

              return rows
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
