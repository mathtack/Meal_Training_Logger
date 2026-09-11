-- Phase 2-D: expose the normalized aggregate through one authenticated,
-- transaction-scoped write boundary. Runtime cutover remains a later phase.

create policy "Users can manage their own normalized daily records"
on public.daily_record for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own normalized weights"
on public.weight_record for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own normalized wellness"
on public.wellness_record for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own normalized meals"
on public.meal_record for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own normalized meal attachments"
on public.meal_attachment for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own normalized food items"
on public.food_item for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own normalized food materials"
on public.food_material for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own normalized exercise sessions"
on public.exercise_session for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own normalized exercise items"
on public.exercise_item for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own normalized set items"
on public.set_item for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table
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
to authenticated;

create or replace function public.save_daily_record_normalized(p_record jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_daily jsonb;
  v_weight jsonb;
  v_wellness jsonb;
  v_meal jsonb;
  v_attachment jsonb;
  v_food jsonb;
  v_session jsonb;
  v_item jsonb;
  v_set jsonb;
  v_record_id uuid;
  v_payload_user_id uuid;
  v_record_date date;
  v_payload_created_at timestamptz;
  v_stored_id uuid;
  v_stored_created_at timestamptz;
  v_now timestamptz := transaction_timestamp();
begin
  if v_auth_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;

  if jsonb_typeof(p_record) is distinct from 'object'
    or jsonb_typeof(p_record -> 'daily_record') is distinct from 'object'
    or jsonb_typeof(p_record -> 'weights') is distinct from 'array'
    or (
      jsonb_typeof(p_record -> 'wellness') is distinct from 'null'
      and jsonb_typeof(p_record -> 'wellness') is distinct from 'object'
    )
    or jsonb_typeof(p_record -> 'meals') is distinct from 'array'
    or jsonb_typeof(p_record -> 'exercise_sessions') is distinct from 'array'
  then
    raise exception 'Invalid normalized DailyRecord aggregate shape'
      using errcode = '22023';
  end if;

  v_daily := p_record -> 'daily_record';
  v_record_id := (v_daily ->> 'id')::uuid;
  v_payload_user_id := (v_daily ->> 'user_id')::uuid;
  v_record_date := (v_daily ->> 'record_date')::date;
  v_payload_created_at := (v_daily ->> 'created_at')::timestamptz;

  if v_payload_user_id <> v_auth_user_id then
    raise exception 'Payload user_id must match the authenticated user'
      using errcode = '42501';
  end if;

  insert into public.app_user (id)
  values (v_auth_user_id)
  on conflict (id) do nothing;

  insert into public.daily_record (
    id, user_id, record_date, created_at, updated_at
  ) values (
    v_record_id, v_auth_user_id, v_record_date, v_payload_created_at, v_now
  )
  on conflict (user_id, record_date) do nothing;

  select id, created_at
    into strict v_stored_id, v_stored_created_at
  from public.daily_record
  where user_id = v_auth_user_id and record_date = v_record_date
  for update;

  if v_stored_id <> v_record_id then
    raise exception 'A saved date must keep its existing daily_record id'
      using errcode = '22023';
  end if;

  update public.daily_record
  set updated_at = v_now
  where id = v_record_id and user_id = v_auth_user_id;

  -- Replacing direct descendants is safe because every deeper relationship
  -- cascades and the enclosing function is one database transaction.
  delete from public.weight_record
  where daily_record_id = v_record_id and user_id = v_auth_user_id;
  delete from public.wellness_record
  where daily_record_id = v_record_id and user_id = v_auth_user_id;
  delete from public.meal_record
  where daily_record_id = v_record_id and user_id = v_auth_user_id;
  delete from public.exercise_session
  where daily_record_id = v_record_id and user_id = v_auth_user_id;

  for v_weight in select value from jsonb_array_elements(p_record -> 'weights') loop
    if jsonb_typeof(v_weight) is distinct from 'object'
      or (v_weight ->> 'daily_record_id')::uuid <> v_record_id
    then
      raise exception 'Weight parent does not match daily_record.id'
        using errcode = '22023';
    end if;

  end loop;

  v_wellness := p_record -> 'wellness';
  if v_wellness <> 'null'::jsonb then
    if (v_wellness ->> 'daily_record_id')::uuid <> v_record_id then
      raise exception 'Wellness parent does not match daily_record.id'
        using errcode = '22023';
    end if;

  end if;

  for v_meal in select value from jsonb_array_elements(p_record -> 'meals') loop
    if jsonb_typeof(v_meal) is distinct from 'object'
      or jsonb_typeof(v_meal -> 'meal_record') is distinct from 'object'
      or jsonb_typeof(v_meal -> 'attachments') is distinct from 'array'
      or jsonb_typeof(v_meal -> 'food_items') is distinct from 'array'
      or (v_meal -> 'meal_record' ->> 'daily_record_id')::uuid <> v_record_id
    then
      raise exception 'Invalid meal aggregate or parent relationship'
        using errcode = '22023';
    end if;

    for v_attachment in
      select value from jsonb_array_elements(v_meal -> 'attachments')
    loop
      if jsonb_typeof(v_attachment) is distinct from 'object'
        or (v_attachment ->> 'meal_record_id')::uuid
          <> (v_meal -> 'meal_record' ->> 'id')::uuid
      then
        raise exception 'Attachment parent does not match enclosing meal'
          using errcode = '22023';
      end if;

    end loop;

    for v_food in select value from jsonb_array_elements(v_meal -> 'food_items') loop
      if jsonb_typeof(v_food) is distinct from 'object'
        or (v_food ->> 'meal_record_id')::uuid
          <> (v_meal -> 'meal_record' ->> 'id')::uuid
      then
        raise exception 'Food item parent does not match enclosing meal'
          using errcode = '22023';
      end if;

    end loop;
  end loop;

  for v_session in
    select value from jsonb_array_elements(p_record -> 'exercise_sessions')
  loop
    if jsonb_typeof(v_session) is distinct from 'object'
      or jsonb_typeof(v_session -> 'session') is distinct from 'object'
      or jsonb_typeof(v_session -> 'items') is distinct from 'array'
      or (v_session -> 'session' ->> 'daily_record_id')::uuid <> v_record_id
    then
      raise exception 'Invalid exercise session or parent relationship'
        using errcode = '22023';
    end if;

    for v_item in select value from jsonb_array_elements(v_session -> 'items') loop
      if jsonb_typeof(v_item) is distinct from 'object'
        or (v_item ->> 'exercise_session_id')::uuid
          <> (v_session -> 'session' ->> 'id')::uuid
        or (v_item ->> 'recording_style') not in ('SETS', 'TEXT')
        or ((v_item ->> 'recording_style') = 'SETS'
          and jsonb_typeof(v_item -> 'sets') is distinct from 'array')
        or ((v_item ->> 'recording_style') = 'TEXT'
          and jsonb_typeof(v_item -> 'free_text') is distinct from 'string')
      then
        raise exception 'Invalid exercise item or parent relationship'
          using errcode = '22023';
      end if;

      if (v_item ->> 'recording_style') = 'SETS' then
        for v_set in select value from jsonb_array_elements(v_item -> 'sets') loop
          if jsonb_typeof(v_set) is distinct from 'object'
            or (v_set ->> 'exercise_item_id')::uuid <> (v_item ->> 'id')::uuid
          then
            raise exception 'Set parent does not match enclosing exercise item'
              using errcode = '22023';
          end if;

        end loop;
      end if;
    end loop;
  end loop;

  -- Insert each collection as one set-based statement, in parent-to-child
  -- order, after the complete relationship shape has been validated.
  insert into public.weight_record (
    id, daily_record_id, user_id, measurement_time_slot,
    measurement_order, measured_at, weight, created_at, updated_at
  )
  select
    (weight.value ->> 'id')::uuid,
    v_record_id,
    v_auth_user_id,
    weight.value ->> 'measurement_time_slot',
    (weight.value ->> 'measurement_order')::integer,
    nullif(weight.value ->> 'measured_at', '')::timestamptz,
    (weight.value ->> 'weight')::numeric,
    (weight.value ->> 'created_at')::timestamptz,
    (weight.value ->> 'updated_at')::timestamptz
  from jsonb_array_elements(p_record -> 'weights') as weight(value);

  insert into public.wellness_record (
    daily_record_id, user_id, sleep_duration_category, sleep_quality,
    sleep_duration_minutes, sleep_source, water_intake,
    physical_condition, mood, hunger_level, bowel_movement,
    created_at, updated_at
  )
  select
    v_record_id,
    v_auth_user_id,
    v_wellness ->> 'sleep_duration_category',
    v_wellness ->> 'sleep_quality',
    nullif(v_wellness ->> 'sleep_duration_minutes', '')::integer,
    v_wellness ->> 'sleep_source',
    v_wellness ->> 'water_intake',
    v_wellness ->> 'physical_condition',
    v_wellness ->> 'mood',
    v_wellness ->> 'hunger_level',
    v_wellness ->> 'bowel_movement',
    (v_wellness ->> 'created_at')::timestamptz,
    (v_wellness ->> 'updated_at')::timestamptz
  where v_wellness <> 'null'::jsonb;

  insert into public.meal_record (
    id, daily_record_id, user_id, recording_category, meal_order,
    eaten_at, meal_memo, created_at, updated_at
  )
  select
    (meal.value -> 'meal_record' ->> 'id')::uuid,
    v_record_id,
    v_auth_user_id,
    meal.value -> 'meal_record' ->> 'recording_category',
    (meal.value -> 'meal_record' ->> 'meal_order')::integer,
    nullif(meal.value -> 'meal_record' ->> 'eaten_at', '')::timestamptz,
    meal.value -> 'meal_record' ->> 'meal_memo',
    (meal.value -> 'meal_record' ->> 'created_at')::timestamptz,
    (meal.value -> 'meal_record' ->> 'updated_at')::timestamptz
  from jsonb_array_elements(p_record -> 'meals') as meal(value);

  insert into public.meal_attachment (
    id, meal_record_id, user_id, storage_path, attachment_order,
    created_at, updated_at
  )
  select
    (attachment.value ->> 'id')::uuid,
    (meal.value -> 'meal_record' ->> 'id')::uuid,
    v_auth_user_id,
    attachment.value ->> 'storage_path',
    nullif(attachment.value ->> 'attachment_order', '')::integer,
    (attachment.value ->> 'created_at')::timestamptz,
    (attachment.value ->> 'updated_at')::timestamptz
  from jsonb_array_elements(p_record -> 'meals') as meal(value)
  cross join lateral jsonb_array_elements(meal.value -> 'attachments')
    as attachment(value);

  insert into public.food_item (
    id, meal_record_id, user_id, food_item_order, food_name,
    food_amount, food_amount_unit, food_calorie, food_protein,
    food_fat, food_carbohydrates, created_at, updated_at
  )
  select
    (food.value ->> 'id')::uuid,
    (meal.value -> 'meal_record' ->> 'id')::uuid,
    v_auth_user_id,
    (food.value ->> 'food_item_order')::integer,
    food.value ->> 'food_name',
    nullif(food.value ->> 'food_amount', '')::numeric,
    food.value ->> 'food_amount_unit',
    nullif(food.value ->> 'food_calorie', '')::numeric,
    nullif(food.value ->> 'food_protein', '')::numeric,
    nullif(food.value ->> 'food_fat', '')::numeric,
    nullif(food.value ->> 'food_carbohydrates', '')::numeric,
    (food.value ->> 'created_at')::timestamptz,
    (food.value ->> 'updated_at')::timestamptz
  from jsonb_array_elements(p_record -> 'meals') as meal(value)
  cross join lateral jsonb_array_elements(meal.value -> 'food_items')
    as food(value);

  insert into public.exercise_session (
    id, daily_record_id, user_id, session_order, session_label,
    started_at, ended_at, memo, calories_burned, created_at, updated_at
  )
  select
    (session.value -> 'session' ->> 'id')::uuid,
    v_record_id,
    v_auth_user_id,
    (session.value -> 'session' ->> 'session_order')::integer,
    session.value -> 'session' ->> 'session_label',
    nullif(session.value -> 'session' ->> 'started_at', '')::timestamptz,
    nullif(session.value -> 'session' ->> 'ended_at', '')::timestamptz,
    session.value -> 'session' ->> 'memo',
    nullif(session.value -> 'session' ->> 'calories_burned', '')::integer,
    (session.value -> 'session' ->> 'created_at')::timestamptz,
    (session.value -> 'session' ->> 'updated_at')::timestamptz
  from jsonb_array_elements(p_record -> 'exercise_sessions')
    as session(value);

  insert into public.exercise_item (
    id, exercise_session_id, user_id, item_order, body_part,
    exercise_name, exercise_type, recording_style, free_text,
    created_at, updated_at
  )
  select
    (item.value ->> 'id')::uuid,
    (session.value -> 'session' ->> 'id')::uuid,
    v_auth_user_id,
    (item.value ->> 'item_order')::integer,
    item.value ->> 'body_part',
    item.value ->> 'exercise_name',
    item.value ->> 'exercise_type',
    item.value ->> 'recording_style',
    case when (item.value ->> 'recording_style') = 'TEXT'
      then item.value ->> 'free_text' else null end,
    (item.value ->> 'created_at')::timestamptz,
    (item.value ->> 'updated_at')::timestamptz
  from jsonb_array_elements(p_record -> 'exercise_sessions')
    as session(value)
  cross join lateral jsonb_array_elements(session.value -> 'items')
    as item(value);

  insert into public.set_item (
    id, exercise_item_id, user_id, set_order, load_value,
    load_unit, reps, has_sides, reps_left, reps_right,
    duration_seconds, memo, created_at, updated_at
  )
  select
    (set_row.value ->> 'id')::uuid,
    (item.value ->> 'id')::uuid,
    v_auth_user_id,
    (set_row.value ->> 'set_order')::integer,
    nullif(set_row.value ->> 'load_value', '')::numeric,
    set_row.value ->> 'load_unit',
    nullif(set_row.value ->> 'reps', '')::integer,
    (set_row.value ->> 'has_sides')::boolean,
    nullif(set_row.value ->> 'reps_left', '')::integer,
    nullif(set_row.value ->> 'reps_right', '')::integer,
    nullif(set_row.value ->> 'duration_seconds', '')::integer,
    set_row.value ->> 'memo',
    (set_row.value ->> 'created_at')::timestamptz,
    (set_row.value ->> 'updated_at')::timestamptz
  from jsonb_array_elements(p_record -> 'exercise_sessions')
    as session(value)
  cross join lateral jsonb_array_elements(session.value -> 'items')
    as item(value)
  cross join lateral jsonb_array_elements(item.value -> 'sets')
    as set_row(value)
  where item.value ->> 'recording_style' = 'SETS';

  return jsonb_build_object(
    'id', v_stored_id,
    'user_id', v_auth_user_id,
    'record_date', v_record_date,
    'created_at', v_stored_created_at,
    'updated_at', v_now
  );
end;
$$;

revoke all on function public.save_daily_record_normalized(jsonb)
from public, anon, authenticated;
grant execute on function public.save_daily_record_normalized(jsonb)
to authenticated;
