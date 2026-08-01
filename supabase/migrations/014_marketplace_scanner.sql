-- Marketplace Scanner: per-world cached leaderboards (Universalis-sourced) + a
-- permanent item id -> name/icon cache (XIVAPI-sourced, names/icons never change).
--
-- Both tables hold shared, non-sensitive cache data with no per-user ownership,
-- so RLS is intentionally open to any authenticated session for read AND write
-- (there is no service-role client anywhere else in this codebase, and nothing
-- here is worth introducing one for). A malicious authenticated user could write
-- garbage into these rows, but that's an acceptable trade-off at this project's
-- scale — the fix later, if it ever matters, is swapping the write path to a
-- service-role client without touching this schema.

create table public.marketplace_scans (
  world                   text primary key,
  data_center             text not null,
  scanned_at              timestamptz not null default now(),
  scan_duration_ms        integer,
  items_scanned           integer not null default 0,
  items_failed            integer not null default 0,
  min_velocity_threshold  numeric not null default 1.0,
  best_sellers            jsonb not null default '[]'::jsonb,
  most_valuable           jsonb not null default '[]'::jsonb,
  updated_at              timestamptz not null default now()
);

create table public.item_catalog (
  item_id     integer primary key,
  name        text not null,
  icon_path   text,
  icon_url    text,
  fetched_at  timestamptz not null default now()
);

alter table public.marketplace_scans enable row level security;
alter table public.item_catalog enable row level security;

create policy "Authenticated users can read marketplace scans"
  on public.marketplace_scans for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert marketplace scans"
  on public.marketplace_scans for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update marketplace scans"
  on public.marketplace_scans for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can read item catalog"
  on public.item_catalog for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert item catalog"
  on public.item_catalog for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update item catalog"
  on public.item_catalog for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
