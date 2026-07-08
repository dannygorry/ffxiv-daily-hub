import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Navbar } from "@/components/Navbar"
import { CharacterManageClient } from "./CharacterManageClient"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function ManageCharactersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: characters } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Characters</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your linked FFXIV characters
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/character/link">
              <Plus className="size-4" /> Add Character
            </Link>
          </Button>
        </div>

        <CharacterManageClient characters={characters ?? []} />
      </main>
    </div>
  )
}
