import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get("period")
  const characterId = searchParams.get("characterId")

  if (!period || !characterId) {
    return NextResponse.json({ error: "Missing period or characterId" }, { status: 400 })
  }

  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", characterId)
    .eq("user_id", user.id)
    .single()

  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 })
  }

  await supabase
    .from("checklist_state")
    .delete()
    .eq("character_id", characterId)
    .eq("reset_period", period)

  return NextResponse.json({ ok: true })
}
