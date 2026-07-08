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
  subcategoryLabels: Record<string, string>
}

function SubcategoryGroup({
  label,
  items,
  completedKeys,
  period,
  category,
  loading,
  onToggle,
}: {
  label: string
  items: ChecklistItem[]
  completedKeys: Set<string>
  period: string
  category: "daily" | "weekly"
  loading: boolean
  onToggle: (itemId: string, category: "daily" | "weekly") => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const completedCount = items.filter((i) => completedKeys.has(`${i.id}:${period}`)).length
  const allDone = completedCount === items.length

  return (
    <Card className={cn("border-border", allDone && "opacity-60")}>
      <CardHeader className="py-3 px-4">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setCollapsed((p) => !p)}
        >
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
            <Badge variant="secondary" className="text-xs h-5">
              {completedCount}/{items.length}
            </Badge>
          </div>
          {collapsed ? (
            <ChevronRight className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {!collapsed && (
        <CardContent className="px-4 pb-3 pt-0 space-y-1">
          {items.map((item) => {
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
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </div>
              </label>
            )
          })}
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
  subcategoryLabels,
}: ChecklistSectionProps) {
  const subcategories = Array.from(new Set(items.map((i) => i.subcategory)))

  const completedCount = items.filter((i) => completedKeys.has(`${i.id}:${period}`)).length

  async function markAll(completed: boolean) {
    const pending = items.filter((i) => {
      const done = completedKeys.has(`${i.id}:${period}`)
      return completed ? !done : done
    })
    for (const item of pending) {
      await onToggle(item.id, category)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {completedCount} of {items.length} completed
        </p>
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => markAll(true)}>
            Check all
          </Button>
          <Button size="xs" variant="ghost" onClick={() => markAll(false)}>
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
        />
      ))}
    </div>
  )
}
