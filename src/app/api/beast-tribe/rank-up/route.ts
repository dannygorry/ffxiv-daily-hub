import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { maskToCount } from "@/lib/ffxiv/beast-tribes"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId, tribeKey, period } = await req.json()
  if (!characterId || !tribeKey || !period) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const { data: character } = await supabase
    .from("characters").select("id").eq("id", characterId).eq("user_id", user.id).single()
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Get current tribe progress
  const { data: current } = await supabase
    .from("beast_tribe_progress")
    .select("rank_level, quests_mask, quest_period")
    .eq("character_id", characterId)
    .eq("tribe_key", tribeKey)
    .maybeSingle()

  const currentMask = current?.quest_period === period ? (current?.quests_mask ?? 0) : 0
  const questsDone = maskToCount(currentMask)

  // Add today's completed quests to the daily offset so the 12-limit stays accurate
  if (questsDone > 0) {
    const { data: existing } = await supabase
      .from("beast_tribe_daily_offset")
      .select("offset_count")
      .eq("character_id", characterId)
      .eq("period", period)
      .maybeSingle()

    await supabase.from("beast_tribe_daily_offset").upsert({
      character_id: characterId,
      period,
      offset_count: (existing?.offset_count ?? 0) + questsDone,
    }, { onConflict: "character_id,period" })
  }

  // Increment rank and reset today's quests
  const newRank = (current?.rank_level ?? 1) + 1
  await supabase.from("beast_tribe_progress").upsert({
    character_id: characterId,
    tribe_key: tribeKey,
    rank_level: newRank,
    quests_mask: 0,
    quest_period: period,
  }, { onConflict: "character_id,tribe_key" })

  return NextResponse.json({ ok: true, newRank })
}
