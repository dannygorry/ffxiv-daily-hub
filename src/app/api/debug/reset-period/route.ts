import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(req: NextRequest) {
  const debugEmails = (process.env.DEBUG_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  if (debugEmails.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !debugEmails.includes(user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get("period")
  const characterId = searchParams.get("characterId")

  if (!period || !characterId) {
    return NextResponse.json({ error: "Missing period or characterId" }, { status: 400 })
  }

  // Confirm character belongs to this user before deleting
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
