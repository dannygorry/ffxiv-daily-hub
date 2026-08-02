const XIVAPI_BASE = "https://v2.xivapi.com/api"
const PAGE_SIZE = 500
/** ~34 pages expected; bounded so a pagination quirk can't spin forever. */
const MAX_PAGES = 120

interface GilShopItemRow {
  row_id: number
  subrow_id: number
  fields?: { Item?: { row_id?: number } }
}

/**
 * Every item an NPC vendor actually sells.
 *
 * `GilShopItem` is a **subrow** sheet: many rows share a `row_id` and are
 * distinguished by `subrow_id`. That breaks the usual `after=<row_id>` paging —
 * passing the last row_id returns the *remaining subrows of that same row*, so
 * a naive "stop when row_id stops advancing" guard truncates the tail. Progress
 * is therefore tracked on `(row_id, subrow_id)` pairs and paging stops only
 * when a page contributes nothing new.
 *
 * Roughly 16,000 subrows collapse to ~6,700 unique items.
 */
export async function fetchVendorItemIds(): Promise<number[]> {
  const itemIds = new Set<number>()
  const seen = new Set<string>()
  let after = 0

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(
      `${XIVAPI_BASE}/sheet/GilShopItem?limit=${PAGE_SIZE}&after=${after}&fields=Item.Name`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) throw new Error(`XIVAPI GilShopItem page failed: ${res.status}`)

    const data: { rows?: GilShopItemRow[] } = await res.json()
    const rows = data.rows ?? []
    if (rows.length === 0) break

    let fresh = 0
    for (const row of rows) {
      const key = `${row.row_id}:${row.subrow_id}`
      if (seen.has(key)) continue
      seen.add(key)
      fresh++
      const id = row.fields?.Item?.row_id
      if (id && id > 0) itemIds.add(id)
    }
    // A page of entirely-seen subrows means the sheet is exhausted.
    if (fresh === 0) break

    after = rows[rows.length - 1].row_id
  }

  return [...itemIds]
}
