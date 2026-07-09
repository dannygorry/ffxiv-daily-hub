import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { VerifyCharacterClient } from "./VerifyCharacterClient"

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: character } = await supabase
    .from("characters")
    .select("id, name, server, verification_code, verified")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!character) notFound()
  if (character.verified) redirect("/character/manage")

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8">
        <VerifyCharacterClient character={character} />
      </main>
    </div>
  )
}
