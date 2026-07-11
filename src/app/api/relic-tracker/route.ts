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
    .from("relic_progress")
    .select("expansion_key, category, job_key, completed_steps")
    .eq("character_id", characterId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ progress: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { characterId, expansionKey, category, jobKey, stepKey, completed } = body as {
    characterId: string
    expansionKey: string
    category: string
    jobKey: string
    stepKey: string
    completed: boolean
  }

  if (!characterId || !expansionKey || !category || !jobKey || !stepKey) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  // Ownership check + atomic array update in one round-trip via Postgres function.
  // Eliminates the TOCTOU race from the prior read-then-upsert approach.
  const { data, error } = await supabase.rpc("toggle_relic_step", {
    p_character_id:  characterId,
    p_expansion_key: expansionKey,
    p_category:      category,
    p_job_key:       jobKey,
    p_step_key:      stepKey,
    p_completed:     completed ?? false,
  })

  if (error) {
    const status = error.message === "Not found" ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ ok: true, completedSteps: data })
}
