-- Allow anonymous (unauthenticated) users to read checklist items
-- so the guest checklist preview on /dashboard works without signing in.
drop policy if exists "Authenticated users can read checklist items" on public.checklist_items;

create policy "Anyone can read checklist items"
  on public.checklist_items for select using (true);
