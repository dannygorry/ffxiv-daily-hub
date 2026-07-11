import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RelicTrackerClient } from "./RelicTrackerClient"

export const metadata: Metadata = {
  title: "Relic Tracker",
  description:
    "Track your FFXIV relic weapon, armor, and tool progress across all expansions — per character.",
}

export default async function RelicTrackerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirectTo=/relic-tracker")
  }

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, server, data_center, avatar_url, verified, is_primary, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })

  const verifiedCharacters = (characters ?? []).filter((c) => c.verified)

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-6">
      <RelicTrackerClient characters={verifiedCharacters} />
    </div>
  )
}
