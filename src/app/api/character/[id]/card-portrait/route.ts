import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get("portrait")
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type. Use JPEG, PNG, or WebP." }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  if (buffer.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 400 })
  }

  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg"
  const storagePath = `${user.id}/${id}/portrait.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("character-card-uploads")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage
    .from("character-card-uploads")
    .getPublicUrl(storagePath)

  const publicUrl = urlData.publicUrl

  await supabase.from("character_card_settings").upsert(
    { character_id: id, user_id: user.id, custom_portrait_url: publicUrl, updated_at: new Date().toISOString() },
    { onConflict: "character_id" }
  )

  return NextResponse.json({ url: publicUrl })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Remove all portrait files for this character
  const { data: files } = await supabase.storage
    .from("character-card-uploads")
    .list(`${user.id}/${id}`)

  if (files && files.length > 0) {
    const paths = files.map((f) => `${user.id}/${id}/${f.name}`)
    await supabase.storage.from("character-card-uploads").remove(paths)
  }

  await supabase.from("character_card_settings").upsert(
    { character_id: id, user_id: user.id, custom_portrait_url: null, updated_at: new Date().toISOString() },
    { onConflict: "character_id" }
  )

  return NextResponse.json({ ok: true })
}
