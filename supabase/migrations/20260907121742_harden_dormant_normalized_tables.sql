-- Phase 2-B: keep the dormant normalized schema inaccessible through the
-- Data API until its ownership model and runtime persistence are implemented.
--
-- This migration intentionally does not touch app_user or daily_record_store,
-- which remain the current application persistence path. It creates no allow
-- policies and performs no data changes.

alter table public.daily_record enable row level security;
alter table public.weight_record enable row level security;
alter table public.wellness_record enable row level security;
alter table public.meal_record enable row level security;
alter table public.meal_attachment enable row level security;
alter table public.food_item enable row level security;
alter table public.food_material enable row level security;
alter table public.exercise_session enable row level security;
alter table public.exercise_item enable row level security;
alter table public.set_item enable row level security;

revoke all privileges on table
  public.daily_record,
  public.weight_record,
  public.wellness_record,
  public.meal_record,
  public.meal_attachment,
  public.food_item,
  public.food_material,
  public.exercise_session,
  public.exercise_item,
  public.set_item
from public, anon, authenticated;

-- Fail instead of silently shipping an allow policy that would make this
-- hardening migration's intent ambiguous. Policies are added only when the
-- normalized runtime path is implemented and reviewed.
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'daily_record',
        'weight_record',
        'wellness_record',
        'meal_record',
        'meal_attachment',
        'food_item',
        'food_material',
        'exercise_session',
        'exercise_item',
        'set_item'
      )
  ) then
    raise exception
      'Dormant normalized tables must not have allow policies before activation';
  end if;
end;
$$;
