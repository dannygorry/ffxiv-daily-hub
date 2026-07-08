"use client"

import { useState, useEffect, useCallback } from "react"
import { EXPANSION_CONFIG, DEFAULT_HIDDEN, ORDERED_IDS, type ExpansionId } from "@/lib/spoiler"

const STORAGE_KEY = "ffxiv-hidden-expansions"

// Given a cutoff ID, hide everything that comes after it in the progression order.
// cutoffId = null means hide everything.
function computeHiddenFromCutoff(cutoffId: ExpansionId | null): Set<ExpansionId> {
  const idx = cutoffId === null ? -1 : ORDERED_IDS.indexOf(cutoffId)
  return new Set(ORDERED_IDS.filter((_, i) => i > idx))
}

function persist(set: Set<ExpansionId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {}
}

export function useSpoilerSettings() {
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

  // Clicking a parent expansion:
  // - If fully shown → hide it and everything after (cutoff moves before it)
  // - If fully/partially hidden → show the whole expansion (cutoff moves to its last patch)
  const toggleExpansion = useCallback((id: ExpansionId) => {
    const expConfig = EXPANSION_CONFIG.find((e) => e.id === id)!
    setHidden((prev) => {
      const childIds = expConfig.patches.map((p) => p.id)
      const allShown = !prev.has(id) && childIds.every((c) => !prev.has(c))

      let next: Set<ExpansionId>
      if (allShown) {
        // Fully shown → hide this expansion and everything after
        const expIdx = ORDERED_IDS.indexOf(id)
        next = computeHiddenFromCutoff(expIdx > 0 ? ORDERED_IDS[expIdx - 1] : null)
      } else {
        // Hidden/partial → show the entire expansion (and everything before it)
        next = computeHiddenFromCutoff(expConfig.patches.at(-1)!.id)
      }
      persist(next)
      return next
    })
  }, [])

  // Clicking a sub-patch:
  // - If hidden → show it (and cascade: show everything before it too)
  // - If shown → hide it (and cascade: hide everything after it too)
  const togglePatch = useCallback((id: ExpansionId) => {
    setHidden((prev) => {
      let next: Set<ExpansionId>
      if (prev.has(id)) {
        // Hidden → set this as the new cutoff (show it + everything before)
        next = computeHiddenFromCutoff(id)
      } else {
        // Shown → move cutoff to just before this patch (hide it + everything after)
        const idx = ORDERED_IDS.indexOf(id)
        next = computeHiddenFromCutoff(idx > 0 ? ORDERED_IDS[idx - 1] : null)
      }
      persist(next)
      return next
    })
  }, [])

  // Returns true / false / 'indeterminate' for a parent expansion checkbox
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

  return { hidden, toggleExpansion, togglePatch, getExpansionState }
}
