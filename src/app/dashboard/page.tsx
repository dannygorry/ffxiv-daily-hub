import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Navbar } from "@/components/Navbar"
import { DashboardClient } from "./DashboardClient"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, server, data_center, avatar_url, verified, is_primary, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })

  const verifiedCharacters = (characters ?? []).filter((c) => c.verified)

  const { data: checklistItems } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (!verifiedCharacters.length) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center px-4 text-center space-y-4">
          <div className="text-4xl">⚔️</div>
          <h1 className="text-2xl font-bold">No characters linked yet</h1>
          <p className="text-muted-foreground max-w-sm">
            Link and verify at least one FFXIV character to start tracking your dailies and weeklies.
          </p>
          <Button asChild className="gap-2">
            <Link href="/character/link">
              <Plus className="size-4" /> Link a Character
            </Link>
          </Button>
          {(characters ?? []).length > 0 && (
            <p className="text-sm text-muted-foreground">
              You have unverified characters.{" "}
              <Link href="/character/manage" className="text-primary hover:underline">
                Manage characters
              </Link>
            </p>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 w-full px-6 py-6">
        <DashboardClient
          characters={verifiedCharacters}
          checklistItems={checklistItems ?? []}
        />
      </main>
    </div>
  )
}
