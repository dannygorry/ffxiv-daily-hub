-- Remove stale armor progress rows saved under the old slot-only job_key format
-- (e.g. "Head", "Body") before armor tracking was changed to gear-set-specific
-- keys (e.g. "fending_head", "healing_head").
-- Safe to run even if no such rows exist.
delete from public.relic_progress
where category = 'armor'
  and job_key in ('Head', 'Body', 'Hands', 'Legs', 'Feet');
