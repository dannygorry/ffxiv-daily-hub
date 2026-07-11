import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { load } from "cheerio"

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") ?? "mount"

  // Accept either ?lodestoneId=XXXXXXXX or ?characterId=<uuid>
  let lodestoneIdNum: number | null = null

  const directLodestoneId = searchParams.get("lodestoneId")
  if (directLodestoneId) {
    lodestoneIdNum = Number(directLodestoneId)
    if (!Number.isFinite(lodestoneIdNum) || lodestoneIdNum <= 0) {
      return NextResponse.json({ error: "Invalid lodestoneId" }, { status: 400 })
    }
  } else {
    const characterId = searchParams.get("characterId")
    if (!characterId) return NextResponse.json({ error: "Missing lodestoneId or characterId" }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: char } = await supabase
      .from("characters")
      .select("lodestone_id")
      .eq("id", characterId)
      .eq("user_id", user.id)
      .single()

    if (!char?.lodestone_id) return NextResponse.json({ error: "Character not found" }, { status: 404 })
    lodestoneIdNum = Number(char.lodestone_id)
  }

  const url = `https://na.finalfantasyxiv.com/lodestone/character/${lodestoneIdNum}/${type}/`
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  })
  const html = await res.text()
  const $ = load(html)

  // Dump the outer HTML of the first 5 collection list items so we can
  // see how owned vs unowned items differ in the markup.
  const collectionClass = type === "mount" ? "mount__list_icon" : "minion__list_icon"
  const sampleItems: string[] = []
  $(`li.${collectionClass}`).slice(0, 5).each((_, el) => {
    sampleItems.push($.html(el))
  })

  // Count all collection li items and check for known "owned" markers
  const allItems = $(`li.${collectionClass}`)
  const totalItems = allItems.length
  const withIsGet = allItems.filter("[class*='is_get']").length
  const withNotGet = allItems.filter("[class*='not_get'], [class*='is_notget'], [class*='noget']").length
  const withOwned = allItems.filter("[class*='owned'], [class*='acquired'], [class*='obtained']").length

  // Look for any attribute variation on the collection items
  const attrSample: Array<Record<string, string>> = []
  allItems.slice(0, 3).each((_, el) => {
    const attrs: Record<string, string> = {}
    Object.entries(el.attribs ?? {}).forEach(([k, v]) => { attrs[k] = v })
    attrSample.push(attrs)
  })

  return NextResponse.json({
    status: res.status,
    url,
    collectionClass,
    totalItems,
    withIsGet,
    withNotGet,
    withOwned,
    attrSample,
    sampleItems,
  })
}
