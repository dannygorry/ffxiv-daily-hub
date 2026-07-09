import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { characterId, clientKey, satisfactionLevel } = await req.json()
  if (!characterId || !clientKey || satisfactionLevel == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const { data: character } = await supabase
    .from("characters").select("id").eq("id", characterId).eq("user_id", user.id).single()
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase.from("custom_delivery_progress").upsert(
    { character_id: characterId, client_key: clientKey, satisfaction_level: satisfactionLevel },
    { onConflict: "character_id,client_key" }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
