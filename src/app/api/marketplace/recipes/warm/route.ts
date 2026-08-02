import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRecipeCacheStatus, warmRecipeCache } from "@/lib/ffxiv/recipes"

// ~28 paginated recipe pages plus ~100 item-metadata batches.
export const maxDuration = 300

/**
 * Rebuilds the recipe cache. Deliberately a separate, explicitly-invoked route
 * rather than something a marketplace scan can trigger: the first visitor to a
 * world should never pay for a full catalogue fetch.
 *
 * Gated on CRON_SECRET rather than plain authentication — every signed-in user
 * would otherwise be able to kick off ~130 XIVAPI requests on demand.
 */
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization")
  return header === `Bearer ${secret}`
}

export async function GET() {
  // Status is safe to expose to any signed-in user: counts and timestamps only,
  // and it's what the Crafting tab needs to explain an unwarmed cache.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json(await getRecipeCacheStatus())
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await warmRecipeCache()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[recipes warm] failed:", err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
