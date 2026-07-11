-- Atomic toggle for relic_progress.completed_steps.
-- Replaces the read-then-upsert pattern in the API route, eliminating the TOCTOU race
-- that occurs when handleToggle fires multiple concurrent POSTs for the same job.
create or replace function toggle_relic_step(
  p_character_id  uuid,
  p_expansion_key text,
  p_category      text,
  p_job_key       text,
  p_step_key      text,
  p_completed     boolean
) returns text[] language plpgsql security definer as $$
declare
  result_steps text[];
begin
  -- Ownership check (auth.uid() is available in security-definer context via Supabase JWT)
  if not exists (
    select 1 from characters
    where id = p_character_id and user_id = auth.uid()
  ) then
    raise exception 'Not found';
  end if;

  -- Ensure row exists
  insert into relic_progress (character_id, expansion_key, category, job_key, completed_steps, updated_at)
  values (p_character_id, p_expansion_key, p_category, p_job_key, '{}', now())
  on conflict (character_id, expansion_key, category, job_key) do nothing;

  -- Atomic array update
  update relic_progress set
    completed_steps = case
      when p_completed and not (p_step_key = any(completed_steps))
        then array_append(completed_steps, p_step_key)
      when not p_completed
        then array_remove(completed_steps, p_step_key)
      else completed_steps
    end,
    updated_at = now()
  where character_id = p_character_id
    and expansion_key = p_expansion_key
    and category      = p_category
    and job_key       = p_job_key
  returning completed_steps into result_steps;

  return coalesce(result_steps, '{}');
end;
$$;

grant execute on function toggle_relic_step to authenticated;
