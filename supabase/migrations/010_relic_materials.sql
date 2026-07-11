create table public.relic_materials (
  character_id   uuid    not null references public.characters(id) on delete cascade,
  expansion_key  text    not null,
  category       text    not null,  -- 'weapon' | 'armor' | 'tool'
  material_key   text    not null,
  held_count     integer not null default 0 check (held_count >= 0),
  updated_at     timestamptz default now(),
  primary key (character_id, expansion_key, category, material_key)
);

alter table public.relic_materials enable row level security;

create policy "Users can manage their relic materials"
  on public.relic_materials for all
  using (
    character_id in (select id from public.characters where user_id = auth.uid())
  )
  with check (
    character_id in (select id from public.characters where user_id = auth.uid())
  );

create index on public.relic_materials(character_id);
