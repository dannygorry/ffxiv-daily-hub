"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-3 min-w-0">
      {/* Name + badge on left, rank controls on right */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 min-w-0">
          <p className="text-sm font-semibold leading-tight">{tribe.name}</p>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
              RANK_COLORS[rankName] ?? "bg-secondary text-secondary-foreground"
            )}
          >
            {rankName}
          </span>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRankUp(tribe.key)}
            disabled={isMaxRank}
            className="h-6 px-1.5 text-[10px]"
          >
            Rank +
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRankDown(tribe.key)}
            disabled={isMinRank}
            className="h-6 px-1.5 text-[10px]"
          >
            Rank −
          </Button>
        </div>
      </div>

      {/* Quest checkboxes */}
      <div className="flex items-center gap-4">
        {[0, 1, 2].map((bit) => {
          const checked = Boolean((currentMask >> bit) & 1)
          const disabled = !checked && isAtLimit
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
                onCheckedChange={(val) => onQuestToggle(tribe.key, bit, Boolean(val))}
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

// ─── Main grid ───────────────────────────────────────────────────────────────

export function BeastTribeGrid({ characterId }: { characterId: string }) {
  const period = getDailyResetPeriod()
  const [progressMap, setProgressMap] = useState<Record<string, TribeProgress>>({})
  const [dailyOffset, setDailyOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  // Always-current mirrors of state — lets handlers read the latest values even
  // when React hasn't flushed a re-render between rapid clicks (stale closure fix).
  const latestProgressRef = useRef<Record<string, TribeProgress>>({})
  const committedProgressRef = useRef<Record<string, TribeProgress>>({})
  const dailyOffsetRef = useRef(0)
  // Debounce timers for rank-down, keyed by tribe
  const rankDownTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

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
    latestProgressRef.current = map
    committedProgressRef.current = { ...map }
    dailyOffsetRef.current = data.dailyOffset ?? 0
    setProgressMap(map)
    setDailyOffset(data.dailyOffset ?? 0)
    setLoading(false)
  }, [characterId, period])

  useEffect(() => { load() }, [load])

  const handleQuestToggle = useCallback(
    async (tribeKey: string, bit: number, value: boolean) => {
      const prev = latestProgressRef.current[tribeKey]
      const prevMask = prev.quest_period === period ? prev.quests_mask : 0
      const newMask = value ? prevMask | (1 << bit) : prevMask & ~(1 << bit)
      const updated = { ...prev, quests_mask: newMask, quest_period: period }

      latestProgressRef.current = { ...latestProgressRef.current, [tribeKey]: updated }
      setProgressMap((p) => ({ ...p, [tribeKey]: updated }))

      const res = await fetch("/api/beast-tribe/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, tribeKey, questMask: newMask, period }),
      })
      if (!res.ok) {
        latestProgressRef.current = { ...latestProgressRef.current, [tribeKey]: prev }
        setProgressMap((p) => ({ ...p, [tribeKey]: prev }))
      } else {
        committedProgressRef.current = { ...committedProgressRef.current, [tribeKey]: updated }
      }
    },
    [characterId, period]
  )

  const handleRankUp = useCallback(
    async (tribeKey: string) => {
      const prev = latestProgressRef.current[tribeKey]
      const tribe = BEAST_TRIBES.find((t) => t.key === tribeKey)!
      if ((prev?.rank_level ?? 1) >= tribe.ranks.length) return

      const currentMask = prev.quest_period === period ? prev.quests_mask : 0
      const questsDone = maskToCount(currentMask)
      const newRank = (prev?.rank_level ?? 1) + 1
      const updated = { ...prev, rank_level: newRank, quests_mask: 0, quest_period: period }

      latestProgressRef.current = { ...latestProgressRef.current, [tribeKey]: updated }
      dailyOffsetRef.current += questsDone
      setProgressMap((p) => ({ ...p, [tribeKey]: updated }))
      setDailyOffset((o) => o + questsDone)

      const res = await fetch("/api/beast-tribe/rank-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, tribeKey, period }),
      })
      if (!res.ok) {
        latestProgressRef.current = { ...latestProgressRef.current, [tribeKey]: prev }
        dailyOffsetRef.current -= questsDone
        setProgressMap((p) => ({ ...p, [tribeKey]: prev }))
        setDailyOffset((o) => o - questsDone)
      } else {
        committedProgressRef.current = { ...committedProgressRef.current, [tribeKey]: updated }
      }
    },
    [characterId, period]
  )

  const handleRankDown = useCallback(
    (tribeKey: string) => {
      const current = latestProgressRef.current[tribeKey]
      if (!current || current.rank_level <= 1) return
      const newRank = current.rank_level - 1
      const updated = { ...current, rank_level: newRank }

      // Update ref immediately so the next rapid click computes from the correct value
      latestProgressRef.current = { ...latestProgressRef.current, [tribeKey]: updated }
      setProgressMap((p) => ({ ...p, [tribeKey]: updated }))

      // Debounce the API call: a burst of 5 clicks fires one request with the final rank
      clearTimeout(rankDownTimerRef.current[tribeKey])
      rankDownTimerRef.current[tribeKey] = setTimeout(async () => {
        const finalRank = latestProgressRef.current[tribeKey]?.rank_level
        if (finalRank == null) return

        const res = await fetch("/api/beast-tribe/rank-set", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId, tribeKey, rankLevel: finalRank }),
        })
        if (res.ok) {
          committedProgressRef.current = {
            ...committedProgressRef.current,
            [tribeKey]: latestProgressRef.current[tribeKey],
          }
        } else {
          // Roll back to the last successfully saved state, not the stale pre-click snapshot
          const committed = committedProgressRef.current[tribeKey]
          if (committed) {
            latestProgressRef.current = { ...latestProgressRef.current, [tribeKey]: committed }
            setProgressMap((p) => ({ ...p, [tribeKey]: committed }))
          }
        }
      }, 600)
    },
    [characterId]
  )

  useEffect(() => {
    return () => { Object.values(rankDownTimerRef.current).forEach(clearTimeout) }
  }, [])

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
      <div className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="flex gap-4 min-w-max">
          {DISPLAY_GROUPS.map((group) => {
            const tribes = BEAST_TRIBES.filter((t) => t.displayGroup === group.id)
            return (
              <div key={group.id} className="flex flex-col gap-3 w-[200px]">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
