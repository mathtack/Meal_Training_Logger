-- Start on the current JSONB route. Only the database operator can switch modes.
create table migration_private.daily_record_write_mode (
  singleton boolean primary key default true check (singleton),
  mode text not null check (mode in ('jsonb', 'frozen', 'normalized'))
);
insert into migration_private.daily_record_write_mode(mode) values ('jsonb');
alter table migration_private.daily_record_write_mode enable row level security;
revoke all on migration_private.daily_record_write_mode from public, anon, authenticated;

-- Hold a shared lock until the caller's write commits. The operator's mode
-- update waits for those writes and prevents a new write from crossing the gate.
create function migration_private.require_daily_record_write_mode(p_mode text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actual_mode text;
begin
  select mode into strict actual_mode from migration_private.daily_record_write_mode
  where singleton for share;
  if actual_mode is distinct from p_mode then
    raise exception 'Daily record writes are unavailable on this route' using errcode = '55000';
  end if;
end;
$$;
revoke all on function migration_private.require_daily_record_write_mode(text) from public, anon, authenticated;
grant execute on function migration_private.require_daily_record_write_mode(text) to authenticated;

create function migration_private.guard_legacy_daily_record_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- The operator and the checked private RPCs write during reconciliation.
  if current_user <> 'postgres' then
    perform migration_private.require_daily_record_write_mode('jsonb');
  end if;
  return null;
end;
$$;
revoke all on function migration_private.guard_legacy_daily_record_write() from public, anon, authenticated;
create trigger daily_record_store_write_mode
before insert or update or delete on public.daily_record_store
for each statement execute function migration_private.guard_legacy_daily_record_write();

-- Only read privileges are needed on normalized tables by the browser.
revoke insert, update, delete on
  public.daily_record, public.weight_record, public.wellness_record,
  public.meal_record, public.meal_attachment, public.food_item, public.food_material,
  public.exercise_session, public.exercise_item, public.set_item
from authenticated;
revoke execute on function migration_private.write_normalized(jsonb, uuid, boolean) from authenticated;

-- Derive rollback JSONB from persisted rows, including server-owned timestamps,
-- rounded numeric values, stable entity IDs, order, and nullable draft food.
create function migration_private.derive_daily_record_mirror(p_owner uuid, p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' set timezone = 'UTC' as $$
  select jsonb_build_object(
    'daily_record', to_jsonb(d),
    'weights', coalesce((
      select jsonb_agg(to_jsonb(w) - 'user_id' order by w.measurement_order, w.id)
      from public.weight_record w where (w.daily_record_id, w.user_id) = (d.id, d.user_id)
    ), '[]'::jsonb),
    'wellness', (
      select to_jsonb(w) - 'user_id' from public.wellness_record w
      where (w.daily_record_id, w.user_id) = (d.id, d.user_id)
    ),
    'meals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'meal_record', to_jsonb(m) - 'user_id',
        'attachments', coalesce((
          select jsonb_agg(to_jsonb(a) - 'user_id' order by a.attachment_order, a.id)
          from public.meal_attachment a where (a.meal_record_id, a.user_id) = (m.id, m.user_id)
        ), '[]'::jsonb),
        'food_items', coalesce((
          select jsonb_agg(to_jsonb(f) - 'user_id' order by f.food_item_order, f.id)
          from public.food_item f where (f.meal_record_id, f.user_id) = (m.id, m.user_id)
        ), '[]'::jsonb)
      ) order by m.recording_category, m.meal_order, m.id)
      from public.meal_record m where (m.daily_record_id, m.user_id) = (d.id, d.user_id)
    ), '[]'::jsonb),
    'exercise_sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        -- The rollback UI renders the literal local clock time of these fields.
        'session', (to_jsonb(s) - 'user_id') || jsonb_build_object(
          'started_at', to_char(s.started_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '+09:00',
          'ended_at', to_char(s.ended_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '+09:00'
        ),
        'items', coalesce((
          select jsonb_agg(
            case when i.recording_style = 'SETS' then
              (to_jsonb(i) - 'user_id' - 'free_text') || jsonb_build_object('sets', coalesce((
                select jsonb_agg(to_jsonb(t) - 'user_id' order by t.set_order, t.id)
                from public.set_item t where (t.exercise_item_id, t.user_id) = (i.id, i.user_id)
              ), '[]'::jsonb))
            else to_jsonb(i) - 'user_id' end
            order by i.item_order, i.id
          )
          from public.exercise_item i where (i.exercise_session_id, i.user_id) = (s.id, s.user_id)
        ), '[]'::jsonb)
      ) order by s.session_order, s.id)
      from public.exercise_session s where (s.daily_record_id, s.user_id) = (d.id, d.user_id)
    ), '[]'::jsonb)
  ) from public.daily_record d where (d.id, d.user_id) = (p_id, p_owner)
$$;
revoke all on function migration_private.derive_daily_record_mirror(uuid, uuid) from public, anon, authenticated;

create function migration_private.upsert_daily_record_mirror(p_owner uuid, p_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  record_json jsonb := migration_private.derive_daily_record_mirror(p_owner, p_id);
begin
  if record_json is null then
    raise exception 'Normalized root missing from rollback projection' using errcode = '22023';
  end if;
  insert into public.daily_record_store(user_id, record_date, record_json, saved_at)
    values (p_owner, (record_json #>> '{daily_record,record_date}')::date, record_json, transaction_timestamp())
  on conflict (user_id, record_date) do update
    set record_json = excluded.record_json, saved_at = excluded.saved_at;
end;
$$;
revoke all on function migration_private.upsert_daily_record_mirror(uuid, uuid) from public, anon, authenticated;

-- The public RPC stays invoker. The non-exposed routine is the narrow elevated
-- boundary. It accepts no owner argument and derives authority from auth.uid().
create function migration_private.save_daily_record_with_mirror(p_record jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  identity jsonb;
begin
  if owner_id is null then raise exception 'Authentication is required' using errcode = '28000'; end if;
  perform migration_private.require_daily_record_write_mode('normalized');
  identity := migration_private.write_normalized(p_record, owner_id, false);
  perform migration_private.upsert_daily_record_mirror(owner_id, (identity ->> 'id')::uuid);
  return identity;
end;
$$;
revoke all on function migration_private.save_daily_record_with_mirror(jsonb) from public, anon, authenticated;
grant execute on function migration_private.save_daily_record_with_mirror(jsonb) to authenticated;

create or replace function public.save_daily_record_normalized(p_record jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select migration_private.save_daily_record_with_mirror(p_record)
$$;

create function migration_private.delete_daily_record_with_mirror(p_date date)
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
  if removed_id is null then
    return null;
  end if;
  delete from public.daily_record_store where (user_id, record_date) = (owner_id, p_date);
  return jsonb_build_object('id', removed_id, 'user_id', owner_id, 'record_date', p_date);
end;
$$;
revoke all on function migration_private.delete_daily_record_with_mirror(date) from public, anon, authenticated;
grant execute on function migration_private.delete_daily_record_with_mirror(date) to authenticated;

create function public.delete_daily_record_normalized(p_date date)
returns jsonb language sql security invoker set search_path = '' as $$
  select migration_private.delete_daily_record_with_mirror(p_date)
$$;
revoke all on function public.delete_daily_record_normalized(date) from public, anon, authenticated;
grant execute on function public.delete_daily_record_normalized(date) to authenticated;
