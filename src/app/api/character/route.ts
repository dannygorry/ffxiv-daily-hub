import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomBytes } from "crypto"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { lodestoneId, name, server, dataCenter, avatarUrl } = await req.json()
  if (!lodestoneId || !name || !server) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }
  const lodestoneIdNum = Number(lodestoneId)
  if (!Number.isInteger(lodestoneIdNum) || lodestoneIdNum <= 0) {
    return NextResponse.json({ error: "Invalid lodestoneId" }, { status: 400 })
  }

  const verificationCode = "XIVHUB:" + randomBytes(6).toString("hex").toUpperCase()

  // Check if this lodestone ID is already linked to another account
  const { data: existing } = await supabase
    .from("characters")
    .select("id, user_id, verified")
    .eq("lodestone_id", lodestoneId)
    .single()

  if (existing && existing.user_id !== user.id) {
    return NextResponse.json({ error: "This character is already linked to another account." }, { status: 409 })
  }

  if (existing && existing.user_id === user.id) {
    // Re-link if they already own it (maybe want to re-verify)
    const { data, error } = await supabase
      .from("characters")
      .update({ verification_code: verificationCode, verified: false })
      .eq("id", existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Check if user already has characters to determine if this should be primary
  const { count } = await supabase
    .from("characters")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  const isPrimary = (count ?? 0) === 0

  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: user.id,
      lodestone_id: lodestoneId,
      name,
      server,
      data_center: dataCenter ?? null,
      avatar_url: avatarUrl ?? null,
      verification_code: verificationCode,
      is_primary: isPrimary,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This character is already linked to another account." }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
