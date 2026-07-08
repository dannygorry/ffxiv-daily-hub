-- Beast tribe progress: per-character rank and daily quest tracking
create table public.beast_tribe_progress (
  character_id uuid not null references public.characters(id) on delete cascade,
  tribe_key    text not null,
  rank_level   smallint not null default 1,
  quests_mask  smallint not null default 0,   -- bitmask: bits 0-2 = quests 1-3
  quest_period text not null default '',       -- daily period key when quests_mask was set
  primary key (character_id, tribe_key)
);

-- Accumulated quests consumed by rank-ups mid-day (per character per daily period)
create table public.beast_tribe_daily_offset (
  character_id uuid not null references public.characters(id) on delete cascade,
  period       text not null,
  offset_count smallint not null default 0,
  primary key (character_id, period)
);

alter table public.beast_tribe_progress enable row level security;
alter table public.beast_tribe_daily_offset enable row level security;

create policy "Users can manage their beast tribe progress"
  on public.beast_tribe_progress for all
  using (character_id in (select id from public.characters where user_id = auth.uid()));

create policy "Users can manage their beast tribe daily offsets"
  on public.beast_tribe_daily_offset for all
  using (character_id in (select id from public.characters where user_id = auth.uid()));

create index on public.beast_tribe_progress(character_id);
create index on public.beast_tribe_daily_offset(character_id, period);
