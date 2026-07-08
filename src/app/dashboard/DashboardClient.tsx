"use client"

import { useState, useEffect, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight } from "lucide-react"
import { EorzeaClock } from "@/components/EorzeaClock"
import { ResetTimers } from "@/components/ResetTimers"
import { ChecklistSection } from "./ChecklistSection"
import { BeastTribeGrid } from "@/components/BeastTribeGrid"
import { SpoilerDropdown } from "@/components/SpoilerDropdown"
import { getDailyResetPeriod, getWeeklyResetPeriod } from "@/lib/ffxiv/resets"
import { createClient } from "@/lib/supabase/client"
import { SUBCATEGORY_LABELS } from "@/lib/ffxiv/checklist"
import { useSpoilerSettings } from "@/hooks/useSpoilerSettings"
import { ITEM_EXPANSION, isExpansionHidden } from "@/lib/spoiler"

interface Character {
  id: string
  name: string
  server: string
  data_center: string | null
  avatar_url: string | null
  is_primary: boolean
}

interface ChecklistItem {
  id: string
  name: string
  description: string | null
  category: "daily" | "weekly"
  subcategory: string
  sort_order: number
}

interface ChecklistState {
  item_id: string
  reset_period: string
}

export function DashboardClient({
  characters,
  checklistItems,
}: {
  characters: Character[]
  checklistItems: ChecklistItem[]
}) {
  const primaryChar = characters.find((c) => c.is_primary) ?? characters[0]
  const [activeCharId, setActiveCharId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ffxiv-hub-active-char")
      if (stored && characters.find((c) => c.id === stored)) return stored
    }
    return primaryChar.id
  })
  const activeChar = characters.find((c) => c.id === activeCharId) ?? primaryChar

  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const dailyPeriod = getDailyResetPeriod()
  const weeklyPeriod = getWeeklyResetPeriod()

  const loadState = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("checklist_state")
      .select("item_id, reset_period")
      .eq("character_id", activeCharId)
      .in("reset_period", [dailyPeriod, weeklyPeriod])

    const completed = new Set<string>()
    for (const row of data ?? []) {
      completed.add(`${row.item_id}:${row.reset_period}`)
    }
    setCompletedItems(completed)
    setLoading(false)
  }, [activeCharId, dailyPeriod, weeklyPeriod])

  useEffect(() => {
    loadState()
  }, [loadState])

  useEffect(() => {
    localStorage.setItem("ffxiv-hub-active-char", activeCharId)
  }, [activeCharId])

  async function toggleItem(itemId: string, category: "daily" | "weekly") {
    const period = category === "daily" ? dailyPeriod : weeklyPeriod
    const key = `${itemId}:${period}`
    const isCompleted = completedItems.has(key)

    setCompletedItems((prev) => {
      const next = new Set(prev)
      if (isCompleted) next.delete(key)
      else next.add(key)
      return next
    })

    const res = await fetch("/api/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: activeCharId,
        itemId,
        completed: !isCompleted,
        resetPeriod: period,
      }),
    })

    if (!res.ok) {
      setCompletedItems((prev) => {
        const next = new Set(prev)
        if (isCompleted) next.add(key)
        else next.delete(key)
        return next
      })
    }
  }

  async function toggleMany(itemIds: string[], category: "daily" | "weekly", completed: boolean) {
    const period = category === "daily" ? dailyPeriod : weeklyPeriod

    // Optimistic update — all at once
    setCompletedItems((prev) => {
      const next = new Set(prev)
      for (const id of itemIds) {
        const key = `${id}:${period}`
        if (completed) next.add(key)
        else next.delete(key)
      }
      return next
    })

    const res = await fetch("/api/checklist/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: activeCharId, itemIds, completed, resetPeriod: period }),
    })

    if (!res.ok) {
      // Revert
      setCompletedItems((prev) => {
        const next = new Set(prev)
        for (const id of itemIds) {
          const key = `${id}:${period}`
          if (completed) next.delete(key)
          else next.add(key)
        }
        return next
      })
    }
  }

  const { hidden, toggleExpansion, togglePatch, getExpansionState } = useSpoilerSettings()

  const dailyItems = checklistItems.filter(
    (i) =>
      i.category === "daily" &&
      i.subcategory !== "beast_tribe" &&
      !isExpansionHidden(ITEM_EXPANSION[i.name], hidden)
  )
  const weeklyItems = checklistItems.filter(
    (i) => i.category === "weekly" && !isExpansionHidden(ITEM_EXPANSION[i.name], hidden)
  )

  const dailyCompleted = dailyItems.filter((i) =>
    completedItems.has(`${i.id}:${dailyPeriod}`)
  ).length
  const weeklyCompleted = weeklyItems.filter((i) =>
    completedItems.has(`${i.id}:${weeklyPeriod}`)
  ).length

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarImage src={activeChar.avatar_url ?? undefined} alt={activeChar.name} />
            <AvatarFallback className="text-lg">{activeChar.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground text-lg leading-tight">{activeChar.name}</p>
            <p className="text-sm text-muted-foreground">{activeChar.server}</p>
          </div>

          {characters.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 ml-2">
                  Switch <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
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
                    {char.id === activeCharId && <ChevronRight className="size-3.5 ml-auto text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SpoilerDropdown
            hidden={hidden}
            onToggleExpansion={toggleExpansion}
            onTogglePatch={togglePatch}
            getExpansionState={getExpansionState}
          />
          <EorzeaClock />
        </div>
      </div>

      <ResetTimers />

      <Tabs defaultValue="daily">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="daily" className="flex-1 sm:flex-none gap-2">
            Daily
            <Badge variant="secondary" className="text-xs h-5">
              {dailyCompleted}/{dailyItems.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1 sm:flex-none gap-2">
            Weekly
            <Badge variant="secondary" className="text-xs h-5">
              {weeklyCompleted}/{weeklyItems.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="tribes" className="flex-1 sm:flex-none">
            Beast Tribes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <ChecklistSection
            items={dailyItems}
            completedKeys={completedItems}
            period={dailyPeriod}
            category="daily"
            loading={loading}
            onToggle={toggleItem}
            onToggleMany={toggleMany}
            subcategoryLabels={SUBCATEGORY_LABELS}
          />
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <ChecklistSection
            items={weeklyItems}
            completedKeys={completedItems}
            period={weeklyPeriod}
            category="weekly"
            loading={loading}
            onToggle={toggleItem}
            onToggleMany={toggleMany}
            subcategoryLabels={SUBCATEGORY_LABELS}
          />
        </TabsContent>

        <TabsContent value="tribes" className="mt-4">
          <BeastTribeGrid characterId={activeCharId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
