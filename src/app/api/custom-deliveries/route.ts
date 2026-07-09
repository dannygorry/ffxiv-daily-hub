import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const characterId = req.nextUrl.searchParams.get("characterId")
  const period = req.nextUrl.searchParams.get("period")
  if (!characterId || !period) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const { data: character } = await supabase
    .from("characters").select("id").eq("id", characterId).eq("user_id", user.id).single()
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data } = await supabase
    .from("custom_delivery_progress")
    .select("*")
    .eq("character_id", characterId)

  return NextResponse.json({ progress: data ?? [] })
}
