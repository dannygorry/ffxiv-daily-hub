import webpush from "web-push"

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) throw new Error("VAPID keys not configured")
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? "admin@example.com"}`,
    pub,
    priv
  )
  vapidConfigured = true
}

export interface PushSubscriptionRecord {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: { title: string; body: string; url?: string }
) {
  ensureVapid()
  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload)
  )
}
