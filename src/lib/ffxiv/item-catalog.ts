import { createServiceClient } from "@/lib/supabase/service"

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
    CanBeHq?: boolean
    IsUntradable?: boolean
    StackSize?: number
    PriceMid?: number
  }
}

interface XivapiSheetResponse {
  rows: XivapiRow[]
}

/** Full static metadata for one item, as stored in `item_catalog`. */
export interface ItemMetadata extends CatalogEntry {
  iconPath: string | null
  canBeHq: boolean | null
  isUntradable: boolean | null
  stackSize: number | null
  /** NPC vendor buy price. The 99999 sentinel is normalised to null. */
  vendorPrice: number | null
}

/** `PriceMid` is populated on items no vendor actually sells; 99999 marks those. */
const NO_VENDOR_SENTINEL = 99999

const ITEM_FIELDS = "Name,Icon,CanBeHq,IsUntradable,StackSize,PriceMid"

function iconUrlFromPath(path: string | undefined): string | null {
  if (!path) return null
  return `${XIVAPI_BASE}/asset?path=${encodeURIComponent(path)}&format=png`
}

/**
 * Fetches static item metadata from XIVAPI in batches.
 *
 * Shared by the lazy per-scan resolver and the Phase 2 recipe warm, so both
 * write the same columns and a recipe ingredient never lands in the cache with
 * name/icon but no `is_untradable`.
 */
export async function fetchItemMetadata(itemIds: number[]): Promise<Map<number, ItemMetadata>> {
  const resolved = new Map<number, ItemMetadata>()

  for (let i = 0; i < itemIds.length; i += XIVAPI_BATCH_SIZE) {
    const batch = itemIds.slice(i, i + XIVAPI_BATCH_SIZE)
    const res = await fetch(
      `${XIVAPI_BASE}/sheet/Item?rows=${batch.join(",")}&fields=${ITEM_FIELDS}`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) continue

    const data: XivapiSheetResponse = await res.json()
    for (const row of data.rows ?? []) {
      const f = row.fields
      if (!f?.Name) continue
      const iconPath = f.Icon?.path ?? null
      resolved.set(row.row_id, {
        name: f.Name,
        iconPath,
        iconUrl: iconUrlFromPath(iconPath ?? undefined),
        canBeHq: f.CanBeHq ?? null,
        isUntradable: f.IsUntradable ?? null,
        stackSize: f.StackSize ?? null,
        vendorPrice:
          typeof f.PriceMid === "number" && f.PriceMid !== NO_VENDOR_SENTINEL ? f.PriceMid : null,
      })
    }
  }

  return resolved
}

/** Row shape for an `item_catalog` upsert. */
export function toCatalogRow(itemId: number, m: ItemMetadata) {
  return {
    item_id: itemId,
    name: m.name,
    icon_path: m.iconPath,
    icon_url: m.iconUrl,
    can_be_hq: m.canBeHq,
    is_untradable: m.isUntradable,
    stack_size: m.stackSize,
    vendor_price: m.vendorPrice,
  }
}

/**
 * Resolves item names and icons, caching misses in `item_catalog`.
 *
 * Uses the service-role client rather than the caller's session: migration 015
 * revoked insert/update on `item_catalog` from `authenticated`, so a
 * session-scoped upsert would silently fail on every cache miss and the table
 * would never fill.
 */
export async function resolveItemCatalog(
  itemIds: number[]
): Promise<Map<number, CatalogEntry>> {
  const uniqueIds = [...new Set(itemIds)]
  if (uniqueIds.length === 0) return new Map()

  const supabase = createServiceClient()
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

  const fetched = await fetchItemMetadata(missingIds)
  if (fetched.size > 0) {
    await supabase.from("item_catalog").upsert(
      Array.from(fetched.entries()).map(([itemId, m]) => toCatalogRow(itemId, m)),
      { onConflict: "item_id" }
    )
  }

  for (const [itemId, entry] of fetched) {
    result.set(itemId, entry)
  }

  return result
}
