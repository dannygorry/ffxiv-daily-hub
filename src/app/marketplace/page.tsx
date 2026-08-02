import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { JOB_ROLES } from "@/lib/ffxiv/ffxiv-jobs"
import { MarketplaceScannerClient } from "./MarketplaceScannerClient"

export const metadata: Metadata = {
  title: "Marketplace Scanner",
  description:
    "See the best-selling and most valuable items on the FFXIV market board for any world.",
}

export default async function MarketplacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirectTo=/marketplace")
  }

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, server, verified, is_primary, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })

  const pool = characters ?? []
  const verified = pool.filter((c) => c.verified)
  const candidates = verified.length ? verified : pool
  const primary = candidates.find((c) => c.is_primary) ?? candidates[0] ?? null

  // Crafter levels come from the Lodestone data the card generator already
  // scrapes and caches, so this costs one query and no extra scraping.
  //
  // Null means "we don't know" rather than "no crafters" — no linked character,
  // or a character whose card data has never been generated. The client shows
  // every recipe in that case rather than silently filtering to nothing.
  let crafterLevels: Record<string, number> | null = null
  if (primary) {
    const { data: settings } = await supabase
      .from("character_card_settings")
      .select("lodestone_data")
      .eq("character_id", primary.id)
      .maybeSingle<{ lodestone_data: { jobs?: { name: string; level: number }[] } | null }>()

    const jobs = settings?.lodestone_data?.jobs
    if (Array.isArray(jobs)) {
      const levels: Record<string, number> = {}
      for (const job of jobs) {
        if (JOB_ROLES[job.name] === "crafter" && job.level > 0) levels[job.name] = job.level
      }
      // An all-zero crafter set is indistinguishable from unscraped data, so
      // treat it as unknown rather than "can craft nothing".
      if (Object.keys(levels).length > 0) crafterLevels = levels
    }
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-6">
      <MarketplaceScannerClient
        defaultWorld={primary?.server ?? null}
        crafterLevels={crafterLevels}
        characterName={primary?.name ?? null}
      />
    </div>
  )
}
