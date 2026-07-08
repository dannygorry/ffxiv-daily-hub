import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendPushNotification } from "@/lib/push/webpush"

const MESSAGES: Record<string, { title: string; body: string }> = {
  mini_cactpot: {
    title: "🌵 Mini Cactpot Reminder",
    body: "Daily reset in 30 minutes — don't forget your 3 Mini Cactpot tickets!",
  },
  jumbo_cactpot: {
    title: "🎰 Jumbo Cactpot Draw Soon",
    body: "The Jumbo Cactpot draws in about 30 minutes. Make sure you have your ticket!",
  },
  daily_reset: {
    title: "🔄 Daily Reset in 15 minutes",
    body: "Your FFXIV daily tasks reset soon. Head to your dashboard to track progress.",
  },
  weekly_reset: {
    title: "📅 Weekly Reset in 15 minutes",
    body: "FFXIV weekly tasks reset soon. Check your dashboard for weekly items.",
  },
}

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const type = req.nextUrl.searchParams.get("type")
  if (!type || !(type in MESSAGES)) {
    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  }

  const message = MESSAGES[type]
  const supabase = await createClient()

  const preferenceField = type as keyof typeof MESSAGES

  // Fetch users who opted into this reminder, then their subscriptions
  const { data: optedIn } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .eq(preferenceField, true)

  const userIds = (optedIn ?? []).map((r) => r.user_id)
  if (!userIds.length) return NextResponse.json({ sent: 0 })

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds)

  if (!subscriptions?.length) {
    return NextResponse.json({ sent: 0 })
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendPushNotification(sub, { ...message, url: "/dashboard" })
    )
  )

  const sent = results.filter((r) => r.status === "fulfilled").length
  const failed = results.length - sent

  return NextResponse.json({ sent, failed })
}
