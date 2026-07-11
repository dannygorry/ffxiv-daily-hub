import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { endpoint, keys } = await req.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
  }

  let endpointUrl: URL
  try {
    endpointUrl = new URL(endpoint)
  } catch {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
  }
  if (endpointUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
  }
  const h = endpointUrl.hostname
  const isPrivate =
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    h.startsWith("169.254.") ||   // link-local
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) // RFC-1918 172.16.0.0/12
  if (isPrivate) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
  }

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { endpoint } = await req.json()
  await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint)
  return NextResponse.json({ ok: true })
}
