-- Operator-only recovery, after explicit approval of the current snapshot,
-- affected owners/dates, reconstruction and JSONB API grants.
-- Run as one transaction after setting the write mode to frozen.
begin;
set local lock_timeout = '5s';
set local timezone = 'UTC';

do $$
begin
  if current_user <> 'postgres' then raise exception 'Database operator required'; end if;
  if (select mode from migration_private.daily_record_write_mode where singleton for update)
      is distinct from 'frozen' then
    raise exception 'Freeze application writes before reconstruction';
  end if;
end;
$$;

-- Block operator maintenance as well as application writes during projection.
lock table public.daily_record, public.weight_record, public.wellness_record,
  public.meal_record, public.meal_attachment, public.food_item, public.food_material,
  public.exercise_session, public.exercise_item, public.set_item,
  public.daily_record_store in share row exclusive mode;

create temporary table rollback_projection on commit drop as
select d.user_id, d.record_date,
  migration_private.derive_daily_record_mirror(d.user_id, d.id) as record_json
from public.daily_record d;

insert into public.daily_record_store(user_id, record_date, record_json, saved_at)
select user_id, record_date, record_json, transaction_timestamp() from rollback_projection
on conflict (user_id, record_date) do update
set record_json = excluded.record_json, saved_at = excluded.saved_at;

-- Remove archived rows whose normalized records were deleted after retirement.
delete from public.daily_record_store s
where not exists (
  select 1 from rollback_projection p where (p.user_id, p.record_date) = (s.user_id, s.record_date)
);

do $$
begin
  if exists (
    select 1 from rollback_projection p full join public.daily_record_store s using(user_id, record_date)
    where p.record_json is distinct from s.record_json
  ) then raise exception 'Rollback projection mismatch'; end if;
end;
$$;

grant select, insert, update, delete on public.daily_record_store to authenticated;
-- Publish and verify the approved JSONB app before separately unfreezing writes.
-- An error anywhere above rolls the reconstruction and grants back together.
commit;
