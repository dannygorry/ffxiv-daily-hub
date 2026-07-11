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

  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", characterId)
    .eq("user_id", user.id)
    .single()
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: existing } = await supabase
    .from("relic_progress")
    .select("completed_steps")
    .eq("character_id", characterId)
    .eq("expansion_key", expansionKey)
    .eq("category", category)
    .eq("job_key", jobKey)
    .maybeSingle()

  const currentSteps: string[] = existing?.completed_steps ?? []
  const newSteps = completed
    ? [...new Set([...currentSteps, stepKey])]
    : currentSteps.filter((s) => s !== stepKey)

  const { error } = await supabase
    .from("relic_progress")
    .upsert(
      {
        character_id: characterId,
        expansion_key: expansionKey,
        category,
        job_key: jobKey,
        completed_steps: newSteps,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "character_id,expansion_key,category,job_key" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, completedSteps: newSteps })
}
