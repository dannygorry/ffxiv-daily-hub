import { NextRequest, NextResponse } from "next/server"
import { searchCharacter } from "@/lib/ffxiv/xivapi"

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim()
  const server = req.nextUrl.searchParams.get("server")?.trim() || undefined

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  try {
    const results = await searchCharacter(name, server)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json(
      { error: "Could not reach Lodestone. Please try again." },
      { status: 502 }
    )
  }
}
