"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Bell, BellOff, BellRing } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Prefs {
  mini_cactpot: boolean
  jumbo_cactpot: boolean
  daily_reset: boolean
  weekly_reset: boolean
}

const REMINDER_OPTIONS: { key: keyof Prefs; label: string; description: string }[] = [
  { key: "mini_cactpot", label: "Mini Cactpot", description: "30 min before daily reset" },
  { key: "jumbo_cactpot", label: "Jumbo Cactpot", description: "30 min before Saturday draw" },
  { key: "daily_reset", label: "Daily Reset", description: "15 min before daily reset" },
  { key: "weekly_reset", label: "Weekly Reset", description: "15 min before Tuesday reset" },
]

export function NotificationSettings({
  vapidPublicKey,
  initialPrefs,
}: {
  vapidPublicKey: string
  initialPrefs: Prefs
}) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [subscribed, setSubscribed] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState("")
  const pendingPrefsRef = useRef<Prefs | null>(null)
  const savingPrefsRef = useRef(false)

  useEffect(() => {
    const ok = "Notification" in window
    setSupported(ok)
    if (!ok) return
    setPermission(Notification.permission)
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
    )
  }, [])

  async function enableNotifications() {
    setSaving(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      setPermission(permission)
      if (permission !== "granted") {
        setSaving(false)
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as ArrayBuffer,
      })

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) {
        await sub.unsubscribe()
        setStatus("Failed to save subscription. Please try again.")
        return
      }

      setSubscribed(true)
      setStatus("Notifications enabled!")
    } catch (err) {
      setStatus("Failed to enable notifications.")
    } finally {
      setSaving(false)
    }
  }

  async function disableNotifications() {
    setSaving(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setStatus("Notifications disabled.")
    } catch {
      setStatus("Failed to disable notifications. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function savePrefs(newPrefs: Prefs) {
    setPrefs(newPrefs)
    pendingPrefsRef.current = newPrefs
    if (savingPrefsRef.current) return
    savingPrefsRef.current = true
    try {
      while (pendingPrefsRef.current) {
        const toSave = pendingPrefsRef.current
        pendingPrefsRef.current = null
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from("notification_preferences").upsert({ user_id: user.id, ...toSave })
      }
    } finally {
      savingPrefsRef.current = false
    }
  }

  function togglePref(key: keyof Prefs) {
    const updated = { ...prefs, [key]: !prefs[key] }
    savePrefs(updated)
  }

  // null = still detecting (SSR / first render) → render nothing to avoid hydration mismatch
  if (supported === null) return null
  if (!supported) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-muted-foreground text-sm">
            Your browser does not support push notifications.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {subscribed ? <BellRing className="size-4 text-primary" /> : <Bell className="size-4" />}
            Browser Notifications
          </CardTitle>
          <CardDescription>
            {subscribed
              ? "You're subscribed. Configure reminders below."
              : "Enable browser notifications to receive reminders."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!subscribed ? (
            <Button onClick={enableNotifications} disabled={saving} className="gap-2">
              <Bell className="size-4" />
              {saving ? "Enabling…" : "Enable Notifications"}
            </Button>
          ) : (
            <Button variant="outline" onClick={disableNotifications} disabled={saving} className="gap-2">
              <BellOff className="size-4" />
              {saving ? "Disabling…" : "Disable Notifications"}
            </Button>
          )}
          {status && <p className="text-xs text-muted-foreground mt-2">{status}</p>}
        </CardContent>
      </Card>

      {subscribed && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Reminder Types</CardTitle>
            <CardDescription>Choose which events trigger a notification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REMINDER_OPTIONS.map(({ key, label, description }) => (
              <label
                key={key}
                className="flex items-center justify-between cursor-pointer py-1"
              >
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={() => togglePref(key)}
                  className="size-4 accent-primary"
                />
              </label>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}
