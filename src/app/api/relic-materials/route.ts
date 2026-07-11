import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const characterId = req.nextUrl.searchParams.get("characterId")
  if (!characterId) return NextResponse.json({ error: "Missing characterId" }, { status: 400 })

  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", characterId)
    .eq("user_id", user.id)
    .single()
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase
    .from("relic_materials")
    .select("expansion_key, category, material_key, held_count")
    .eq("character_id", characterId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ materials: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { characterId, expansionKey, category, materialKey, heldCount } = body as {
    characterId: string
    expansionKey: string
    category: string
    materialKey: string
    heldCount: number
  }

  if (!characterId || !expansionKey || !category || !materialKey || heldCount == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", characterId)
    .eq("user_id", user.id)
    .single()
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase
    .from("relic_materials")
    .upsert(
      {
        character_id: characterId,
        expansion_key: expansionKey,
        category,
        material_key: materialKey,
        held_count: Math.max(0, Math.floor(heldCount)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "character_id,expansion_key,category,material_key" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
