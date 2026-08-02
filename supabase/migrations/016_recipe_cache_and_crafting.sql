-- Phase 2 of the Gil Opportunity Engines: crafting profit.
--
--   1. recipe_cache — the ~13,900 craftable recipes, keyed by IDs not names.
--   2. crafting_profits — computed per-world results, alongside the other
--      opportunity payloads on marketplace_scans.
--   3. item_catalog metadata — the static Item flags the craft rules need.

-- ---------------------------------------------------------------------------
-- 1. Recipe cache
-- ---------------------------------------------------------------------------
-- Identity is IDs, never names: names are locale-dependent and unusable as a
-- join key against scan prices. XIVAPI returns row_id on every wrapper even
-- when only .Name is requested, so the IDs cost nothing extra to collect.
-- result_name is kept for display and debugging only.
--
-- This is NOT permanent. Recipes change with game patches, so game_version
-- records the XIVAPI schema/version the rows were fetched under and fetched_at
-- backstops it when that signal is missing or unreliable.
create table public.recipe_cache (
  recipe_id       integer primary key,
  result_item_id  integer not null,
  result_qty      integer not null,
  ingredients     jsonb   not null,   -- [{ "itemId": 5106, "qty": 2 }, ...]
  craft_type      text,               -- "Smithing", "Culinarian", ...
  job_level       integer,
  result_name     text,
  game_version    text,
  fetched_at      timestamptz not null default now()
);

create index recipe_cache_result_item_idx on public.recipe_cache (result_item_id);
create index recipe_cache_craft_type_idx  on public.recipe_cache (craft_type);

alter table public.recipe_cache enable row level security;

create policy "Authenticated users can read recipe cache"
  on public.recipe_cache for select using (auth.role() = 'authenticated');

-- Writes are server-only, same rationale as 015: this table is filled by an
-- explicit warm operation, never by a user request.
revoke insert, update, delete on public.recipe_cache from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Computed craft results
-- ---------------------------------------------------------------------------
-- Versioned payload, same envelope as supply_gaps / arbitrage.
--
-- Retention is a balanced union rather than a flat global top-N: if the top 200
-- worldwide are dominated by two or three disciplines, a player whose only
-- crafter is Culinarian sees an empty tab while profitable Culinarian recipes
-- sit below the cut. The engine keeps the overall top 200 plus the top 50 per
-- craft type, deduplicated.
alter table public.marketplace_scans
  add column crafting_profits jsonb not null default '{"v":1,"items":[]}'::jsonb;

-- ---------------------------------------------------------------------------
-- 3. Item metadata
-- ---------------------------------------------------------------------------
-- The craft rules need static Item flags that item_catalog did not carry:
--   can_be_hq     -> whether an HQ output row may be emitted at all
--   is_untradable -> excludes a recipe outright; the ingredient can't be bought
--   stack_size    -> bounds how much a buyer can realistically acquire
--   vendor_price  -> PriceMid, for the Phase 3 vendor-arbitrage engine
--
-- All nullable. Unresolved metadata is treated as UNKNOWN, not permissive: no
-- HQ row is emitted and the item is not assumed tradeable.
alter table public.item_catalog
  add column can_be_hq     boolean,
  add column is_untradable boolean,
  add column stack_size    integer,
  add column vendor_price  integer;   -- PriceMid; the 99999 sentinel is stored as NULL
