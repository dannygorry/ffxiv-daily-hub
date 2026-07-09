import Link from "next/link"
import { EorzeaClock } from "@/components/EorzeaClock"
import { ResetTimers } from "@/components/ResetTimers"
import { WeatherWidget } from "@/components/WeatherWidget"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-3 pt-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Your <span className="text-primary">FFXIV</span> Daily Hub
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Track resets, check Eorzea weather, and never miss your dailies or weeklies again.
            Link your characters and keep all your alts organised in one place.
          </p>
          {!user && (
            <div className="flex gap-3 justify-center pt-2">
              <Button size="lg" asChild>
                <Link href="/auth/register">Get Started Free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>
          )}
          {user && (
            <Button size="lg" asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          )}
        </section>

        {/* Eorzea Clock */}
        <section className="flex justify-center">
          <EorzeaClock />
        </section>

        {/* Reset Timers */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Reset Timers
          </h2>
          <ResetTimers />
        </section>

        {/* Weather */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Eorzea Weather
          </h2>
          <p className="text-xs text-muted-foreground">
            Current and upcoming weather windows (each window is ~23 minutes 20 seconds)
          </p>
          <WeatherWidget />
        </section>

        {/* Features callout */}
        {!user && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
            {[
              {
                icon: "✅",
                title: "Daily & Weekly Checklists",
                desc: "Track duty roulettes, beast tribes, cactpot, hunts, raids and more — per character.",
              },
              {
                icon: "👥",
                title: "Multi-Character Support",
                desc: "Link your main and all your alts. Switch between characters instantly on your dashboard.",
              },
              {
                icon: "🔔",
                title: "Push Notifications",
                desc: "Get browser reminders for Mini Cactpot, Jumbo Cactpot, and reset times.",
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="bg-card border border-border rounded-lg p-5 space-y-2"
              >
                <div className="text-2xl">{icon}</div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        FFXIV Daily Hub &mdash; Fan-made tool. Not affiliated with Square Enix.
      </footer>
    </div>
  )
}
