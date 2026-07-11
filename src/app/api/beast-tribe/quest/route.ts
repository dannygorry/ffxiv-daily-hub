import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId, tribeKey, questMask, period } = await req.json()
  if (!characterId || tribeKey == null || questMask == null || !period) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }
  if (typeof questMask !== "number" || !Number.isInteger(questMask) || questMask < 0 || questMask > 7) {
    return NextResponse.json({ error: "Invalid questMask" }, { status: 400 })
  }

  const { data: character } = await supabase
    .from("characters").select("id").eq("id", characterId).eq("user_id", user.id).single()
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase.from("beast_tribe_progress").upsert({
    character_id: characterId,
    tribe_key: tribeKey,
    quests_mask: questMask,
    quest_period: period,
  }, { onConflict: "character_id,tribe_key", ignoreDuplicates: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
