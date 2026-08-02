import { createServiceClient } from "@/lib/supabase/service"
import { fetchItemMetadata, toCatalogRow } from "./item-catalog"

const XIVAPI_BASE = "https://v2.xivapi.com/api"
const PAGE_SIZE = 500
/** Backstop when the XIVAPI version signal is missing or unrecognised. */
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000

// `ItemResult` is a struct but `Ingredient` is an array — mixing the two
// syntaxes returns a 400. Every wrapper carries row_id regardless, which is how
// the cache stays ID-keyed without asking for IDs explicitly.
const RECIPE_FIELDS = [
  "ItemResult.Name",
  "AmountResult",
  "AmountIngredient",
  "Ingredient[].Name",
  "CraftType.Name",
  "RecipeLevelTable.ClassJobLevel",
].join(",")

export interface RecipeIngredient {
  itemId: number
  qty: number
}

export interface CachedRecipe {
  recipeId: number
  resultItemId: number
  resultQty: number
  ingredients: RecipeIngredient[]
  craftType: string | null
  jobLevel: number | null
  resultName: string | null
}

interface XivapiRef {
  row_id?: number
  fields?: { Name?: string; ClassJobLevel?: number }
}

interface XivapiRecipeRow {
  row_id: number
  fields: {
    ItemResult?: XivapiRef
    AmountResult?: number
    AmountIngredient?: number[]
    Ingredient?: XivapiRef[]
    CraftType?: XivapiRef
    RecipeLevelTable?: XivapiRef
  }
}

interface XivapiRecipeResponse {
  schema?: string
  version?: string
  rows?: XivapiRecipeRow[]
}

function parseRecipe(row: XivapiRecipeRow): CachedRecipe | null {
  const f = row.fields
  const resultItemId = f?.ItemResult?.row_id ?? 0
  // The sheet is padded with blank placeholder rows; a zero result id marks one.
  if (!resultItemId) return null

  const amounts = f.AmountIngredient ?? []
  const ingredients: RecipeIngredient[] = []
  ;(f.Ingredient ?? []).forEach((ing, i) => {
    const itemId = ing?.row_id ?? 0
    const qty = amounts[i] ?? 0
    if (itemId > 0 && qty > 0) ingredients.push({ itemId, qty })
  })
  if (ingredients.length === 0) return null

  return {
    recipeId: row.row_id,
    resultItemId,
    // Guard against a zero yield so downstream revenue maths can't collapse.
    resultQty: Math.max(1, f.AmountResult ?? 1),
    ingredients,
    craftType: f.CraftType?.fields?.Name ?? null,
    jobLevel: f.RecipeLevelTable?.fields?.ClassJobLevel ?? null,
    resultName: f.ItemResult?.fields?.Name ?? null,
  }
}

/**
 * Pages the whole Recipe sheet. ~13,900 real recipes across ~28 requests.
 *
 * Only ever called by the explicit warm below — never inside a marketplace
 * refresh, where it would turn a user's first visit into a 28-request stall.
 */
export async function fetchAllRecipes(): Promise<{ recipes: CachedRecipe[]; gameVersion: string | null }> {
  const recipes: CachedRecipe[] = []
  let after = 0
  let gameVersion: string | null = null
  // Bounded so a pagination bug can't loop forever; ~28 pages are expected.
  const MAX_PAGES = 60

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(
      `${XIVAPI_BASE}/sheet/Recipe?limit=${PAGE_SIZE}&after=${after}&fields=${encodeURIComponent(RECIPE_FIELDS)}`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) throw new Error(`XIVAPI recipe page failed: ${res.status}`)

    const data: XivapiRecipeResponse = await res.json()
    const rows = data.rows ?? []
    if (rows.length === 0) break

    gameVersion ??= data.version ?? data.schema ?? null
    for (const row of rows) {
      const parsed = parseRecipe(row)
      if (parsed) recipes.push(parsed)
    }
    after = rows[rows.length - 1].row_id
  }

  return { recipes, gameVersion }
}

export interface WarmResult {
  recipesWritten: number
  itemsWritten: number
  gameVersion: string | null
  durationMs: number
}

