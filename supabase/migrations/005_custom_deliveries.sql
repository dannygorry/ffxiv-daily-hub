create table public.custom_delivery_progress (
  character_id        uuid references public.characters(id) on delete cascade not null,
  client_key          text not null,
  satisfaction_level  smallint not null default 1,
  deliveries_mask     smallint not null default 0,  -- 6-bit bitmask, bits 0-5
  delivery_period     text not null default '',     -- weekly period key
  primary key (character_id, client_key)
);

alter table public.custom_delivery_progress enable row level security;

create policy "Users can manage their own delivery progress"
  on public.custom_delivery_progress for all
  using (
    character_id in (select id from public.characters where user_id = auth.uid())
  )
  with check (
    character_id in (select id from public.characters where user_id = auth.uid())
  );

create index on public.custom_delivery_progress(character_id);

-- Remove old simple-checkbox items if they survived the dedup migration
delete from public.checklist_items
where name in ('Custom Deliveries', 'Custom Deliveries (Weekly Cap)');
