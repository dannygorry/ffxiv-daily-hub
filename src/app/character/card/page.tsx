import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Navbar } from "@/components/Navbar"
import { CardGeneratorClient } from "./CardGeneratorClient"

export default async function CardGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ char?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { char } = await searchParams

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, server, data_center, avatar_url, verified")
    .eq("user_id", user.id)
    .eq("verified", true)
    .order("sort_order", { ascending: true })

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 w-full px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Character Card</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Generate a customizable card with your character&apos;s stats
            </p>
          </div>
          <CardGeneratorClient characters={characters ?? []} initialCharId={char} />
        </div>
      </main>
    </div>
  )
}
