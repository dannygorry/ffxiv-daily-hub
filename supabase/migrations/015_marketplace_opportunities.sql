-- Phase 1 of the Gil Opportunity Engines: Supply Gap + Cross-World Arbitrage.
--
-- Three things happen here:
--   1. New opportunity payload columns on marketplace_scans.
--   2. A refresh lease + manual-refresh cooldown, so concurrent and serial
--      scans of the same world are both bounded.
--   3. Cache-write authority moves off `authenticated` and onto the
--      service-role client (see the note above the DROP POLICY block).
--
-- NOTE: crafting_profits is deliberately NOT created here. It belongs to
-- migration 016 (Phase 2). The Phase 1 success write must not reference it.

-- ---------------------------------------------------------------------------
-- 1. Opportunity payloads
-- ---------------------------------------------------------------------------
-- Every jsonb payload is versioned as {"v":1,"items":[...]} so a future shape
-- change can be detected on read and treated as stale rather than crashing.
alter table public.marketplace_scans
  add column supply_gaps    jsonb   not null default '{"v":1,"items":[]}'::jsonb,
  add column arbitrage      jsonb   not null default '{"v":1,"items":[]}'::jsonb,
  add column tax_rates      jsonb   not null default '{}'::jsonb,
  add column shortlist_size integer not null default 0;

-- ---------------------------------------------------------------------------
-- 2. Scan state: completion, lease, and manual-refresh cooldown
-- ---------------------------------------------------------------------------
-- scanned_at is `not null default now()`, so it is set the moment a lease row
-- is inserted and can never be used to mean "a scan finished". scan_completed_at
-- is nullable and written ONLY by the success path, making it the sole source
-- of truth for freshness. scanned_at is kept in step on success purely so the
-- already-shipped client, which reads it, keeps working unchanged.
alter table public.marketplace_scans
  add column scan_completed_at      timestamptz,
  add column refresh_started_at     timestamptz,
  add column refresh_lease_token    uuid,
  add column refresh_error          text,
  add column last_manual_refresh_at timestamptz;

-- Backfill: every existing row represents a completed scan. Without this,
-- each already-scanned world would report `initializing` after deploy.
update public.marketplace_scans
   set scan_completed_at = scanned_at
 where scan_completed_at is null;

-- ---------------------------------------------------------------------------
-- 3. Cache-write authority
-- ---------------------------------------------------------------------------
-- Migration 014 let any authenticated user write these tables, which was
-- acceptable while they held nothing but a read-mostly leaderboard. They now
-- hold refresh leases and error state, and will later gate paid advisor work,
-- so writes move to the service-role client used by server code only.
--
-- Both halves are required. Revoking privileges alone would leave the policies
-- in place: misleading to read, and live again the moment privileges were
-- restored for any reason.
--
-- To roll back, re-create the four policies exactly as they appear in
-- 014_marketplace_scanner.sql and re-grant insert/update to authenticated.
drop policy if exists "Authenticated users can insert marketplace scans" on public.marketplace_scans;
drop policy if exists "Authenticated users can update marketplace scans" on public.marketplace_scans;
drop policy if exists "Authenticated users can insert item catalog"      on public.item_catalog;
drop policy if exists "Authenticated users can update item catalog"      on public.item_catalog;

revoke insert, update on public.marketplace_scans from authenticated;
revoke insert, update on public.item_catalog      from authenticated;

-- Reads stay open to authenticated users; the "can read" policies from 014 are
-- untouched. The service-role key bypasses RLS entirely, so no new write
-- policy is needed for the server path.

-- ---------------------------------------------------------------------------
-- 4. Atomic lease acquisition
-- ---------------------------------------------------------------------------
-- Acquiring a lease has to be one statement, or two callers can both observe a
-- free lease and both start a scan. `insert ... on conflict do update ... where`
-- is not expressible through supabase-js, so it lives here.
--
-- The same statement handles a world that has never been scanned: the insert
-- branch creates the row and takes the lease together, so a cold world cannot
-- be scanned by every concurrent caller at once.
--
-- p_manual distinguishes the two callers:
--   false -> TTL-driven background refresh from GET. Ignores the cooldown,
--            because the TTL is already the rate limit.
--   true  -> user-triggered PUT. Also requires the manual cooldown to have
--            elapsed, and stamps last_manual_refresh_at on success.
--
-- last_manual_refresh_at is set at ACQUIRE time and is deliberately never
-- rolled back on failure: the ~169 Universalis requests are spent whether or
-- not the scan completes, so a failed attempt must consume the cooldown too.
-- Otherwise a world whose scans keep failing becomes an unlimited retry vector.
create or replace function public.acquire_marketplace_lease(
  p_world        text,
  p_data_center  text,
  p_token        uuid,
  p_manual       boolean default false,
  p_lease_ttl    interval default interval '10 minutes',
  p_cooldown     interval default interval '15 minutes'
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_acquired uuid;
begin
  insert into public.marketplace_scans (
    world, data_center, refresh_started_at, refresh_lease_token, last_manual_refresh_at
  )
  values (
    p_world, p_data_center, now(), p_token,
    case when p_manual then now() else null end
  )
  on conflict (world) do update
    set refresh_started_at     = now(),
        refresh_lease_token    = p_token,
        last_manual_refresh_at = case
                                   when p_manual then now()
                                   else public.marketplace_scans.last_manual_refresh_at
                                 end
    where (public.marketplace_scans.refresh_started_at is null
           or public.marketplace_scans.refresh_started_at < now() - p_lease_ttl)
      and (not p_manual
           or public.marketplace_scans.last_manual_refresh_at is null
           or public.marketplace_scans.last_manual_refresh_at < now() - p_cooldown)
  returning refresh_lease_token into v_acquired;

  return v_acquired is not null;
end;
$$;

-- Server-side callers only. The service-role key bypasses RLS but NOT execute
-- grants, so this must be granted explicitly — and withheld from everyone else,
-- or an authenticated user could seize or churn leases directly via PostgREST.
revoke all on function public.acquire_marketplace_lease(text, text, uuid, boolean, interval, interval)
  from public, anon, authenticated;
grant execute on function public.acquire_marketplace_lease(text, text, uuid, boolean, interval, interval)
  to service_role;
