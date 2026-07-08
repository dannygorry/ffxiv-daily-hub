"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, ExternalLink } from "lucide-react"

interface Character {
  id: string
  name: string
  server: string
  verification_code: string
}

export function VerifyCharacterClient({ character }: { character: Character }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState("")

  async function copy() {
    await navigator.clipboard.writeText(character.verification_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function verify() {
    setVerifying(true)
    setError("")
    const res = await fetch(`/api/character/${character.id}/verify`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setVerifying(false)
    } else {
      router.push("/character/manage")
      router.refresh()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify {character.name}</CardTitle>
        <CardDescription>
          Prove this character belongs to you by adding a code to your Lodestone profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <p className="font-medium text-foreground">Copy your verification code</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="font-mono text-base px-4 py-1.5 tracking-widest">
                  {character.verification_code}
                </Badge>
                <Button size="icon-sm" variant="outline" onClick={copy}>
                  {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <p className="font-medium text-foreground">Paste it into your Lodestone profile bio</p>
              <p className="text-muted-foreground mt-1">
                Go to your character on The Lodestone, edit your profile, and paste the code anywhere in your bio/character profile section.
              </p>
              <Button size="sm" variant="outline" className="mt-2 gap-1.5" asChild>
                <a
                  href={`https://eu.finalfantasyxiv.com/lodestone/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Lodestone <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <p className="font-medium text-foreground">Click Verify below</p>
              <p className="text-muted-foreground mt-1">
                We'll check your bio for the code. It may take a minute for Lodestone to update.
              </p>
            </div>
          </li>
        </ol>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
        )}

        <Button onClick={verify} disabled={verifying} className="w-full">
          {verifying ? "Checking Lodestone…" : "Verify Character"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          After verification you can remove the code from your bio.
        </p>
      </CardContent>
    </Card>
  )
}
