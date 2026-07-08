"use client"

import { useState, useEffect, useCallback } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  BEAST_TRIBES,
  DISPLAY_GROUPS,
  DAILY_QUEST_LIMIT,
  RANK_COLORS,
  maskToCount,
  type BeastTribe,
} from "@/lib/ffxiv/beast-tribes"
import { getDailyResetPeriod } from "@/lib/ffxiv/resets"

interface TribeProgress {
  tribe_key: string
  rank_level: number
  quests_mask: number
  quest_period: string
}

// ─── Individual tribe card ───────────────────────────────────────────────────

function TribeCard({
  tribe,
  progress,
  period,
  totalQuestsToday,
  onQuestToggle,
  onRankUp,
  onRankDown,
}: {
  tribe: BeastTribe
  progress: TribeProgress
  period: string
  totalQuestsToday: number
  onQuestToggle: (tribeKey: string, bit: number, value: boolean) => void
  onRankUp: (tribeKey: string) => void
  onRankDown: (tribeKey: string) => void
}) {
  const currentMask = progress.quest_period === period ? progress.quests_mask : 0
  const questCount = maskToCount(currentMask)
  const isMaxRank = progress.rank_level >= tribe.ranks.length
  const isMinRank = progress.rank_level <= 1
  const rankName = tribe.ranks[progress.rank_level - 1] ?? tribe.ranks[0]
  const isAtLimit = totalQuestsToday >= DAILY_QUEST_LIMIT

  return (
    <div className="rounded-lg border border-border bg-card/60 p-2.5 space-y-2 min-w-0">
      {/* Name + rank controls */}
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold leading-tight">{tribe.name}</p>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onRankDown(tribe.key)}
            disabled={isMinRank}
            title="Rank down"
            className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-0.5"
          >
            <ChevronUp className="size-3 rotate-180" />
          </button>
          <button
            onClick={() => onRankUp(tribe.key)}
            disabled={isMaxRank}
            title="Rank up"
            className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-0.5"
          >
            <ChevronUp className="size-3" />
          </button>
        </div>
      </div>

      {/* Rank badge */}
      <span
        className={cn(
          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
          RANK_COLORS[rankName] ?? "bg-secondary text-secondary-foreground"
        )}
      >
        {rankName}
      </span>

      {/* Quest checkboxes */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((bit) => {
          const checked = Boolean((currentMask >> bit) & 1)
          const disabled = !checked && isAtLimit
          return (
            <label
              key={bit}
              className={cn(
                "flex flex-col items-center gap-0.5 cursor-pointer",
                disabled && "cursor-not-allowed opacity-40"
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(val) => onQuestToggle(tribe.key, bit, Boolean(val))}
                className="size-3.5"
              />
              <span className="text-[9px] text-muted-foreground leading-none">{bit + 1}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main grid ───────────────────────────────────────────────────────────────

export function BeastTribeGrid({ characterId }: { characterId: string }) {
  const period = getDailyResetPeriod()
  const [progressMap, setProgressMap] = useState<Record<string, TribeProgress>>({})
  const [dailyOffset, setDailyOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  // Total quests today: offset (from rank-ups) + sum of each tribe's current mask
  const totalQuestsToday =
    dailyOffset +
    BEAST_TRIBES.reduce((sum, tribe) => {
      const prog = progressMap[tribe.key]
      if (!prog || prog.quest_period !== period) return sum
      return sum + maskToCount(prog.quests_mask)
    }, 0)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/beast-tribe?characterId=${characterId}&period=${encodeURIComponent(period)}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    const map: Record<string, TribeProgress> = {}
    for (const row of data.progress as TribeProgress[]) map[row.tribe_key] = row
    // Fill defaults for any tribe not yet in the DB
    for (const tribe of BEAST_TRIBES) {
      if (!map[tribe.key]) {
        map[tribe.key] = { tribe_key: tribe.key, rank_level: 1, quests_mask: 0, quest_period: "" }
      }
    }
    setProgressMap(map)
    setDailyOffset(data.dailyOffset ?? 0)
    setLoading(false)
  }, [characterId, period])

  useEffect(() => { load() }, [load])

  const handleQuestToggle = useCallback(
    async (tribeKey: string, bit: number, value: boolean) => {
      const prev = progressMap[tribeKey]
      const prevMask = prev.quest_period === period ? prev.quests_mask : 0
      const newMask = value ? prevMask | (1 << bit) : prevMask & ~(1 << bit)

      // Optimistic update
      setProgressMap((p) => ({
        ...p,
        [tribeKey]: { ...p[tribeKey], quests_mask: newMask, quest_period: period },
      }))

      const res = await fetch("/api/beast-tribe/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, tribeKey, questMask: newMask, period }),
      })
      if (!res.ok) {
        // Revert
        setProgressMap((p) => ({ ...p, [tribeKey]: prev }))
      }
    },
    [characterId, period, progressMap]
  )

  const handleRankUp = useCallback(
    async (tribeKey: string) => {
      const prev = progressMap[tribeKey]
      const tribe = BEAST_TRIBES.find((t) => t.key === tribeKey)!
      if ((prev?.rank_level ?? 1) >= tribe.ranks.length) return

      const currentMask = prev.quest_period === period ? prev.quests_mask : 0
      const questsDone = maskToCount(currentMask)
      const newRank = (prev?.rank_level ?? 1) + 1

      // Optimistic
      setProgressMap((p) => ({
        ...p,
        [tribeKey]: { ...p[tribeKey], rank_level: newRank, quests_mask: 0, quest_period: period },
      }))
      setDailyOffset((o) => o + questsDone)

      const res = await fetch("/api/beast-tribe/rank-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, tribeKey, period }),
      })
      if (!res.ok) {
        setProgressMap((p) => ({ ...p, [tribeKey]: prev }))
        setDailyOffset((o) => o - questsDone)
      }
    },
    [characterId, period, progressMap]
  )

  const handleRankDown = useCallback(
    async (tribeKey: string) => {
      const prev = progressMap[tribeKey]
      if ((prev?.rank_level ?? 1) <= 1) return
      const newRank = (prev?.rank_level ?? 1) - 1

      setProgressMap((p) => ({ ...p, [tribeKey]: { ...p[tribeKey], rank_level: newRank } }))

      const res = await fetch("/api/beast-tribe/rank-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, tribeKey, rankLevel: newRank }),
      })
      if (!res.ok) setProgressMap((p) => ({ ...p, [tribeKey]: prev }))
    },
    [characterId, progressMap]
  )

  const limitColor =
    totalQuestsToday >= DAILY_QUEST_LIMIT
      ? "text-red-400"
      : totalQuestsToday >= 9
      ? "text-yellow-400"
      : "text-muted-foreground"

  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">Loading beast tribe data…</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Beast Tribes</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rank up and track your 3 daily quests per tribe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium tabular-nums", limitColor)}>
            {totalQuestsToday}/{DAILY_QUEST_LIMIT} quests
          </span>
          {totalQuestsToday >= DAILY_QUEST_LIMIT && (
            <Badge variant="destructive" className="text-[10px]">Daily limit reached</Badge>
          )}
        </div>
      </div>

      {/* Expansion columns */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {DISPLAY_GROUPS.map((group) => {
            const tribes = BEAST_TRIBES.filter((t) => t.displayGroup === group.id)
            return (
              <div key={group.id} className="flex flex-col gap-2 w-[148px]">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                  {group.label}
                </p>
                {tribes.map((tribe) => (
                  <TribeCard
                    key={tribe.key}
                    tribe={tribe}
                    progress={progressMap[tribe.key]}
                    period={period}
                    totalQuestsToday={totalQuestsToday}
                    onQuestToggle={handleQuestToggle}
                    onRankUp={handleRankUp}
                    onRankDown={handleRankDown}
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
