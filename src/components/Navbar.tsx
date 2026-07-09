import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Settings, Users, LayoutDashboard } from "lucide-react"
import { NavbarSpoilerButton } from "@/components/NavbarSpoilerButton"
import { SignOutMenuItem } from "@/components/SignOutMenuItem"
import { MobileNav } from "@/components/MobileNav"

export async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4 relative">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-primary font-bold text-lg tracking-tight">
            ⚔️ FFXIV Hub
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors"
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/ocean-fishing"
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors"
          >
            Ocean Fishing
          </Link>
          {user && (
            <Link
              href="/character/card"
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors"
            >
              Card Maker
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <NavbarSpoilerButton />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="rounded-full">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {user.email?.[0]?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <LayoutDashboard className="size-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/character/manage" className="flex items-center gap-2">
                    <Users className="size-4" /> Characters
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <SignOutMenuItem />
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/register">Register</Link>
              </Button>
            </div>
          )}
          <div className="flex md:hidden">
            <MobileNav isLoggedIn={!!user} />
          </div>
        </div>
      </div>
    </header>
  )
}