/**
 * Rebuilds `recipe_cache` and backfills the item metadata every craft
 * calculation depends on.
 *
 * Backfilling here rather than lazily is deliberate: `computeCraftProfit`
 * treats unknown metadata as "not tradeable, no HQ row", so a scan running
 * against an unwarmed catalogue would silently drop most recipes rather than
 * mispricing them — quiet, and hard to attribute.
 */
export async function warmRecipeCache(): Promise<WarmResult> {
  const startedAt = Date.now()
  const supabase = createServiceClient()

  const { recipes, gameVersion } = await fetchAllRecipes()

  const rows = recipes.map((r) => ({
    recipe_id: r.recipeId,
    result_item_id: r.resultItemId,
    result_qty: r.resultQty,
    ingredients: r.ingredients,
    craft_type: r.craftType,
    job_level: r.jobLevel,
    result_name: r.resultName,
    game_version: gameVersion,
    fetched_at: new Date().toISOString(),
  }))

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from("recipe_cache")
      .upsert(rows.slice(i, i + 500), { onConflict: "recipe_id" })
    if (error) throw new Error(`recipe_cache upsert failed: ${error.message}`)
  }

  // Every result and ingredient, so no craft calculation has to resolve an item
  // mid-scan.
  const itemIds = [...new Set(recipes.flatMap((r) => [r.resultItemId, ...r.ingredients.map((i) => i.itemId)]))]
  const metadata = await fetchItemMetadata(itemIds)

  const catalogRows = Array.from(metadata.entries()).map(([id, m]) => toCatalogRow(id, m))
  for (let i = 0; i < catalogRows.length; i += 500) {
    const { error } = await supabase
      .from("item_catalog")
      .upsert(catalogRows.slice(i, i + 500), { onConflict: "item_id" })
    if (error) throw new Error(`item_catalog upsert failed: ${error.message}`)
  }

  return {
    recipesWritten: rows.length,
    itemsWritten: catalogRows.length,
    gameVersion,
    durationMs: Date.now() - startedAt,
  }
}

export interface RecipeCacheStatus {
  count: number
  gameVersion: string | null
  fetchedAt: string | null
  stale: boolean
}

/**
 * Reports whether the cache is usable, without fetching anything.
 *
 * The version signal is treated as advisory: an unrecognised or missing value
 * must not be read as "still current", but neither should a changed schema hash
 * trigger a full refetch on every scan. Age is the backstop, and refreshing is
 * always an explicit action.
 */
export async function getRecipeCacheStatus(): Promise<RecipeCacheStatus> {
  const supabase = createServiceClient()

  const { count } = await supabase
    .from("recipe_cache")
    .select("recipe_id", { count: "exact", head: true })

  const { data } = await supabase
    .from("recipe_cache")
    .select("game_version, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ game_version: string | null; fetched_at: string }>()

  const fetchedAt = data?.fetched_at ?? null
  const ageMs = fetchedAt ? Date.now() - new Date(fetchedAt).getTime() : Infinity

  return {
    count: count ?? 0,
    gameVersion: data?.game_version ?? null,
    fetchedAt,
    stale: (count ?? 0) === 0 || ageMs > STALE_AFTER_MS,
  }
}

/** Loads the whole cache for a scan. ~13,900 small rows; one query. */
export async function loadRecipeCache(): Promise<CachedRecipe[]> {
  const supabase = createServiceClient()
  const out: CachedRecipe[] = []
  const PAGE = 1000

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("recipe_cache")
      .select("recipe_id, result_item_id, result_qty, ingredients, craft_type, job_level, result_name")
      .order("recipe_id", { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) {
      console.error("[recipes] cache load failed:", error.message)
      break
    }
    if (!data || data.length === 0) break

    for (const r of data) {
      out.push({
        recipeId: r.recipe_id,
        resultItemId: r.result_item_id,
        resultQty: r.result_qty,
        ingredients: (r.ingredients ?? []) as RecipeIngredient[],
        craftType: r.craft_type,
        jobLevel: r.job_level,
        resultName: r.result_name,
      })
    }
    if (data.length < PAGE) break
  }

  return out
}
