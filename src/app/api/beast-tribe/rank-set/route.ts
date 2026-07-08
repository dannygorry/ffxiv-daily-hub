import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Set a tribe's rank directly — used for rank-down corrections without touching quests or offset
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId, tribeKey, rankLevel } = await req.json()
  if (!characterId || !tribeKey || rankLevel == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const { data: character } = await supabase
    .from("characters").select("id").eq("id", characterId).eq("user_id", user.id).single()
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase.from("beast_tribe_progress").upsert(
    { character_id: characterId, tribe_key: tribeKey, rank_level: rankLevel },
    { onConflict: "character_id,tribe_key" }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
