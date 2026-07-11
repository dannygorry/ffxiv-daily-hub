"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Plus, ExternalLink } from "lucide-react"
import {
  EXPANSION_TABS,
  TOOL_TRACKS,
  ARMOR_GEAR_SETS,
  ARMOR_SLOT_NAMES,
  getExpansionTracks,
  getProgressPercent,
  getTrack,
  type RelicCategory,
  type RelicTrack,
  type RelicMaterial,
} from "@/lib/ffxiv/relics"
import { JOB_ROLES, JOB_CLASS_IDS, JOB_ABBREVIATIONS, type JobRole } from "@/lib/ffxiv/ffxiv-jobs"
import { RelicOverview } from "./RelicOverview"

interface Character {
  id: string
  name: string
  server: string
  data_center: string | null
  avatar_url: string | null
  is_primary: boolean
}

interface ProgressRow {
  expansion_key: string
  category: string
  job_key: string
  completed_steps: string[]
}

interface MaterialRow {
  expansion_key: string
  category: string
  material_key: string
  held_count: number
}

type ProgressMap = Record<string, string[]>
type HeldMap = Record<string, number>

function progressKey(expansionKey: string, category: string, jobKey: string): string {
  return `${expansionKey}:${category}:${jobKey}`
}

// If any later step is complete, all earlier steps are implicitly complete too
// (relic chains are strictly sequential — having step N means you did steps 0..N-1)
function effectiveCompleted(raw: string[], steps: { key: string }[]): string[] {
  if (raw.length === 0 || raw.length === steps.length) return raw
  const rawSet = new Set(raw)
  let highestIdx = -1
  for (let i = steps.length - 1; i >= 0; i--) {
    if (rawSet.has(steps[i].key)) { highestIdx = i; break }
  }
  if (highestIdx <= 0) return raw
  return steps.slice(0, highestIdx + 1).map((s) => s.key)
}

function heldKey(expansionKey: string, category: string, materialKey: string): string {
  return `${expansionKey}:${category}:${materialKey}`
}

// ─── Job pill ────────────────────────────────────────────────────────────────

const ROLE_META: Record<JobRole | "none", { label: string; bar: string; track: string; text: string }> = {
  tank:             { label: "Tank",           bar: "bg-sky-400",     track: "bg-sky-400",     text: "text-sky-400" },
  healer:           { label: "Healer",         bar: "bg-emerald-400", track: "bg-emerald-400", text: "text-emerald-400" },
  melee:            { label: "Melee DPS",      bar: "bg-red-400",     track: "bg-red-400",     text: "text-red-400" },
  physical_ranged:  { label: "Phys. Ranged",   bar: "bg-red-400",     track: "bg-red-400",     text: "text-red-400" },
  magical_ranged:   { label: "Magical Ranged", bar: "bg-red-400",     track: "bg-red-400",     text: "text-red-400" },
  crafter:          { label: "Crafter",        bar: "bg-orange-400",  track: "bg-orange-400",  text: "text-orange-400" },
  gatherer:         { label: "Gatherer",       bar: "bg-teal-400",    track: "bg-teal-400",    text: "text-teal-400" },
  limited:          { label: "Limited",        bar: "bg-pink-400",    track: "bg-pink-400",    text: "text-pink-400" },
  none:             { label: "",               bar: "bg-primary",     track: "bg-primary/50",  text: "text-foreground" },
}

function JobPill({
  label,
  percent,
  active,
  role,
  onClick,
}: {
  label: string
  percent: number
  active: boolean
  role: JobRole | "none"
  onClick: () => void
}) {
  const done = percent === 100
  const meta = ROLE_META[role]

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-1.5 rounded-lg border px-3 pt-2 pb-1.5 text-xs font-medium transition-all overflow-hidden",
        active
          ? "border-primary bg-primary/10 text-primary"
          : done
          ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400 hover:border-emerald-500/60"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent text-foreground"
      )}
    >
      {/* Left role-color accent stripe */}
      <span className={cn("absolute left-0 top-0 bottom-0 w-[3px]", meta.bar)} />
      {/* Job name */}
      <span className="pl-2.5 whitespace-nowrap leading-tight">
        {done ? "✓ " : ""}{label}
      </span>
      {/* Progress bar track */}
      <div className="pl-2.5 w-full">
        <div className="h-[3px] rounded-full bg-border/60 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              done ? "bg-emerald-500" : active ? "bg-primary" : meta.track
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </button>
  )
}

