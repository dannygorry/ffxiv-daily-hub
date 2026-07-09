"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/PasswordInput"

export function ChangePasswordForm({ hasPasswordIdentity }: { hasPasswordIdentity: boolean }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setError("")
    setSuccess(false)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setPassword("")
      setConfirm("")
    }
    setLoading(false)
  }

  if (!hasPasswordIdentity) {
    return (
      <p className="text-sm text-muted-foreground">
        Your account uses social login (Google or Discord). Password changes are not available.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New Password</Label>
        <PasswordInput
          id="new-password"
          placeholder="At least 6 characters"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={6}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <PasswordInput
          id="confirm-password"
          placeholder="Repeat your password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-500/10 rounded-md px-3 py-2">Password updated successfully.</p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Updating…" : "Update Password"}
      </Button>
    </form>
  )
}
