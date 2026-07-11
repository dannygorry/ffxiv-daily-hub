"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { PasswordInput } from "@/components/PasswordInput"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="#5865F2" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.033.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function OAuthButtons() {
  const supabase = createClient()

  async function signInWith(provider: "google" | "discord") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => signInWith("google")}>
        <GoogleIcon />
        Continue with Google
      </Button>
      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => signInWith("discord")}>
        <DiscordIcon />
        Continue with Discord
      </Button>
    </div>
  )
}

function OrDivider() {
  return (
    <div className="relative my-1">
      <Separator />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
        or
      </span>
    </div>
  )
}

function AuthForms() {
  const router = useRouter()
  const params = useSearchParams()
  const rawRedirect = params.get("redirectTo")
  const redirectTo = rawRedirect && rawRedirect.startsWith("/") ? rawRedirect : "/dashboard"
  const defaultTab = params.get("tab") === "register" ? "register" : "login"

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)

  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm, setRegConfirm] = useState("")
  const [regError, setRegError] = useState("")
  const [regLoading, setRegLoading] = useState(false)
  const [regDone, setRegDone] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError("")
    setLoginLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
      if (error) {
        setLoginError(error.message)
      } else {
        router.push(redirectTo)
        router.refresh()
      }
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (regPassword !== regConfirm) {
      setRegError("Passwords do not match")
      return
    }
    setRegError("")
    setRegLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setRegError(error.message)
      setRegLoading(false)
    } else {
      setRegDone(true)
    }
  }

  if (regDone) {
    return (
      <div className="text-center py-4 space-y-2">
        <div className="text-3xl">📬</div>
        <p className="font-semibold">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong>{regEmail}</strong>. Click it to activate your account.
        </p>
      </div>
    )
  }

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="w-full">
        <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
        <TabsTrigger value="register" className="flex-1">Create Account</TabsTrigger>
      </TabsList>

      <TabsContent value="login" className="mt-4 space-y-4">
        <OAuthButtons />
        <OrDivider />
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Password</Label>
            <PasswordInput
              id="login-password"
              placeholder="••••••••"
              value={loginPassword}
              onChange={setLoginPassword}
              autoComplete="current-password"
            />
          </div>
          {loginError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{loginError}</p>
          )}
          <Button type="submit" className="w-full" disabled={loginLoading}>
            {loginLoading ? "Signing in…" : "Sign In"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/auth/forgot-password" className="hover:text-foreground">
              Forgot your password?
            </Link>
          </p>
        </form>
      </TabsContent>

      <TabsContent value="register" className="mt-4 space-y-4">
        <OAuthButtons />
        <OrDivider />
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              type="email"
              placeholder="you@example.com"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Password</Label>
            <PasswordInput
              id="reg-password"
              placeholder="At least 6 characters"
              value={regPassword}
              onChange={setRegPassword}
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-confirm">Confirm Password</Label>
            <PasswordInput
              id="reg-confirm"
              placeholder="Repeat your password"
              value={regConfirm}
              onChange={setRegConfirm}
              autoComplete="new-password"
            />
          </div>
          {regError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{regError}</p>
          )}
          <Button type="submit" className="w-full" disabled={regLoading}>
            {regLoading ? "Creating account…" : "Create Account"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-3xl mb-2">⚔️</div>
          <CardTitle>FFXIV Daily Hub</CardTitle>
          <CardDescription>Track your daily and weekly activities</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <AuthForms />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
