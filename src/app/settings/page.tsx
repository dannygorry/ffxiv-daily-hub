import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Navbar } from "@/components/Navbar"
import { NotificationSettings } from "./NotificationSettings"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single()

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account preferences</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Push Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Get browser notifications to remind you about time-sensitive content.
          </p>
          <NotificationSettings
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!}
            initialPrefs={prefs ?? {
              mini_cactpot: true,
              jumbo_cactpot: true,
              daily_reset: false,
              weekly_reset: false,
            }}
          />
        </section>
      </main>
    </div>
  )
}
