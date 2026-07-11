"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Star, Trash2, ShieldCheck, Clock, Plus, CreditCard } from "lucide-react"

interface Character {
  id: string
  name: string
  server: string
  data_center: string | null
  avatar_url: string | null
  verified: boolean
  is_primary: boolean
  sort_order: number
}

export function CharacterManageClient({ characters: initial }: { characters: Character[] }) {
  const router = useRouter()
  const [characters, setCharacters] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setPrimary(id: string) {
    setLoading(id)
    setError(null)
    try {
      const res = await fetch(`/api/character/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Failed to update character")
        return
      }
      setCharacters((prev) => prev.map((c) => ({ ...c, is_primary: c.id === id })))
      router.refresh()
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(null)
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this character from your account?")) return
    setLoading(id)
    setError(null)
    try {
      const res = await fetch(`/api/character/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Failed to remove character")
        return
      }
      setCharacters((prev) => prev.filter((c) => c.id !== id))
      router.refresh()
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(null)
    }
  }

  if (characters.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">No characters linked yet.</p>
        <Button asChild className="gap-2">
          <Link href="/character/link">
            <Plus className="size-4" /> Link your first character
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}
      {characters.map((char) => (
        <Card key={char.id} className={char.is_primary ? "border-primary/50" : ""}>
          <CardContent className="flex items-center gap-4 py-4 px-4">
            <Avatar className="size-14 shrink-0">
              <AvatarImage src={char.avatar_url ?? undefined} alt={char.name} />
              <AvatarFallback className="text-lg">{char.name[0]}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground">{char.name}</span>
                {char.is_primary && (
                  <Badge className="text-xs gap-1 h-5">
                    <Star className="size-2.5" /> Primary
                  </Badge>
                )}
                {char.verified ? (
                  <Badge variant="secondary" className="text-xs gap-1 h-5 text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                    <ShieldCheck className="size-2.5" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs gap-1 h-5 text-amber-400 border-amber-400/30 bg-amber-400/10">
                    <Clock className="size-2.5" /> Pending
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {char.server}{char.data_center ? ` (${char.data_center})` : ""}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {char.verified && (
                <Button size="sm" variant="outline" asChild className="gap-1.5">
                  <Link href={`/character/card?char=${char.id}`}>
                    <CreditCard className="size-3.5" /> Card
                  </Link>
                </Button>
              )}
              {!char.verified && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/character/verify/${char.id}`}>Verify</Link>
                </Button>
              )}
              {char.verified && !char.is_primary && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPrimary(char.id)}
                  disabled={loading === char.id}
                  className="gap-1.5"
                >
                  <Star className="size-3.5" /> Set Primary
                </Button>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => remove(char.id)}
                disabled={loading === char.id}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
