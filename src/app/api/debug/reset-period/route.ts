import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get("period")
  const characterId = searchParams.get("characterId")
  const rawType = searchParams.get("type")

  if (!period || !characterId || !rawType) {
    return NextResponse.json({ error: "Missing period, characterId or type" }, { status: 400 })
  }
  if (rawType !== "daily" && rawType !== "weekly") {
    return NextResponse.json({ error: "type must be daily or weekly" }, { status: 400 })
  }
  const type = rawType

  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", characterId)
    .eq("user_id", user.id)
    .single()

  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 })

  // Clear checklist state for this period
  await supabase
    .from("checklist_state")
    .delete()
    .eq("character_id", characterId)
    .eq("reset_period", period)

  if (type === "daily") {
    // Reset beast tribe daily quests by clearing quest_period (makes them appear unchecked)
    await supabase
      .from("beast_tribe_progress")
      .update({ quests_mask: 0, quest_period: "" })
      .eq("character_id", characterId)

    // Clear daily offset tracking
    await supabase
      .from("beast_tribe_daily_offset")
      .delete()
      .eq("character_id", characterId)
      .eq("period", period)
  }

  if (type === "weekly") {
    // Reset custom delivery weekly masks by clearing delivery_period
    await supabase
      .from("custom_delivery_progress")
      .update({ deliveries_mask: 0, delivery_period: "" })
      .eq("character_id", characterId)
  }

  return NextResponse.json({ ok: true })
}
