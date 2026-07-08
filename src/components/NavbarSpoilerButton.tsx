"use client"

import { SpoilerDropdown } from "@/components/SpoilerDropdown"
import { useSpoilerSettings } from "@/hooks/useSpoilerSettings"

export function NavbarSpoilerButton() {
  const { hidden, toggleExpansion, togglePatch, getExpansionState } = useSpoilerSettings()
  return (
    <SpoilerDropdown
      hidden={hidden}
      onToggleExpansion={toggleExpansion}
      onTogglePatch={togglePatch}
      getExpansionState={getExpansionState}
    />
  )
}
