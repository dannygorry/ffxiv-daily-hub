"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toPng } from "html-to-image"
import { CharacterCard, type CardSettings } from "@/components/CharacterCard"
import { PortraitCropModal } from "@/components/PortraitCropModal"
import type { LodestoneCardData } from "@/lib/ffxiv/lodestone-card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { RefreshCw, Download, Upload, X, Loader2, ImageOff } from "lucide-react"

interface Character {
  id: string
  name: string
  server: string
  data_center: string | null
  avatar_url: string | null
  verified: boolean
}

interface Props {
  characters: Character[]
  initialCharId?: string
}

const DEFAULT_SETTINGS: CardSettings = {
  customPortraitUrl: null,
  cardAccentColor: "#4f8ef7",
  showJobGrid: true,
  showMounts: true,
  showMinions: true,
  showEureka: false,
}

type FetchStatus = "idle" | "loading" | "error"

export function CardGeneratorClient({ characters, initialCharId }: Props) {
  const [selectedId, setSelectedId] = useState(initialCharId ?? characters[0]?.id ?? "")
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [lodestoneData, setLodestoneData] = useState<LodestoneCardData | null>(null)
  const [settings, setSettings] = useState<CardSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [cardScale, setCardScale] = useState(1)

  // Local color tracks the picker swatch/hex display instantly.
  // patchSettings is debounced so CharacterCard only re-renders ~every 80ms.
  const [localAccentColor, setLocalAccentColor] = useState(DEFAULT_SETTINGS.cardAccentColor)
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)
  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scale the 900×600 card to fit the available width
  useEffect(() => {
    const el = previewWrapperRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      setCardScale(Math.min(1, w / 1080))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const loadCardData = useCallback(async (id: string): Promise<"ok" | "error"> => {
    try {
      const res = await fetch(`/api/character/${id}/card-data`)
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load")
      const { lodestoneData: ld, cardSettings: cs } = await res.json()
      setLodestoneData(ld)
      setSettings(cs)
      setLocalAccentColor(cs.cardAccentColor ?? DEFAULT_SETTINGS.cardAccentColor)
      return "ok"
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load character data")
      return "error"
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetchStatus("loading")
    setError(null)
    loadCardData(selectedId).then((result) => {
      setFetchStatus(result === "ok" ? "idle" : "error")
    })
  }, [selectedId, loadCardData])

  async function handleRefresh() {
    if (!selectedId) return
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`/api/character/${selectedId}/card-data`, { method: "PUT" })
      if (!res.ok) throw new Error((await res.json()).error)
      const { lodestoneData: ld } = await res.json()
      setLodestoneData(ld)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed")
    }
    setRefreshing(false)
  }

  async function handleSaveSettings() {
    if (!selectedId) return
    setSaving(true)
    await fetch(`/api/character/${selectedId}/card-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardAccentColor: settings.cardAccentColor,
        showJobGrid: settings.showJobGrid,
        showMounts: settings.showMounts,
        showMinions: settings.showMinions,
        showEureka: settings.showEureka,
      }),
    })
    setSaving(false)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setCropImageSrc(objectUrl)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleCropCancel() {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
    setCropImageSrc(null)
  }

  async function handleCropConfirm(blob: Blob) {
    if (!selectedId) return
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
    setCropImageSrc(null)
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append("portrait", blob, "portrait.jpg")
    try {
      const res = await fetch(`/api/character/${selectedId}/card-portrait`, {
        method: "POST",
        body: form,
      })
      if (!res.ok) {
        const { error: err } = await res.json()
        setError(err ?? "Upload failed")
        setUploading(false)
        return
      }
      const { url } = await res.json()
      setSettings((s) => ({ ...s, customPortraitUrl: url }))
    } catch {
      setError("Upload failed")
    }
    setUploading(false)
  }

  async function handleRemovePortrait() {
    if (!selectedId) return
    setUploading(true)
    await fetch(`/api/character/${selectedId}/card-portrait`, { method: "DELETE" })
    setSettings((s) => ({ ...s, customPortraitUrl: null }))
    setUploading(false)
  }

  async function handleExport() {
    if (!cardRef.current || !lodestoneData) return
    setExporting(true)
    setError(null)
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 1080,
        height: 600,
      })
      const link = document.createElement("a")
      link.download = `${lodestoneData.name || "character"}-card.png`
      link.href = dataUrl
      link.click()
    } catch {
      setError("Export failed — try again or check browser console for details")
    }
    setExporting(false)
  }

  function patchSettings(patch: Partial<CardSettings>) {
    setSettings((s) => ({ ...s, ...patch }))
  }

  function handleColorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setLocalAccentColor(val)
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current)
    colorDebounceRef.current = setTimeout(() => {
      patchSettings({ cardAccentColor: val })
    }, 80)
  }

  // Stable object for CharacterCard — only changes when settings actually commit,
  // not on every intermediate drag tick.
  const previewSettings = useMemo<CardSettings>(
    () => settings,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      settings.cardAccentColor,
      settings.customPortraitUrl,
      settings.showJobGrid,
      settings.showMounts,
      settings.showMinions,
      settings.showEureka,
    ]
  )

  const hasCharacters = characters.length > 0

  return (
    <>
    {cropImageSrc && (
      <PortraitCropModal
        imageSrc={cropImageSrc}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
    )}
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Card preview column */}
      <div className="flex-1 min-w-0">
        {characters.length > 1 && (
          <div className="mb-4">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select character" />
              </SelectTrigger>
              <SelectContent>
                {characters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.server}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!hasCharacters && (
          <div className="flex items-center justify-center h-64 rounded-lg border border-border text-muted-foreground text-sm">
            No verified characters found. Link and verify a character first.
          </div>
        )}

        {hasCharacters && fetchStatus === "loading" && (
          <div className="flex items-center justify-center h-64 rounded-lg border border-border gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading character data from Lodestone… (this may take a moment)
          </div>
        )}

        {hasCharacters && fetchStatus === "error" && (
          <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-destructive/40 bg-destructive/5 gap-2 text-sm text-destructive">
            <ImageOff className="size-5" />
            {error}
            <Button size="sm" variant="outline" onClick={() => loadCardData(selectedId)}>
              Retry
            </Button>
          </div>
        )}

        {hasCharacters && fetchStatus === "idle" && lodestoneData && (
          /* Responsive scaling wrapper */
          <div
            ref={previewWrapperRef}
            className="w-full overflow-hidden rounded-lg shadow-lg"
            style={{ height: 600 * cardScale }}
          >
            <div
              style={{
                width: 1080,
                height: 600,
                transformOrigin: "top left",
                transform: `scale(${cardScale})`,
              }}
            >
              <div ref={cardRef}>
                <CharacterCard data={lodestoneData} settings={previewSettings} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings panel */}
      <div className="w-full lg:w-72 shrink-0 space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h2 className="font-semibold text-sm">Customise Card</h2>

          {/* Accent color */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Accent Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localAccentColor}
                onChange={handleColorChange}
                className="h-8 w-10 rounded border border-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={localAccentColor}
                onChange={(e) => {
                  const val = e.target.value
                  setLocalAccentColor(val)
                  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current)
                    colorDebounceRef.current = setTimeout(() => {
                      patchSettings({ cardAccentColor: val })
                    }, 80)
                  }
                }}
                onBlur={() => {
                  if (!/^#[0-9a-fA-F]{6}$/.test(localAccentColor)) {
                    setLocalAccentColor(settings.cardAccentColor)
                  }
                }}
                maxLength={7}
                className="w-20 text-xs font-mono bg-transparent border border-border rounded px-2 py-1 text-muted-foreground focus:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <Separator />

          {/* Toggles */}
          <div className="space-y-2">
            {(
              [
                ["showJobGrid", "Show job grid"],
                ["showMounts", "Show mounts"],
                ["showMinions", "Show minions"],
                ["showEureka", "Show Eureka / Bozja"],
              ] as Array<[keyof CardSettings, string]>
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[key] as boolean}
                  onChange={(e) => patchSettings({ [key]: e.target.checked })}
                  className="size-3.5 accent-primary"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

          <Separator />

          {/* Portrait upload */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Custom Portrait / Gpose</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !selectedId}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {uploading ? "Uploading…" : "Upload Image"}
            </Button>
            {settings.customPortraitUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full gap-1.5 text-destructive hover:text-destructive"
                onClick={handleRemovePortrait}
                disabled={uploading}
              >
                <X className="size-3.5" /> Remove Custom Portrait
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Max 5MB · JPEG, PNG, or WebP</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={handleExport}
            disabled={!lodestoneData || exporting || fetchStatus === "loading"}
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {exporting ? "Exporting…" : "Export PNG"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5"
            onClick={handleSaveSettings}
            disabled={saving || !lodestoneData}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {saving ? "Saving…" : "Save Settings"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="w-full gap-1.5 text-muted-foreground"
            onClick={handleRefresh}
            disabled={refreshing || !selectedId}
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh from Lodestone"}
          </Button>
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
        )}
      </div>
    </div>
    </>
  )
}
