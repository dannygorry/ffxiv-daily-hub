"use client"

import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

// Matches the portrait panel: 342 wide × 600 tall
const PORTRAIT_ASPECT = 342 / 600

async function cropToBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height
      const ctx = canvas.getContext("2d")
      if (!ctx) { reject(new Error("No canvas context")); return }
      ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, pixelCrop.width, pixelCrop.height
      )
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
        "image/jpeg",
        0.93
      )
    }
    image.onerror = reject
    image.crossOrigin = "anonymous"
    image.src = imageSrc
  })
}

interface Props {
  imageSrc: string
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

export function PortraitCropModal({ imageSrc, onCancel, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [applying, setApplying] = useState(false)
  const [cropError, setCropError] = useState<string | null>(null)

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleConfirm() {
    if (!croppedAreaPixels) return
    setApplying(true)
    setCropError(null)
    try {
      const blob = await cropToBlob(imageSrc, croppedAreaPixels)
      onConfirm(blob)
    } catch {
      setCropError("Failed to crop image. Please try again.")
      setApplying(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#111827", border: "1px solid #374151", borderRadius: 10,
          padding: 20, width: 460, maxWidth: "100%",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#f3f4f6" }}>Adjust Portrait</span>
          <button
            onClick={onCancel}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Crop area */}
        <div style={{ position: "relative", height: 380, borderRadius: 6, overflow: "hidden", background: "#000" }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={PORTRAIT_ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={false}
          />
        </div>

        {/* Zoom slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: "#4f8ef7" }}
          />
          <span style={{ fontSize: 11, color: "#9ca3af", width: 30, textAlign: "right", flexShrink: 0 }}>
            {zoom.toFixed(1)}×
          </span>
        </div>

        {cropError && (
          <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{cropError}</p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={applying}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={applying}>
            {applying ? "Applying…" : "Use This Crop"}
          </Button>
        </div>
      </div>
    </div>
  )
}
