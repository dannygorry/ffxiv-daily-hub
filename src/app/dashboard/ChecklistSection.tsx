"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChecklistItem {
  id: string
  name: string
  description: string | null
  category: "daily" | "weekly"
  subcategory: string
  sort_order: number
}

interface ChecklistSectionProps {
  items: ChecklistItem[]
  completedKeys: Set<string>
  period: string
  category: "daily" | "weekly"
  loading: boolean
  onToggle: (itemId: string, category: "daily" | "weekly") => void
  onToggleMany: (itemIds: string[], category: "daily" | "weekly", completed: boolean) => void
  subcategoryLabels: Record<string, string>
}

function MiniCactpotRow({
  items,
  completedKeys,
  period,
  category,
  loading,
  onToggle,
}: {
  items: ChecklistItem[]
  completedKeys: Set<string>
  period: string
  category: "daily" | "weekly"
  loading: boolean
  onToggle: (itemId: string, category: "daily" | "weekly") => void
}) {
  const allDone = items.every((i) => completedKeys.has(`${i.id}:${period}`))
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-2 rounded-md hover:bg-secondary/50 transition-colors",
        allDone && "opacity-50"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", allDone && "line-through text-muted-foreground")}>
          Mini Cactpot
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Buy scratch tickets at the Cactpot Broker</p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {items.map((item, i) => {
          const done = completedKeys.has(`${item.id}:${period}`)
          return (
            <label key={item.id} className="flex flex-col items-center gap-1 cursor-pointer">
              <Checkbox
                checked={done}
                disabled={loading}
                onCheckedChange={() => onToggle(item.id, category)}
              />
              <span className="text-[10px] text-muted-foreground leading-none">{i + 1}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function SubcategoryGroup({
  label,
  items,
  completedKeys,
  period,
  category,
  loading,
  onToggle,
  onToggleMany,
}: {
  label: string
  items: ChecklistItem[]
  completedKeys: Set<string>
  period: string
  category: "daily" | "weekly"
  loading: boolean
  onToggle: (itemId: string, category: "daily" | "weekly") => void
  onToggleMany: (itemIds: string[], category: "daily" | "weekly", completed: boolean) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const completedCount = items.filter((i) => completedKeys.has(`${i.id}:${period}`)).length
  const allDone = completedCount === items.length
  const isMiniCactpot = items.length > 0 && items.every((i) => i.name.startsWith("Mini Cactpot"))
  const itemIds = items.map((i) => i.id)

  return (
    <Card className={cn("border-border gap-0 py-0", allDone && "opacity-60")}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 flex-1 text-left min-w-0"
            onClick={() => setCollapsed((p) => !p)}
          >
            {collapsed ? (
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            )}
            <CardTitle className="text-sm font-semibold truncate">{label}</CardTitle>
            <Badge variant="secondary" className="text-xs h-5 shrink-0">
              {completedCount}/{items.length}
            </Badge>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="xs"
              variant="secondary"
              disabled={loading || allDone}
              onClick={() => onToggleMany(itemIds, category, true)}
            >
              All
            </Button>
            <Button
              size="xs"
              variant="ghost"
              disabled={loading || completedCount === 0}
              onClick={() => onToggleMany(itemIds, category, false)}
            >
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="px-4 pb-3 pt-0 space-y-1">
          {isMiniCactpot ? (
            <MiniCactpotRow
              items={items}
              completedKeys={completedKeys}
              period={period}
              category={category}
              loading={loading}
              onToggle={onToggle}
            />
          ) : (
            items.map((item) => {
              const key = `${item.id}:${period}`
              const done = completedKeys.has(key)
              return (
                <label
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 py-2 px-2 rounded-md cursor-pointer",
                    "hover:bg-secondary/50 transition-colors",
                    done && "opacity-50"
                  )}
                >
                  <Checkbox
                    checked={done}
                    disabled={loading}
                    onCheckedChange={() => onToggle(item.id, category)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", done && "line-through text-muted-foreground")}>
                      {item.name}
                    </p>
                    {item.description?.trim() && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function ChecklistSection({
  items,
  completedKeys,
  period,
  category,
  loading,
  onToggle,
  onToggleMany,
  subcategoryLabels,
}: ChecklistSectionProps) {
  const subcategories = Array.from(new Set(items.map((i) => i.subcategory)))
  const completedCount = items.filter((i) => completedKeys.has(`${i.id}:${period}`)).length
  const allItemIds = items.map((i) => i.id)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {completedCount} of {items.length} completed
        </p>
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="outline"
            disabled={loading || completedCount === items.length}
            onClick={() => onToggleMany(allItemIds, category, true)}
          >
            Check all
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={loading || completedCount === 0}
            onClick={() => onToggleMany(allItemIds, category, false)}
          >
            Clear all
          </Button>
        </div>
      </div>

      {subcategories.map((sub) => (
        <SubcategoryGroup
          key={sub}
          label={subcategoryLabels[sub] ?? sub}
          items={items.filter((i) => i.subcategory === sub)}
          completedKeys={completedKeys}
          period={period}
          category={category}
          loading={loading}
          onToggle={onToggle}
          onToggleMany={onToggleMany}
        />
      ))}
    </div>
  )
}
