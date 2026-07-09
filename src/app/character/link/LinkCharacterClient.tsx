"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DATA_CENTERS, REGIONS, type XIVAPICharacterResult } from "@/lib/ffxiv/xivapi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, ChevronRight } from "lucide-react"

export function LinkCharacterClient() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [dc, setDc] = useState("")
  const [server, setServer] = useState("")
  const [results, setResults] = useState<XIVAPICharacterResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")
  const [linking, setLinking] = useState<number | null>(null)

  function handleDcChange(value: string) {
    setDc(value === "__any" ? "" : value)
    setServer("")
  }

  function handleServerChange(value: string) {
    setServer(value === "__any_world" ? "" : value)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setResults([])
    setSearching(true)
    try {
      const params = new URLSearchParams({ name })
      if (server) params.set("server", server)
      const res = await fetch(`/api/character/search?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const data: XIVAPICharacterResult[] = json.results ?? []
      setResults(data.slice(0, 20))
      if (data.length === 0) setError("No characters found. Check the name and world.")
    } catch {
      setError("Search failed. Please try again.")
    } finally {
      setSearching(false)
    }
  }

  async function handleSelect(char: XIVAPICharacterResult) {
    setLinking(char.ID)
    setError("")
    try {
      const serverName = char.Server.split(" ")[0]
      const res = await fetch("/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lodestoneId: char.ID,
          name: char.Name,
          server: serverName,
          avatarUrl: char.Avatar,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/character/verify/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add character.")
      setLinking(null)
    }
  }

  const dcServers = dc ? (DATA_CENTERS[dc] ?? []) : []

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Link a Character</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search for your FFXIV character to add it to your account.
        </p>
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="char-name">Character Name</Label>
          <Input
            id="char-name"
            placeholder="Warrior of Light"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label>Data Center <span className="text-muted-foreground">(optional)</span></Label>
            <Select value={dc || undefined} onValueChange={handleDcChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any data center" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any">Any data center</SelectItem>
                {REGIONS.map((region) => (
                  <SelectGroup key={region.name}>
                    <SelectLabel>{region.name}</SelectLabel>
                    {region.dcs.map((dcName) => (
                      <SelectItem key={dcName} value={dcName}>{dcName}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-1.5">
            <Label>World <span className="text-muted-foreground">(optional)</span></Label>
            <Select
              value={server || undefined}
              onValueChange={handleServerChange}
              disabled={!dc}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={dc ? "Any world" : "Select DC first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any_world">Any world</SelectItem>
                {dcServers.map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button type="submit" disabled={searching} className="gap-2">
          <Search className="size-4" />
          {searching ? "Searching…" : "Search"}
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{results.length} result(s) found</p>
          <div className="space-y-2">
            {results.map((char) => (
              <Card
                key={char.ID}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleSelect(char)}
              >
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <Avatar className="size-12 shrink-0">
                    <AvatarImage src={char.Avatar} alt={char.Name} />
                    <AvatarFallback>{char.Name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{char.Name}</p>
                    <p className="text-sm text-muted-foreground">{char.Server}</p>
                  </div>
                  {linking === char.ID ? (
                    <span className="text-xs text-muted-foreground">Adding…</span>
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
