import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { scrapeLodestoneCardData } from "@/lib/ffxiv/lodestone-card"

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

async function getCharacterOwned(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase
    .from("characters")
    .select("id, lodestone_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single()
  return data
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const character = await getCharacterOwned(supabase, id, user.id)
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: settings } = await supabase
    .from("character_card_settings")
    .select("*")
    .eq("character_id", id)
    .single()

  const now = Date.now()
  const fetchedAt = settings?.lodestone_fetched_at ? new Date(settings.lodestone_fetched_at).getTime() : 0
  const stale = now - fetchedAt > CACHE_TTL_MS

  let lodestoneData = settings?.lodestone_data ?? null

  if (stale || !lodestoneData) {
    try {
      lodestoneData = await scrapeLodestoneCardData(Number(character.lodestone_id))
      await supabase.from("character_card_settings").upsert({
        character_id: id,
        user_id: user.id,
        lodestone_data: lodestoneData,
        lodestone_fetched_at: new Date().toISOString(),
      }, { onConflict: "character_id" })
    } catch {
      if (!lodestoneData) {
        return NextResponse.json({ error: "Failed to fetch Lodestone data" }, { status: 502 })
      }
      // Use stale cache if scrape failed
    }
  }

  return NextResponse.json({
    lodestoneData,
    cardSettings: {
      customPortraitUrl: settings?.custom_portrait_url ?? null,
      cardAccentColor: settings?.card_accent_color ?? "#4f8ef7",
      showJobGrid: settings?.show_job_grid ?? true,
      showMounts: settings?.show_mounts ?? true,
      showMinions: settings?.show_minions ?? true,
      showEureka: settings?.show_eureka ?? false,
      showRelicProgress: settings?.show_relic_progress ?? false,
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const character = await getCharacterOwned(supabase, id, user.id)
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const patch: Record<string, unknown> = { character_id: id, user_id: user.id, updated_at: new Date().toISOString() }
  if (body.cardAccentColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(body.cardAccentColor)) {
      return NextResponse.json({ error: "Invalid cardAccentColor" }, { status: 400 })
    }
    patch.card_accent_color = body.cardAccentColor
  }
  if (body.showJobGrid !== undefined) patch.show_job_grid = body.showJobGrid
  if (body.showMounts !== undefined) patch.show_mounts = body.showMounts
  if (body.showMinions !== undefined) patch.show_minions = body.showMinions
  if (body.showEureka !== undefined) patch.show_eureka = body.showEureka
  if (body.showRelicProgress !== undefined) patch.show_relic_progress = body.showRelicProgress

  const { error } = await supabase
    .from("character_card_settings")
    .upsert(patch, { onConflict: "character_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PUT: Force refresh Lodestone data
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const character = await getCharacterOwned(supabase, id, user.id)
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const lodestoneData = await scrapeLodestoneCardData(Number(character.lodestone_id))
    await supabase.from("character_card_settings").upsert({
      character_id: id,
      user_id: user.id,
      lodestone_data: lodestoneData,
      lodestone_fetched_at: new Date().toISOString(),
    }, { onConflict: "character_id" })
    return NextResponse.json({ lodestoneData })
  } catch (err) {
    console.error("[card-data PUT] scrape failed:", err)
    return NextResponse.json({ error: "Failed to fetch Lodestone data" }, { status: 502 })
  }
}
