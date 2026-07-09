# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Turbopack dev server
npm run build        # Production build (runs tsc + next build)
npm run lint         # ESLint
npm run test:e2e     # Playwright E2E tests (headless)
npm run test:e2e:ui  # Playwright with interactive UI
npx tsc --noEmit     # Type-check only, no emit
```

There are no unit tests — only Playwright E2E. Always run `npx tsc --noEmit` after edits to confirm clean types before reporting done.

## Architecture

**Framework:** Next.js 16 App Router with React 19. `page.tsx` files are async server components; interactive pages delegate to a co-located `*Client.tsx` file that carries `"use client"`. Never add `"use client"` to a `page.tsx`.

**Styling:** Tailwind CSS v4 + shadcn/ui components (in `src/components/ui/`). Exception: `src/components/CharacterCard.tsx` uses only inline styles — Tailwind classes are unreliable inside html-to-image canvas captures.

**Auth + DB:** Supabase (PostgreSQL + Auth + Storage). Two clients:
- `src/lib/supabase/server.ts` — async, uses `next/headers` cookies. Use in server components and API routes.
- `src/lib/supabase/client.ts` — browser client for client components.

Middleware at `src/middleware.ts` protects `/dashboard`, `/character/*`, `/settings` — redirects unauthenticated users to `/auth/login?redirectTo=...`.

## Data Flow Patterns

**Checklist state** is keyed by `reset_period`: a date string (`YYYY-MM-DD`) for dailies, or the ISO date of the last Tuesday reset for weeklies. Logic lives in `src/lib/ffxiv/resets.ts`. The API at `/api/checklist` reads/writes `checklist_state` rows; `/api/checklist/batch` handles bulk toggle.

**Beast tribe progress** is stored per-character in `beast_tribe_progress` (migration 003). The grid component (`BeastTribeGrid.tsx`) takes initial data from a server component and manages optimistic updates client-side.

**Lodestone scraping** (`src/lib/ffxiv/lodestone-card.ts`) uses `cheerio` — server-only. Never import this file from a client component. Shared constants (job roles, display order) live in `src/lib/ffxiv/ffxiv-jobs.ts` which is client-safe. The scraper fetches four pages in parallel: main profile, `/class_job/`, `/mount/`, `/minion/`. Scraped data is cached as JSONB in `character_card_settings.lodestone_data` with a 24-hour TTL.

**Image proxy** at `/api/image-proxy` proxies Lodestone CDN images (`img2.finalfantasyxiv.com`, `img.finalfantasyxiv.com`, `lds-img.finalfantasyxiv.com`) with `Access-Control-Allow-Origin: *` — required because html-to-image uses canvas which blocks cross-origin images. Any new Lodestone image hostname must be added to both this route's allowlist and `next.config.ts` `remotePatterns`.

**Character card export** uses `html-to-image` `toPng` at 2× pixel ratio (produces 1800×1000px). The card component is fixed at 900×500px and scaled to the viewport using a `ResizeObserver` in `CardGeneratorClient.tsx`.

## Database Schema (Supabase)

Six migrations in `supabase/migrations/`:
- `001` — `characters`, `checklist_items`, `checklist_state`, `push_subscriptions`, `notification_preferences` + RLS
- `002` — seeds checklist items (seeded data lives in `src/lib/ffxiv/checklist.ts`)
- `003` — `beast_tribe_progress` table
- `004` — deduplication of roulette checklist items
- `005` — `custom_deliveries_progress` table
- `006` — `character_card_settings` table (card accent color, toggle flags, cached Lodestone JSONB, custom portrait URL)

**RLS pattern:** `character_card_settings` and similar tables use a `user_id uuid` column with `user_id = auth.uid()` for RLS. Subquery-based RLS (`character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())`) can silently fail in Supabase — avoid it for insert/upsert policies. Always include `user_id: user.id` in upsert payloads for tables that use direct-column RLS.

## FFXIV-Specific Notes

- **Eorzea time**: 1 Eorzea hour = 175 real seconds. Weather changes every 23m 20s (8 Eorzea hours). Weather is deterministic from wall-clock time — see `src/lib/ffxiv/weather.ts`.
- **Resets**: Daily at 15:00 UTC, weekly Tuesday 08:00 UTC, Jumbo Cactpot Saturday 11:00 UTC (20:00 JST).
- **Character verification**: User adds a generated code to their Lodestone bio; app fetches their profile via XIVAPI v2 and checks `Bio` contains the code.
- **Beast tribe spoilers**: Tribes have an `expansion` field; `src/lib/spoiler.ts` and `SpoilerContext` filter what's shown based on user's spoiler settings.
- **Push notifications**: Vercel cron jobs (`vercel.json`) hit `/api/push/send?type=...` on schedule. VAPID keys and Supabase service role key are Vercel env vars.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # push notification sends only
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT               # mailto: address
```
