import { NextRequest, NextResponse } from "next/server"

const ALLOWED_HOSTNAMES = [
  "img2.finalfantasyxiv.com",
  "img.finalfantasyxiv.com",
  "lds-img.finalfantasyxiv.com",
]

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  if (!ALLOWED_HOSTNAMES.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Forbidden hostname" }, { status: 403 })
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: "Upstream error" }, { status: res.status })
  }

  const rawContentType = res.headers.get("content-type") ?? "image/jpeg"
  const contentType = rawContentType.startsWith("image/") ? rawContentType : "image/jpeg"
  const buffer = await res.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
