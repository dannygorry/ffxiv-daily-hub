-- Add opt-in toggle for showing relic completion bars on the character card.
alter table public.character_card_settings
  add column if not exists show_relic_progress boolean not null default false;
