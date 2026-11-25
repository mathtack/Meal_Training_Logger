-- Serialize retirement with in-flight application writes. Empty new databases
-- can enter the normalized route directly; a populated JSONB-only DB must first
-- complete its cutover.
do $$
declare
  write_mode text;
begin
  select mode into strict write_mode
  from migration_private.daily_record_write_mode where singleton for update;
  if write_mode = 'jsonb' then
    if exists (select 1 from public.daily_record)
       or exists (select 1 from public.daily_record_store) then
      raise exception 'Complete normalized cutover before retiring JSONB';
    end if;
    update migration_private.daily_record_write_mode set mode = 'normalized' where singleton;
  end if;
end;
$$;

create function migration_private.save_daily_record_current(p_record jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication is required' using errcode = '28000'; end if;
  perform migration_private.require_daily_record_write_mode('normalized');
  return migration_private.write_normalized(p_record, owner_id, false);
end;
$$;
revoke all on function migration_private.save_daily_record_current(jsonb) from public, anon, authenticated;
grant execute on function migration_private.save_daily_record_current(jsonb) to authenticated;

create function migration_private.delete_daily_record_current(p_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  removed_id uuid;
begin
  if owner_id is null then raise exception 'Authentication is required' using errcode = '28000'; end if;
  if p_date is null then raise exception 'Record date is required' using errcode = '22023'; end if;
  perform migration_private.require_daily_record_write_mode('normalized');
  delete from public.daily_record where (user_id, record_date) = (owner_id, p_date)
    returning id into removed_id;
  if removed_id is null then return null; end if;
  return jsonb_build_object('id', removed_id, 'user_id', owner_id, 'record_date', p_date);
end;
$$;
revoke all on function migration_private.delete_daily_record_current(date) from public, anon, authenticated;
grant execute on function migration_private.delete_daily_record_current(date) to authenticated;

create or replace function public.save_daily_record_normalized(p_record jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select migration_private.save_daily_record_current(p_record)
$$;

create or replace function public.delete_daily_record_normalized(p_date date)
returns jsonb language sql security invoker set search_path = '' as $$
  select migration_private.delete_daily_record_current(p_date)
$$;

revoke all on function public.save_daily_record_normalized(jsonb),
  public.delete_daily_record_normalized(date) from public, anon, authenticated;
grant execute on function public.save_daily_record_normalized(jsonb),
  public.delete_daily_record_normalized(date) to authenticated;

-- Retain archive data and the operator's reconstruction helpers.
revoke all on public.daily_record_store from public, anon, authenticated;
revoke all (id, user_id, record_date, record_json, saved_at)
  on public.daily_record_store from public, anon, authenticated;
revoke all on function migration_private.save_daily_record_with_mirror(jsonb),
  migration_private.delete_daily_record_with_mirror(date) from public, anon, authenticated;
