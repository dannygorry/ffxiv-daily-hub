"use client"

import { useState, useRef, useEffect } from "react"
import { Eye, EyeOff, ChevronDown, ChevronRight, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { EXPANSION_CONFIG, type ExpansionId } from "@/lib/spoiler"

interface Props {
  hidden: Set<ExpansionId>
  onToggleExpansion: (id: ExpansionId) => void
  onTogglePatch: (id: ExpansionId) => void
  getExpansionState: (id: ExpansionId) => boolean | "indeterminate"
}

export function SpoilerDropdown({ hidden, onToggleExpansion, onTogglePatch, getExpansionState }: Props) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [open])

  // Count top-level expansions that have any hidden content
  const activeCount = EXPANSION_CONFIG.filter(
    (e) => hidden.has(e.id) || e.patches.some((p) => hidden.has(p.id))
  ).length

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        variant={activeCount > 0 ? "default" : "outline"}
        onClick={() => setOpen((p) => !p)}
        className="gap-2 font-medium"
      >
        <ShieldAlert className="size-3.5" />
        Spoilers
        {activeCount > 0 && (
          <span className="bg-primary-foreground/20 text-primary-foreground text-[10px] font-bold rounded px-1 leading-4">
            {activeCount} hidden
          </span>
        )}
        {activeCount === 0 && <Eye className="size-3 opacity-60" />}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Spoiler Filter</p>
              <p className="text-[11px] text-muted-foreground">
                Hide content from expansions you haven&apos;t reached
              </p>
            </div>
          </div>

          {/* Expansion list */}
          <div className="overflow-y-auto max-h-[420px] py-1">
            {EXPANSION_CONFIG.map((exp) => {
              const isExpanded = expanded.has(exp.id)
              const state = getExpansionState(exp.id)

              return (
                <div key={exp.id} className="border-b border-border/30 last:border-0">
                  {/* Expansion row */}
                  <div className="flex items-center gap-1 px-3 py-2 hover:bg-secondary/40 group">
                    <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                      <Checkbox
                        checked={state}
                        onCheckedChange={() => onToggleExpansion(exp.id)}
                        className="size-4 shrink-0"
                      />
                      <span className="text-xs font-black w-8 shrink-0 text-primary">
                        {exp.shortLabel}
                      </span>
                      <span className="text-sm font-medium text-foreground">{exp.label}</span>
                    </label>

                    {/* Expand/collapse sub-patches */}
                    <button
                      onClick={() => toggleExpanded(exp.id)}
                      className="ml-auto p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title={isExpanded ? "Collapse patches" : "Expand patches"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Sub-patches */}
                  {isExpanded && (
                    <div className="bg-muted/20 border-t border-border/20">
                      {exp.patches.map((patch) => (
                        <label
                          key={patch.id}
                          className="flex items-center gap-2.5 px-8 py-1.5 hover:bg-secondary/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={hidden.has(patch.id)}
                            onCheckedChange={() => onTogglePatch(patch.id)}
                            className="size-3.5 shrink-0"
                          />
                          <span className="text-xs font-semibold text-muted-foreground w-5 shrink-0">
                            {patch.label}
                          </span>
                          <span className="text-xs text-muted-foreground/80 truncate">
                            {patch.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border bg-muted/20">
            <p className="text-[10px] text-muted-foreground">
              Hidden content disappears from checklists and weather
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
