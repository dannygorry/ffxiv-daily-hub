"use client"

import Link from "next/link"
import { Menu, LayoutDashboard, Home, CreditCard, Users, Settings, Fish, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"

export function MobileNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <nav className="flex flex-col gap-1">
          <SheetClose asChild>
            <Link
              href="/"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Home className="size-4" />
              Home
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/ocean-fishing"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Fish className="size-4" />
              Ocean Fishing
            </Link>
          </SheetClose>
          {isLoggedIn && (
            <SheetClose asChild>
              <Link
                href="/relic-tracker"
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Swords className="size-4" />
                Relic Tracker
              </Link>
            </SheetClose>
          )}
          {isLoggedIn && (
            <SheetClose asChild>
              <Link
                href="/character/card"
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <CreditCard className="size-4" />
                Card Maker
              </Link>
            </SheetClose>
          )}
        </nav>

        <Separator className="my-4" />

        {isLoggedIn ? (
          <nav className="flex flex-col gap-1">
            <SheetClose asChild>
              <Link
                href="/character/manage"
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Users className="size-4" />
                Characters
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/settings"
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Settings className="size-4" />
                Settings
              </Link>
            </SheetClose>
          </nav>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full" asChild>
              <SheetClose asChild>
                <Link href="/auth/login">Sign In</Link>
              </SheetClose>
            </Button>
            <Button className="w-full" asChild>
              <SheetClose asChild>
                <Link href="/auth/register">Register</Link>
              </SheetClose>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
