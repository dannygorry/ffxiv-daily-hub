import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { maskToCount, BEAST_TRIBES } from "@/lib/ffxiv/beast-tribes"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId, tribeKey, period } = await req.json()
  if (!characterId || !tribeKey || !period) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const tribe = BEAST_TRIBES.find((t) => t.key === tribeKey)
  if (!tribe) return NextResponse.json({ error: "Unknown tribe" }, { status: 400 })

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

  // Increment rank and reset today's quests (capped at tribe's max rank).
  // Use conditional UPDATE to avoid a TOCTOU race: only advance rank if the
  // row still has the rank we just read.  If a concurrent request already
  // incremented it, the update is a no-op (idempotent from the user's view).
  const maxRank = tribe.ranks.length - 1
  const currentRank = current?.rank_level ?? 1
  if (currentRank >= maxRank) {
    return NextResponse.json({ ok: true, newRank: currentRank })
  }
  const newRank = currentRank + 1
  const { error: updateErr } = await supabase
    .from("beast_tribe_progress")
    .update({ rank_level: newRank, quests_mask: 0, quest_period: period })
    .eq("character_id", characterId)
    .eq("tribe_key", tribeKey)
    .eq("rank_level", currentRank) // only advance if rank hasn't changed
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, newRank })
}
