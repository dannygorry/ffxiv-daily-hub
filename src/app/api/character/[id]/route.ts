import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const allowed = ["is_primary", "sort_order"]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Reverse update order: set target primary first, then demote others.
  // This avoids a window where no character is primary (vs. the prior unset-all-then-set approach).
  if (update.is_primary === true) {
    await supabase.from("characters").update({ is_primary: true }).eq("id", id).eq("user_id", user.id)
    await supabase.from("characters").update({ is_primary: false }).eq("user_id", user.id).neq("id", id)
    delete update.is_primary
    if (!Object.keys(update).length) return NextResponse.json({ ok: true })
  }

  const { error } = await supabase
    .from("characters")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
