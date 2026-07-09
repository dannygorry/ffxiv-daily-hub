import type { Metadata } from "next"
import Link from "next/link"
import { EorzeaClock } from "@/components/EorzeaClock"
import { ResetTimers } from "@/components/ResetTimers"
import { WeatherWidget } from "@/components/WeatherWidget"
import { OceanFishingWidget } from "@/components/OceanFishingWidget"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Home",
  description:
    "Your free FFXIV daily tracker. Eorzea time, reset timers, weather forecasts, duty roulette checklists and more — organised by character. Never miss a daily or weekly reset again.",
  openGraph: {
    title: "FFXIV Daily Hub — Free Tracker for FFXIV Players",
    description:
      "Never miss a daily or weekly reset. Eorzea weather, beast tribe tracking, custom deliveries — all in one place.",
    url: "https://ffxiv-hub.app",
  },
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-4 pt-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Never Miss a{" "}
            <span className="text-primary">Daily Reset</span> Again
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Track duty roulettes, beast tribes, Cactpot tickets, raids and more —
            resets automatically at server time, per character.
          </p>
          {!user && (
            <>
              <div className="flex gap-3 justify-center pt-1">
                <Button size="lg" asChild>
                  <Link href="/auth/register">Get Started Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/auth/login">Sign In</Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                or{" "}
                <Link
                  href="/dashboard"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  try the dashboard as a guest →
                </Link>
              </p>
            </>
          )}
          {user && (
            <Button size="lg" asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          )}

          {/* Live Eorzea clock inside the hero */}
          <div className="pt-5 mt-2 border-t border-border/40 flex justify-center">
            <EorzeaClock />
          </div>
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

        {/* Ocean Fishing */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Ocean Fishing
          </h2>
          <p className="text-xs text-muted-foreground">
            Next departures from Limsa Lominsa — boarding opens 15 minutes before each voyage
          </p>
          <OceanFishingWidget />
        </section>

        {/* Features callout */}
        {!user && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
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
              {
                icon: "👀",
                title: "Try Without Signing Up",
                desc: "Open the dashboard as a guest — your progress saves for the session. Create a free account to track across devices and characters.",
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
        <span>FFXIV Daily Hub &mdash; Fan-made tool. Not affiliated with Square Enix.</span>
      </footer>
    </div>
  )
}
