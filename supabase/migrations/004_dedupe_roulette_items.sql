-- Full deduplication pass.
--
-- Two problems exist simultaneously:
--   1. The entire seed ran twice, so every item has an identical-name duplicate.
--   2. The roulette rename script ran on one copy, so duty roulette items additionally
--      exist under BOTH the old "Duty Roulette: X" name and the new short name.
--
-- Fix order:
--   a) Collapse renamed duty roulette pairs first (old name → new name).
--   b) Then collapse any remaining identical-name duplicates generically.

do $$
declare
  old_id  uuid;
  new_id  uuid;
  keep_id uuid;
  dup_id  uuid;
  dup     record;
  pairs   text[][] := array[
    array['Duty Roulette: Expert',                     'Expert'],
    array['Duty Roulette: Level 90 Dungeons',          'Level Cap Dungeons'],
    array['Duty Roulette: Level 50/60/70/80 Dungeons', 'High-level Dungeons'],
    array['Duty Roulette: Leveling',                   'Leveling'],
    array['Duty Roulette: Main Scenario',              'Main Scenario'],
    array['Duty Roulette: Trials',                     'Trials'],
    array['Duty Roulette: Alliance Raids',             'Alliance Raids'],
    array['Duty Roulette: Normal Raids',               'Normal Raids'],
    array['Duty Roulette: Frontline',                  'Frontline'],
    array['Duty Roulette: Guildhest',                  'Guildhests'],
    array['Duty Roulette: Mentor',                     'Mentor']
  ];
  pair text[];
begin

  -- ── Step 1: collapse renamed roulette pairs ───────────────────────────────
  foreach pair slice 1 in array pairs loop
    select id into old_id from public.checklist_items where name = pair[1];
    select id into new_id from public.checklist_items where name = pair[2];

    if old_id is not null and new_id is not null then
      -- Drop state rows that would conflict after the re-point
      delete from public.checklist_state s
      where s.item_id = old_id
        and exists (
          select 1 from public.checklist_state t
          where t.item_id      = new_id
            and t.character_id = s.character_id
            and t.reset_period = s.reset_period
        );
      update public.checklist_state set item_id = new_id where item_id = old_id;
      delete from public.checklist_items where id = old_id;

    elsif old_id is not null then
      -- New name doesn't exist yet — rename in place
      update public.checklist_items set name = pair[2] where id = old_id;
    end if;
  end loop;

  -- ── Step 2: collapse identical-name duplicates (cactpot, hunts, tribes …) ─
  for dup in (
    select name
    from public.checklist_items
    group by name
    having count(*) > 1
  ) loop
    -- Keep the row created earliest (most likely the original seed row)
    select id into keep_id
    from public.checklist_items
    where name = dup.name
    order by created_at asc, id asc
    limit 1;

    for dup_id in (
      select id from public.checklist_items
      where name = dup.name and id <> keep_id
    ) loop
      -- Drop conflicting state rows
      delete from public.checklist_state s
      where s.item_id = dup_id
        and exists (
          select 1 from public.checklist_state t
          where t.item_id      = keep_id
            and t.character_id = s.character_id
            and t.reset_period = s.reset_period
        );
      -- Re-point remaining state to the kept row
      update public.checklist_state set item_id = keep_id where item_id = dup_id;
      -- Remove the duplicate item
      delete from public.checklist_items where id = dup_id;
    end loop;
  end loop;

end $$;
