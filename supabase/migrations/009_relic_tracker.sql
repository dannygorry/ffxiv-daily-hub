create table public.relic_progress (
  character_id    uuid    not null references public.characters(id) on delete cascade,
  expansion_key   text    not null,  -- 'arr' | 'hw' | 'sb' | 'shb' | 'ew' | 'dt'
  category        text    not null,  -- 'weapon' | 'armor' | 'tool'
  job_key         text    not null,  -- job name e.g. "Paladin", or slot name e.g. "Head"
  completed_steps text[]  not null default '{}',
  updated_at      timestamptz default now(),
  primary key (character_id, expansion_key, category, job_key)
);

alter table public.relic_progress enable row level security;

create policy "Users can manage their relic progress"
  on public.relic_progress for all
  using (
    character_id in (select id from public.characters where user_id = auth.uid())
  )
  with check (
    character_id in (select id from public.characters where user_id = auth.uid())
  );

create index on public.relic_progress(character_id);
