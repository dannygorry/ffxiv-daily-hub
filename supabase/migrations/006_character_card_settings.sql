create table public.character_card_settings (
  character_id          uuid primary key references public.characters(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  lodestone_data        jsonb,
  lodestone_fetched_at  timestamptz,
  custom_portrait_url   text,
  card_accent_color     text default '#4f8ef7',
  show_job_grid         boolean default true not null,
  show_mounts           boolean default true not null,
  show_minions          boolean default true not null,
  show_eureka           boolean default false not null,
  created_at            timestamptz default now() not null,
  updated_at            timestamptz default now() not null
);

alter table public.character_card_settings enable row level security;

create policy "Users manage their own card settings"
  on public.character_card_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index on public.character_card_settings(character_id);
create index on public.character_card_settings(user_id);
