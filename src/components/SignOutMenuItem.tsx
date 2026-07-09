"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { LogOut } from "lucide-react"

export function SignOutMenuItem() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <DropdownMenuItem
      className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
      onSelect={handleSignOut}
    >
      <LogOut className="size-4" /> Sign Out
    </DropdownMenuItem>
  )
}
