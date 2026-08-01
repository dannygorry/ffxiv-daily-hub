import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
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

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-6">
      <MarketplaceScannerClient defaultWorld={primary?.server ?? null} />
    </div>
  )
}
