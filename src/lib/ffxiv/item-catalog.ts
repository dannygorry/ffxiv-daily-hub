import type { createClient } from "@/lib/supabase/server"

const XIVAPI_BASE = "https://v2.xivapi.com/api"
const XIVAPI_BATCH_SIZE = 100

export interface CatalogEntry {
  name: string
  iconUrl: string | null
}

interface XivapiRow {
  row_id: number
  fields: {
    Name?: string
    Icon?: { path?: string }
  }
}

interface XivapiSheetResponse {
  rows: XivapiRow[]
}

interface ResolvedEntry extends CatalogEntry {
  iconPath: string | null
}

function iconUrlFromPath(path: string | undefined): string | null {
  if (!path) return null
  return `${XIVAPI_BASE}/asset?path=${encodeURIComponent(path)}&format=png`
}

async function fetchFromXivapi(itemIds: number[]): Promise<Map<number, ResolvedEntry>> {
  const resolved = new Map<number, ResolvedEntry>()

  for (let i = 0; i < itemIds.length; i += XIVAPI_BATCH_SIZE) {
    const batch = itemIds.slice(i, i + XIVAPI_BATCH_SIZE)
    const res = await fetch(
      `${XIVAPI_BASE}/sheet/Item?rows=${batch.join(",")}&fields=Name,Icon`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) continue

    const data: XivapiSheetResponse = await res.json()
    for (const row of data.rows ?? []) {
      if (!row.fields?.Name) continue
      const iconPath = row.fields.Icon?.path ?? null
      resolved.set(row.row_id, {
        name: row.fields.Name,
        iconPath,
        iconUrl: iconUrlFromPath(iconPath ?? undefined),
      })
    }
  }

  return resolved
}

export async function resolveItemCatalog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemIds: number[]
): Promise<Map<number, CatalogEntry>> {
  const uniqueIds = [...new Set(itemIds)]
  if (uniqueIds.length === 0) return new Map()

  const result = new Map<number, CatalogEntry>()

  const { data: cached } = await supabase
    .from("item_catalog")
    .select("item_id, name, icon_url")
    .in("item_id", uniqueIds)

  for (const row of cached ?? []) {
    result.set(row.item_id, { name: row.name, iconUrl: row.icon_url })
  }

  const missingIds = uniqueIds.filter((id) => !result.has(id))
  if (missingIds.length === 0) return result

  const fetched = await fetchFromXivapi(missingIds)
  if (fetched.size > 0) {
    await supabase.from("item_catalog").upsert(
      Array.from(fetched.entries()).map(([itemId, entry]) => ({
        item_id: itemId,
        name: entry.name,
        icon_path: entry.iconPath,
        icon_url: entry.iconUrl,
      })),
      { onConflict: "item_id" }
    )
  }

  for (const [itemId, entry] of fetched) {
    result.set(itemId, entry)
  }

  return result
}
