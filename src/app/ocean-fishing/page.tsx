import type { Metadata } from "next"
import { OceanFishingClient } from "./OceanFishingClient"

export const metadata: Metadata = {
  title: "Ocean Fishing",
  description:
    "FFXIV Ocean Fishing schedule and bait guide. See upcoming departures from Limsa Lominsa with route, time of day, and recommended baits for every voyage.",
}

export default function OceanFishingPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Ocean Fishing</h1>
        <p className="text-sm text-muted-foreground">
          Departures from Limsa Lominsa every 2 hours · boarding opens 15 minutes before each voyage
        </p>
      </div>
      <OceanFishingClient />
    </div>
  )
}
