"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { EXPANSION_CONFIG, DEFAULT_HIDDEN, ORDERED_IDS, type ExpansionId } from "@/lib/spoiler"

const STORAGE_KEY = "ffxiv-hidden-expansions"

function computeHiddenFromCutoff(cutoffId: ExpansionId | null): Set<ExpansionId> {
  const idx = cutoffId === null ? -1 : ORDERED_IDS.indexOf(cutoffId)
  return new Set(ORDERED_IDS.filter((_, i) => i > idx))
}

function persist(set: Set<ExpansionId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {}
}

type SpoilerContextValue = {
  hidden: Set<ExpansionId>
  toggleExpansion: (id: ExpansionId) => void
  togglePatch: (id: ExpansionId) => void
  getExpansionState: (id: ExpansionId) => boolean | "indeterminate"
}

const SpoilerContext = createContext<SpoilerContextValue | null>(null)

export function SpoilerProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<Set<ExpansionId>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === null) {
        const defaults = new Set<ExpansionId>(DEFAULT_HIDDEN)
        setHidden(defaults)
        persist(defaults)
      } else {
        setHidden(new Set(JSON.parse(raw) as ExpansionId[]))
      }
    } catch {}
  }, [])

  const toggleExpansion = useCallback((id: ExpansionId) => {
    const expConfig = EXPANSION_CONFIG.find((e) => e.id === id)!
    setHidden((prev) => {
      const childIds = expConfig.patches.map((p) => p.id)
      const allShown = !prev.has(id) && childIds.every((c) => !prev.has(c))
      let next: Set<ExpansionId>
      if (allShown) {
        const expIdx = ORDERED_IDS.indexOf(id)
        next = computeHiddenFromCutoff(expIdx > 0 ? ORDERED_IDS[expIdx - 1] : null)
      } else {
        next = computeHiddenFromCutoff(expConfig.patches.at(-1)!.id)
      }
      persist(next)
      return next
    })
  }, [])

  const togglePatch = useCallback((id: ExpansionId) => {
    setHidden((prev) => {
      let next: Set<ExpansionId>
      if (prev.has(id)) {
        next = computeHiddenFromCutoff(id)
      } else {
        const idx = ORDERED_IDS.indexOf(id)
        next = computeHiddenFromCutoff(idx > 0 ? ORDERED_IDS[idx - 1] : null)
      }
      persist(next)
      return next
    })
  }, [])

  const getExpansionState = useCallback(
    (id: ExpansionId): boolean | "indeterminate" => {
      const expConfig = EXPANSION_CONFIG.find((e) => e.id === id)
      if (!expConfig) return hidden.has(id)
      const childIds = expConfig.patches.map((p) => p.id)
      const hiddenChildren = childIds.filter((c) => hidden.has(c))
      if (hidden.has(id) && hiddenChildren.length === childIds.length) return true
      if (!hidden.has(id) && hiddenChildren.length === 0) return false
      return "indeterminate"
    },
    [hidden]
  )

  return (
    <SpoilerContext.Provider value={{ hidden, toggleExpansion, togglePatch, getExpansionState }}>
      {children}
    </SpoilerContext.Provider>
  )
}

export function useSpoilerSettings() {
  const ctx = useContext(SpoilerContext)
  if (!ctx) throw new Error("useSpoilerSettings must be used within SpoilerProvider")
  return ctx
}