type RelicJob = RelicTrack["jobs"][number]

const GEAR_SET_ROLE: Record<string, JobRole> = {
  Fending: "tank",
  Healing: "healer",
  Maiming: "melee",
  Striking: "melee",
  Scouting: "melee",
  Aiming: "physical_ranged",
  Casting: "magical_ranged",
}

const ARMOR_GEAR_SET_ICON_JOB: Record<string, string> = {
  Fending: "Paladin",
  Healing: "White Mage",
  Maiming: "Dragoon",
  Striking: "Monk",
  Scouting: "Ninja",
  Aiming: "Bard",
  Casting: "Black Mage",
}

function ArmorJobIcon({ jobName }: { jobName: string }) {
  const id = JOB_CLASS_IDS[jobName]
  const [failed, setFailed] = useState(false)
  if (!id || failed) {
    return (
      <span className="text-[9px] font-bold block text-center">
        {JOB_ABBREVIATIONS[jobName] ?? jobName.slice(0, 3).toUpperCase()}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://xivapi.com/i/062000/${String(62100 + id).padStart(6, "0")}.png`}
      alt={jobName}
      width={20}
      height={20}
      className="mx-auto rounded"
      style={{ width: 20, height: 20 }}
      title={jobName}
      onError={() => setFailed(true)}
    />
  )
}

// Group a job list by role, preserving order within each group
function groupJobsByRole(jobs: RelicJob[]): { role: JobRole | "none"; label: string; jobs: RelicJob[] }[] {
  const order: (JobRole | "none")[] = ["tank", "healer", "melee", "physical_ranged", "magical_ranged", "crafter", "gatherer", "limited", "none"]
  const map = new Map<JobRole | "none", RelicJob[]>()
  for (const job of jobs) {
    const role = (JOB_ROLES[job.key] ?? "none") as JobRole | "none"
    if (!map.has(role)) map.set(role, [])
    map.get(role)!.push(job)
  }
  return order
    .filter((r) => map.has(r))
    .map((r) => ({ role: r, label: ROLE_META[r].label, jobs: map.get(r)! }))
}

// ─── Job dropdown (weapons / tools) ──────────────────────────────────────────

function JobSelect({
  jobs,
  selectedJob,
  progressMap,
  expansionKey,
  category,
  steps,
  onSelect,
}: {
  jobs: RelicJob[]
  selectedJob: string
  progressMap: ProgressMap
  expansionKey: string
  category: string
  steps: { key: string }[]
  onSelect: (jobKey: string) => void
}) {
  const selectedJob_obj = jobs.find((j) => j.key === selectedJob)
  const selectedLabel = selectedJob_obj?.label ?? (selectedJob || "Select…")
  const selectedPercent = (() => {
    const raw = progressMap[progressKey(expansionKey, category, selectedJob)] ?? []
    return getProgressPercent(effectiveCompleted(raw, steps), steps as RelicTrack["steps"])
  })()
  const roleGroups = groupJobsByRole(jobs)

  return (
    <Select value={selectedJob} onValueChange={onSelect}>
      <SelectTrigger className="w-full sm:w-72">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span>{selectedLabel}</span>
            {selectedJob && (
              <span className={cn(
                "text-xs tabular-nums",
                selectedPercent === 100 ? "text-emerald-500" : "text-muted-foreground"
              )}>
                {selectedPercent === 100 ? "✓ Done" : `${selectedPercent}%`}
              </span>
            )}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {roleGroups.map((group, i) => (
          <SelectGroup key={group.role}>
            {i > 0 && <SelectSeparator />}
            {group.label && (
              <SelectLabel className={cn("text-xs font-semibold uppercase tracking-wider underline underline-offset-2", ROLE_META[group.role].text)}>
                {group.label}
              </SelectLabel>
            )}
            {group.jobs.map((job) => {
              const raw = progressMap[progressKey(expansionKey, category, job.key)] ?? []
              const completed = effectiveCompleted(raw, steps)
              const pct = getProgressPercent(completed, steps as RelicTrack["steps"])
              const done = pct === 100
              const roleText = ROLE_META[group.role].text
              return (
                <SelectItem key={job.key} value={job.key}>
                  <span className="flex items-center gap-2">
                    <span className={cn(roleText, done && "line-through opacity-50")}>{job.label}</span>
                    <span className={cn("text-xs tabular-nums ml-auto pl-4", done ? "text-emerald-500" : "text-muted-foreground")}>
                      {done ? "✓" : `${pct}%`}
                    </span>
                  </span>
                </SelectItem>
              )
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── Armor slot dropdown ──────────────────────────────────────────────────────

function ArmorSlotSelect({
  selectedSlot,
  progressMap,
  expansionKey,
  steps,
  onSelect,
}: {
  selectedSlot: string
  progressMap: ProgressMap
  expansionKey: string
  steps: { key: string }[]
  onSelect: (slot: string) => void
}) {
  return (
    <Select value={selectedSlot} onValueChange={onSelect}>
      <SelectTrigger className="w-full sm:w-72">
        <SelectValue>
          {selectedSlot ? selectedSlot.charAt(0).toUpperCase() + selectedSlot.slice(1) : "Select piece…"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ARMOR_SLOT_NAMES.map((slot) => {
          const slotKey = slot.toLowerCase()
          const gearSetJobKeys = ARMOR_GEAR_SETS.map((gs) => `${gs.toLowerCase()}_${slotKey}`)
          const setsComplete = gearSetJobKeys.filter((key) => {
            const raw = progressMap[progressKey(expansionKey, "armor", key)] ?? []
            return effectiveCompleted(raw, steps).length === steps.length
          }).length
          const done = setsComplete === ARMOR_GEAR_SETS.length
          return (
            <SelectItem key={slotKey} value={slotKey}>
              <span className="flex items-center gap-2">
                <span className={cn(done && "line-through opacity-50")}>{slot}</span>
                <span className={cn("text-xs tabular-nums ml-auto pl-4", done ? "text-emerald-500" : "text-muted-foreground")}>
                  {done ? "✓" : `${setsComplete}/${ARMOR_GEAR_SETS.length} sets`}
                </span>
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

// ─── Armor step table (7 gear-set columns) ────────────────────────────────────

function ArmorStepTable({
  track,
  slotKey,
  progressMap,
  onToggle,
}: {
  track: RelicTrack
  slotKey: string
  progressMap: ProgressMap
  onToggle: (jobKey: string, stepKey: string, completed: boolean) => void
}) {
  const stages: { stageName: string; steps: typeof track.steps }[] = []
  for (const step of track.steps) {
    const last = stages[stages.length - 1]
    if (last && last.stageName === step.stage) {
      last.steps.push(step)
    } else {
      stages.push({ stageName: step.stage, steps: [step] })
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <table className="border-collapse text-xs min-w-full">
        <thead className="sticky top-14 z-20">
          <tr className="bg-muted border-b border-border">
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap min-w-[180px] sticky left-0 bg-muted z-10">
              Step
            </th>
            {ARMOR_GEAR_SETS.map((gs) => {
              const role = GEAR_SET_ROLE[gs] ?? "none"
              return (
                <th key={gs} className="px-2 py-2 text-center min-w-[64px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <ArmorJobIcon jobName={ARMOR_GEAR_SET_ICON_JOB[gs]} />
                    <span className={cn("text-[9px] font-medium", ROLE_META[role].text)}>
                      {gs}
                    </span>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {stages.flatMap((stage) => [
            <tr key={`hdr-${stage.stageName}`}>
              <td
                colSpan={1 + ARMOR_GEAR_SETS.length}
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/20 border-t-2 border-border"
              >
                {stage.stageName}
              </td>
            </tr>,
            ...stage.steps.map((step) => (
              <tr key={step.key} className="border-t border-border/20 hover:bg-muted/10">
                <td className="px-3 py-2.5 text-xs text-foreground/80 whitespace-nowrap sticky left-0 bg-card z-10 border-r border-border/20">
                  {step.label}
                </td>
                {ARMOR_GEAR_SETS.map((gs) => {
                  const jobKey = `${gs.toLowerCase()}_${slotKey}`
                  const raw = progressMap[progressKey(track.expansionKey, track.category, jobKey)] ?? []
                  const eff = effectiveCompleted(raw, track.steps)
                  const done = eff.includes(step.key)
                  return (
                    <td key={gs} className="px-2 py-2.5 text-center">
                      <Checkbox
                        checked={done}
                        onCheckedChange={(checked) => onToggle(jobKey, step.key, !!checked)}
                        className={cn(done && "border-emerald-500 data-[state=checked]:bg-emerald-500")}
                      />
                    </td>
                  )
                })}
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  )
}

// ─── Step checklist ──────────────────────────────────────────────────────────

function StepChecklist({
  track,
  completedSteps,
  onToggle,
}: {
  track: RelicTrack
  completedSteps: string[]
  onToggle: (stepKey: string, completed: boolean) => void
}) {
  const completedSet = new Set(completedSteps)

  const stages: { stageName: string; steps: typeof track.steps }[] = []
  for (const step of track.steps) {
    const last = stages[stages.length - 1]
    if (last && last.stageName === step.stage) {
      last.steps.push(step)
    } else {
      stages.push({ stageName: step.stage, steps: [step] })
    }
  }

  return (
    <div className="space-y-4">
      {stages.map((group) => (
        <div key={group.stageName} className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {group.stageName}
          </p>
          {group.steps.map((step) => {
            const done = completedSet.has(step.key)
            return (
              <label
                key={step.key}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors",
                  done ? "bg-emerald-500/5 hover:bg-emerald-500/10" : "hover:bg-accent"
                )}
              >
                <Checkbox
                  checked={done}
                  onCheckedChange={(checked) => onToggle(step.key, !!checked)}
                  className={cn(done && "border-emerald-500 data-[state=checked]:bg-emerald-500")}
                />
                <span className={cn("text-sm", done ? "line-through text-muted-foreground" : "text-foreground")}>
                  {step.label}
                </span>
              </label>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Materials panel ─────────────────────────────────────────────────────────

function perUnitLabel(category: string): string {
  if (category === "armor") return "Per Piece"
  if (category === "tool") return "Per Tool"
  return "Per Weapon"
}

function calcNeeded(
  mat: RelicMaterial,
  track: RelicTrack,
  progressMap: ProgressMap
): { count: number; total: number } {
  let count = 0
  for (const job of track.jobs) {
    const raw = progressMap[progressKey(track.expansionKey, track.category, job.key)] ?? []
    const completed = effectiveCompleted(raw, track.steps)
    if (!completed.includes(mat.gateStep)) count++
  }
  return { count, total: count * mat.perJob }
}

function MaterialsPanel({
  track,
  progressMap,
  heldMap,
  onHeldChange,
}: {
  track: RelicTrack
  progressMap: ProgressMap
  heldMap: HeldMap
  onHeldChange: (materialKey: string, value: number) => void
}) {
  const isArmor = track.category === "armor"
  const unitLabel = perUnitLabel(track.category)
  const totalJobs = track.jobs.length
  // For armor: "Per Set" = cost of one full 5-piece set
  const SET_SIZE = 5

  const [open, setOpen] = useState(true)

  if (track.materials.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Material data not yet available for this track — verify amounts against the spreadsheet.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
      >
        <div className="text-left">
          <p className="font-semibold text-sm">Materials & Resources</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Totals across {totalJobs} {isArmor ? "armor pieces" : track.category === "tool" ? "tools" : "weapons"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground shrink-0 transition-transform duration-200",
            !open && "-rotate-90"
          )}
        />
      </button>

      {open && (
        <>
          <div className="border-t border-border" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Material</th>
                  <th className="text-right px-3 py-2 font-medium whitespace-nowrap">{unitLabel}</th>
                  {isArmor && (
                    <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Per Set (×{SET_SIZE})</th>
                  )}
                  <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Needed</th>
                  <th className="text-right px-3 py-2 font-medium">Held</th>
                  <th className="text-right px-4 py-2 font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {track.materials.map((mat) => {
                  const { count, total: needed } = calcNeeded(mat, track, progressMap)
                  const held = heldMap[heldKey(track.expansionKey, track.category, mat.key)] ?? 0
                  const remaining = Math.max(0, needed - held)
                  const done = remaining === 0
                  const perSet = mat.perJob * SET_SIZE
                  const wikiSlug = mat.wikiSlug === undefined
                    ? mat.label.replace(/ /g, "_")
                    : mat.wikiSlug
                  const wikiUrl = wikiSlug
                    ? `https://ffxiv.consolegameswiki.com/wiki/${encodeURIComponent(wikiSlug)}`
                    : null

                  return (
                    <tr
                      key={mat.key}
                      className={cn(
                        "border-b border-border/50 last:border-0",
                        done && "opacity-40"
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <span className={cn("text-sm", done && "line-through text-muted-foreground")}>
                          {mat.label}
                        </span>
                        {wikiUrl && (
                          <a
                            href={wikiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors"
                          >
                            wiki <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </td>
                      {/* Per weapon / per piece */}
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {mat.perJob.toLocaleString()}
                      </td>
                      {/* Per set (armor only) */}
                      {isArmor && (
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {perSet.toLocaleString()}
                        </td>
                      )}
                      {/* Needed = uncompleted × perUnit, show the formula */}
                      <td className="px-3 py-2.5 text-right">
                        <span className="tabular-nums">{needed.toLocaleString()}</span>
                        {count > 0 && (
                          <span className="block text-[10px] text-muted-foreground tabular-nums">
                            {count} × {mat.perJob.toLocaleString()}
                          </span>
                        )}
                      </td>
                      {/* Held input */}
                      <td className="px-3 py-2.5 text-right">
                        <HeldInput
                          value={held}
                          onChange={(v) => onHeldChange(mat.key, v)}
                        />
                      </td>
                      {/* Remaining */}
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right tabular-nums font-medium",
                          done ? "text-emerald-500" : "text-foreground"
                        )}
                      >
                        {done ? "✓" : remaining.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Held count input (debounced) ─────────────────────────────────────────────

function HeldInput({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [local, setLocal] = useState(String(value))
  const [focused, setFocused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Only sync from prop when not focused — avoids clobbering keystrokes mid-debounce
  useEffect(() => {
    if (!focused) setLocal(String(value))
  }, [value, focused])

  const handleChange = (raw: string) => {
    setLocal(raw)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const parsed = parseInt(raw, 10)
      if (!isNaN(parsed) && parsed >= 0) onChange(parsed)
    }, 600)
  }

  return (
    <Input
      type="number"
      min={0}
      value={local}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setLocal(String(value)) }}
      className="h-7 w-20 text-right text-xs px-2 ml-auto"
    />
  )
}

// ─── Expansion panel ─────────────────────────────────────────────────────────

function ExpansionPanel({
  expansionKey,
  progressMap,
  heldMap,
  characterId,
  onToggle,
  onHeldChange,
}: {
  expansionKey: string
  progressMap: ProgressMap
  heldMap: HeldMap
  characterId: string
  onToggle: (expansionKey: string, category: string, jobKey: string, stepKey: string, completed: boolean) => void
  onHeldChange: (expansionKey: string, category: string, materialKey: string, value: number) => void
}) {
  const tracks = getExpansionTracks(expansionKey).filter((t) => t.category !== "tool")
  const hasArmor = tracks.some((t) => t.category === "armor")

  const [activeCategory, setActiveCategory] = useState<string>(
    tracks.find((t) => t.category === "weapon")?.category ?? tracks[0]?.category ?? "weapon"
  )
  const [activeJob, setActiveJob] = useState<string>("")

  const currentTrack = tracks.find((t) => t.category === activeCategory) ?? tracks[0]
  const isArmorCategory = currentTrack?.category === "armor"

  useEffect(() => {
    if (currentTrack) {
      setActiveJob(currentTrack.category === "armor" ? "head" : (currentTrack.jobs[0]?.key ?? ""))
    }
  }, [currentTrack?.expansionKey, currentTrack?.category, characterId])

  if (!currentTrack) return null

  const selectedJob = activeJob || (isArmorCategory ? "head" : currentTrack.jobs[0]?.key || "")
  const completedSteps = !isArmorCategory
    ? effectiveCompleted(
        progressMap[progressKey(expansionKey, activeCategory, selectedJob)] ?? [],
        currentTrack.steps
      )
    : []

  return (
    <div className="space-y-4">
      {hasArmor && (
        <div className="flex gap-2">
          {tracks.map((t) => (
            <button
              key={t.category}
              onClick={() => setActiveCategory(t.category)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                activeCategory === t.category
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {t.categoryLabel}
            </button>
          ))}
        </div>
      )}

      {!hasArmor && (
        <p className="text-sm text-muted-foreground">{currentTrack.categoryLabel}</p>
      )}

      {isArmorCategory ? (
        <ArmorSlotSelect
          selectedSlot={selectedJob}
          progressMap={progressMap}
          expansionKey={expansionKey}
          steps={currentTrack.steps}
          onSelect={setActiveJob}
        />
      ) : (
        <JobSelect
          jobs={currentTrack.jobs}
          selectedJob={selectedJob}
          progressMap={progressMap}
          expansionKey={expansionKey}
          category={activeCategory}
          steps={currentTrack.steps}
          onSelect={setActiveJob}
        />
      )}

      {selectedJob && isArmorCategory && (
        <div className="space-y-4">
          <ArmorStepTable
            track={currentTrack}
            slotKey={selectedJob}
            progressMap={progressMap}
            onToggle={(jobKey, stepKey, completed) =>
              onToggle(expansionKey, activeCategory, jobKey, stepKey, completed)
            }
          />
          <MaterialsPanel
            track={currentTrack}
            progressMap={progressMap}
            heldMap={heldMap}
            onHeldChange={(matKey, v) => onHeldChange(expansionKey, activeCategory, matKey, v)}
          />
        </div>
      )}

      {selectedJob && !isArmorCategory && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Left: step checklist */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-sm">{selectedJob}</p>
              <span className="text-xs text-muted-foreground tabular-nums">
                {completedSteps.length} / {currentTrack.steps.length} steps
              </span>
            </div>
            <StepChecklist
              track={currentTrack}
              completedSteps={completedSteps}
              onToggle={(stepKey, completed) =>
                onToggle(expansionKey, activeCategory, selectedJob, stepKey, completed)
              }
            />
          </div>

          {/* Right: materials calculator */}
          <MaterialsPanel
            track={currentTrack}
            progressMap={progressMap}
            heldMap={heldMap}
            onHeldChange={(matKey, v) => onHeldChange(expansionKey, activeCategory, matKey, v)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Tools panel ─────────────────────────────────────────────────────────────

function ToolsPanel({
  progressMap,
  heldMap,
  characterId,
  onToggle,
  onHeldChange,
}: {
  progressMap: ProgressMap
  heldMap: HeldMap
  characterId: string
  onToggle: (expansionKey: string, category: string, jobKey: string, stepKey: string, completed: boolean) => void
  onHeldChange: (expansionKey: string, category: string, materialKey: string, value: number) => void
}) {
  const [activeTrackIdx, setActiveTrackIdx] = useState(0)
  const [activeJob, setActiveJob] = useState<string>("")

  const track = TOOL_TRACKS[activeTrackIdx]

  useEffect(() => {
    if (track) setActiveJob(track.jobs[0]?.key ?? "")
  }, [activeTrackIdx, characterId])

  if (!track) return null

  const selectedJob = activeJob || track.jobs[0]?.key || ""
  const completedSteps = effectiveCompleted(
    progressMap[progressKey(track.expansionKey, "tool", selectedJob)] ?? [],
    track.steps
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TOOL_TRACKS.map((t, i) => (
          <button
            key={`${t.expansionKey}-${t.category}`}
            onClick={() => setActiveTrackIdx(i)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              activeTrackIdx === i
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {t.expansionLabel}
          </button>
        ))}
      </div>

      <JobSelect
        jobs={track.jobs}
        selectedJob={selectedJob}
        progressMap={progressMap}
        expansionKey={track.expansionKey}
        category="tool"
        steps={track.steps}
        onSelect={setActiveJob}
      />

      {selectedJob && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-sm">{selectedJob}</p>
              <span className="text-xs text-muted-foreground tabular-nums">
                {completedSteps.length} / {track.steps.length} steps
              </span>
            </div>
            <StepChecklist
              track={track}
              completedSteps={completedSteps}
              onToggle={(stepKey, completed) =>
                onToggle(track.expansionKey, "tool", selectedJob, stepKey, completed)
              }
            />
          </div>

          <MaterialsPanel
            track={track}
            progressMap={progressMap}
            heldMap={heldMap}
            onHeldChange={(matKey, v) => onHeldChange(track.expansionKey, "tool", matKey, v)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RelicTrackerClient({ characters }: { characters: Character[] }) {
  const primaryChar = characters.find((c) => c.is_primary) ?? characters[0]
  const [activeCharId, setActiveCharId] = useState<string>(primaryChar?.id ?? "")
  const [activeTab, setActiveTab] = useState("overview")
  const [progressMap, setProgressMap] = useState<ProgressMap>({})
  const [heldMap, setHeldMap] = useState<HeldMap>({})
  const [loading, setLoading] = useState(true)

  const latestRef = useRef<ProgressMap>({})
  const committedRef = useRef<ProgressMap>({})

  const activeChar = characters.find((c) => c.id === activeCharId) ?? primaryChar

  useEffect(() => {
    const stored = localStorage.getItem("ffxiv-hub-active-char")
    if (stored && characters.find((c) => c.id === stored)) {
      setActiveCharId(stored)
    }
  }, [characters])

  useEffect(() => {
    localStorage.setItem("ffxiv-hub-active-char", activeCharId)
  }, [activeCharId])

  const loadAll = useCallback(async () => {
    if (!activeCharId) return
    setLoading(true)

    const [progressRes, materialsRes] = await Promise.all([
      fetch(`/api/relic-tracker?characterId=${activeCharId}`),
      fetch(`/api/relic-materials?characterId=${activeCharId}`),
    ])

    if (progressRes.ok) {
      const { progress } = await progressRes.json() as { progress: ProgressRow[] }
      const map: ProgressMap = {}
      for (const row of progress) {
        map[progressKey(row.expansion_key, row.category, row.job_key)] = row.completed_steps
      }
      latestRef.current = map
      committedRef.current = map
      setProgressMap(map)
    }

    if (materialsRes.ok) {
      const { materials } = await materialsRes.json() as { materials: MaterialRow[] }
      const map: HeldMap = {}
      for (const row of materials) {
        map[heldKey(row.expansion_key, row.category, row.material_key)] = row.held_count
      }
      setHeldMap(map)
    }

    setLoading(false)
  }, [activeCharId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleToggle = useCallback(
    async (
      expansionKey: string,
      category: string,
      jobKey: string,
      stepKey: string,
      completed: boolean
    ) => {
      const key = progressKey(expansionKey, category, jobKey)
      const prev = latestRef.current[key] ?? []

      // When checking a step, also persist all prior steps that haven't been saved yet.
      // This ensures unchecking a later step doesn't silently wipe out earlier ones that
      // were only shown via effectiveCompleted but never written to the DB.
      let writes: { stepKey: string; completed: boolean }[]
      if (completed) {
        const track = getTrack(expansionKey, category as RelicCategory)
        const stepIdx = track ? track.steps.findIndex((s) => s.key === stepKey) : -1
        const prevSet = new Set(prev)
        const missing =
          stepIdx > 0
            ? track!.steps.slice(0, stepIdx).filter((s) => !prevSet.has(s.key)).map((s) => s.key)
            : []
        writes = [...missing.map((sk) => ({ stepKey: sk, completed: true })), { stepKey, completed: true }]
      } else {
        writes = [{ stepKey, completed: false }]
      }

      const addedKeys = writes.filter((w) => w.completed).map((w) => w.stepKey)
      const removedKeys = writes.filter((w) => !w.completed).map((w) => w.stepKey)
      const next = [...new Set([...prev, ...addedKeys])].filter((k) => !removedKeys.includes(k))

      latestRef.current = { ...latestRef.current, [key]: next }
      setProgressMap((p) => ({ ...p, [key]: next }))

      // Sequential writes — avoids TOCTOU between concurrent requests for the same job.
      // On any failure, re-fetch server state so the UI reflects what actually committed.
      let failed = false
      for (const { stepKey: sk, completed: c } of writes) {
        const res = await fetch("/api/relic-tracker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId: activeCharId, expansionKey, category, jobKey, stepKey: sk, completed: c }),
        })
        if (!res.ok) { failed = true; break }
      }

      if (failed) {
        const refetchRes = await fetch(`/api/relic-tracker?characterId=${activeCharId}`)
        if (refetchRes.ok) {
          const { progress } = await refetchRes.json() as {
            progress: { expansion_key: string; category: string; job_key: string; completed_steps: string[] }[]
          }
          const serverEntry = progress.find(
            (r) => r.expansion_key === expansionKey && r.category === category && r.job_key === jobKey
          )
          const serverSteps = serverEntry?.completed_steps ?? prev
          latestRef.current = { ...latestRef.current, [key]: serverSteps }
          setProgressMap((p) => ({ ...p, [key]: serverSteps }))
        } else {
          latestRef.current = { ...latestRef.current, [key]: prev }
          setProgressMap((p) => ({ ...p, [key]: prev }))
        }
      } else {
        committedRef.current = { ...committedRef.current, [key]: next }
      }
    },
    [activeCharId]
  )

  const handleHeldChange = useCallback(
    async (expansionKey: string, category: string, materialKey: string, value: number) => {
      const key = heldKey(expansionKey, category, materialKey)
      let prev = 0
      setHeldMap((p) => { prev = p[key] ?? 0; return { ...p, [key]: value } })

      const res = await fetch("/api/relic-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: activeCharId,
          expansionKey,
          category,
          materialKey,
          heldCount: value,
        }),
      })
      if (!res.ok) setHeldMap((p) => ({ ...p, [key]: prev }))
    },
    [activeCharId]
  )

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <div className="text-4xl">⚔️</div>
        <h1 className="text-2xl font-bold">No characters linked</h1>
        <p className="text-muted-foreground max-w-sm">
          Link and verify at least one FFXIV character to start tracking relics.
        </p>
        <Button asChild className="gap-2">
          <Link href="/character/link">
            <Plus className="size-4" /> Link a Character
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + character switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relic Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Track relic progress and remaining materials across all expansions
          </p>
        </div>

        {activeChar && (
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarImage src={activeChar.avatar_url ?? undefined} alt={activeChar.name} />
              <AvatarFallback>{activeChar.name[0]}</AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="font-semibold text-sm">{activeChar.name}</p>
              <p className="text-xs text-muted-foreground">{activeChar.server}</p>
            </div>
            {characters.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    Switch <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {characters.map((char) => (
                    <DropdownMenuItem
                      key={char.id}
                      onClick={() => setActiveCharId(char.id)}
                      className="flex items-center gap-2"
                    >
                      <Avatar className="size-6">
                        <AvatarImage src={char.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">{char.name[0]}</AvatarFallback>
                      </Avatar>
                      <span>{char.name}</span>
                      {char.id === activeCharId && (
                        <ChevronRight className="size-3.5 ml-auto text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {EXPANSION_TABS.map((exp) => (
            <TabsTrigger key={exp.key} value={exp.key}>
              {exp.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Loading progress…
          </div>
        ) : (
          <>
            <TabsContent value="overview" className="mt-4">
              <RelicOverview progressMap={progressMap} />
            </TabsContent>

            {EXPANSION_TABS.map((exp) => (
              <TabsContent key={exp.key} value={exp.key} className="mt-4">
                <ExpansionPanel
                  expansionKey={exp.key}
                  progressMap={progressMap}
                  heldMap={heldMap}
                  characterId={activeCharId}
                  onToggle={handleToggle}
                  onHeldChange={handleHeldChange}
                />
              </TabsContent>
            ))}

            <TabsContent value="tools" className="mt-4">
              <ToolsPanel
                progressMap={progressMap}
                heldMap={heldMap}
                characterId={activeCharId}
                onToggle={handleToggle}
                onHeldChange={handleHeldChange}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
