import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase client backed by the service-role key.
 *
 * This bypasses RLS completely. Never import it from a client component, and
 * never expose the key through a NEXT_PUBLIC_ variable.
 *
 * Migration 015 revoked insert/update on marketplace_scans and item_catalog
 * from `authenticated`, so this is the only path that can write either table:
 * scan results, refresh leases, and the item metadata cache all go through here.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set")
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
