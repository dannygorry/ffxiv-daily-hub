-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Characters linked to accounts
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lodestone_id bigint not null,
  name text not null,
  server text not null,
  data_center text,
  avatar_url text,
  verified boolean default false not null,
  verification_code text,
  is_primary boolean default false not null,
  sort_order integer default 0 not null,
  created_at timestamptz default now() not null,
  unique(lodestone_id)
);

-- Predefined task definitions (seeded by app)
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null check (category in ('daily', 'weekly')),
  subcategory text,
  sort_order integer default 0 not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null
);

-- Per-character completion state
create table public.checklist_state (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references public.characters(id) on delete cascade not null,
  item_id uuid references public.checklist_items(id) on delete cascade not null,
  completed_at timestamptz,
  reset_period text not null,
  unique(character_id, item_id, reset_period)
);

-- Browser push subscriptions
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now() not null,
  unique(endpoint)
);

-- Per-user notification preferences
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mini_cactpot boolean default true not null,
  jumbo_cactpot boolean default true not null,
  daily_reset boolean default false not null,
  weekly_reset boolean default false not null
);

-- Row Level Security

alter table public.characters enable row level security;
alter table public.checklist_state enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
-- checklist_items is public read (no RLS needed for select, but let's allow all)
alter table public.checklist_items enable row level security;

-- characters policies
create policy "Users can view their own characters"
  on public.characters for select using (auth.uid() = user_id);
create policy "Users can insert their own characters"
  on public.characters for insert with check (auth.uid() = user_id);
create policy "Users can update their own characters"
  on public.characters for update using (auth.uid() = user_id);
create policy "Users can delete their own characters"
  on public.characters for delete using (auth.uid() = user_id);

-- checklist_items — all authenticated users can read
create policy "Authenticated users can read checklist items"
  on public.checklist_items for select using (auth.role() = 'authenticated');

-- checklist_state — users can only touch state for their own characters
create policy "Users can view their own checklist state"
  on public.checklist_state for select
  using (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );
create policy "Users can upsert their own checklist state"
  on public.checklist_state for insert
  with check (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );
create policy "Users can delete their own checklist state"
  on public.checklist_state for delete
  using (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );

-- push_subscriptions
create policy "Users can manage their own subscriptions"
  on public.push_subscriptions for all using (auth.uid() = user_id);

-- notification_preferences
create policy "Users can manage their own notification preferences"
  on public.notification_preferences for all using (auth.uid() = user_id);

-- Service role can read push subscriptions (for sending notifications)
create policy "Service role can read push subscriptions"
  on public.push_subscriptions for select using (auth.role() = 'service_role');
create policy "Service role can read notification preferences"
  on public.notification_preferences for select using (auth.role() = 'service_role');

-- Indexes for performance
create index on public.characters(user_id);
create index on public.checklist_state(character_id, reset_period);
create index on public.push_subscriptions(user_id);
