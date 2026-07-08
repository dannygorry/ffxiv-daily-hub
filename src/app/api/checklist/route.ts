import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId, itemId, completed, resetPeriod } = await req.json()
  if (!characterId || !itemId || !resetPeriod) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  // Verify this character belongs to the user
  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", characterId)
    .eq("user_id", user.id)
    .single()

  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 })

  if (completed) {
    const { error } = await supabase.from("checklist_state").upsert({
      character_id: characterId,
      item_id: itemId,
      completed_at: new Date().toISOString(),
      reset_period: resetPeriod,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from("checklist_state")
      .delete()
      .eq("character_id", characterId)
      .eq("item_id", itemId)
      .eq("reset_period", resetPeriod)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
