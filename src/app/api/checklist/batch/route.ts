import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId, itemIds, completed, resetPeriod } = await req.json()
  if (!characterId || !itemIds?.length || !resetPeriod) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", characterId)
    .eq("user_id", user.id)
    .single()

  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 })

  if (completed) {
    const now = new Date().toISOString()
    const rows = (itemIds as string[]).map((itemId) => ({
      character_id: characterId,
      item_id: itemId,
      completed_at: now,
      reset_period: resetPeriod,
    }))
    const { error } = await supabase
      .from("checklist_state")
      .upsert(rows, { onConflict: "character_id,item_id,reset_period" })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from("checklist_state")
      .delete()
      .eq("character_id", characterId)
      .eq("reset_period", resetPeriod)
      .in("item_id", itemIds as string[])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
