import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCharacter } from "@/lib/ffxiv/xivapi"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: character } = await supabase
    .from("characters")
    .select("id, lodestone_id, verification_code")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 })

  try {
    const detail = await getCharacter(character.lodestone_id)
    const bio = detail?.Character?.Bio ?? ""

    if (!bio.includes(character.verification_code)) {
      return NextResponse.json(
        { error: "Verification code not found in your Lodestone profile bio." },
        { status: 400 }
      )
    }

    // Update avatar and portrait from Lodestone while we're here
    await supabase
      .from("characters")
      .update({
        verified: true,
        verification_code: null,
        avatar_url: detail.Character.Avatar,
      })
      .eq("id", id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: "Could not reach XIVAPI. Please try again." },
      { status: 502 }
    )
  }
}
