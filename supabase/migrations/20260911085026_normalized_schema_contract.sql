-- Phase 2-C: establish the ownership, relationship, and validation contract
-- required by the normalized DailyRecord aggregate.
--
-- The normalized tables remain dark after this migration: RLS stays enabled,
-- no allow policies are created, and browser roles receive no grants. Runtime
-- persistence, backfill, and production cutover are separate execution issues.

do $$
begin
  if exists (select 1 from public.daily_record limit 1)
    or exists (select 1 from public.weight_record limit 1)
    or exists (select 1 from public.wellness_record limit 1)
    or exists (select 1 from public.meal_record limit 1)
    or exists (select 1 from public.meal_attachment limit 1)
    or exists (select 1 from public.food_item limit 1)
    or exists (select 1 from public.food_material limit 1)
    or exists (select 1 from public.exercise_session limit 1)
    or exists (select 1 from public.exercise_item limit 1)
    or exists (select 1 from public.set_item limit 1)
  then
    raise exception
      'Normalized schema contract migration requires all normalized tables to be empty';
  end if;
end;
$$;

alter table public.weight_record add column user_id uuid not null;
alter table public.wellness_record add column user_id uuid not null;
alter table public.meal_record add column user_id uuid not null;
alter table public.meal_attachment add column user_id uuid not null;
alter table public.food_item add column user_id uuid not null;
alter table public.food_material add column user_id uuid not null;
alter table public.exercise_session add column user_id uuid not null;
alter table public.exercise_item add column user_id uuid not null;
alter table public.set_item add column user_id uuid not null;

-- Preserve draft food rows exactly as represented by the current aggregate.
alter table public.food_item alter column food_amount drop not null;
alter table public.food_item alter column food_calorie drop not null;

-- A tenant-qualified key on every table that owns children lets each child
-- prove that its user_id matches the selected parent.
alter table public.daily_record
  add constraint daily_record_id_user_key unique (id, user_id);
alter table public.meal_record
  add constraint meal_record_id_user_key unique (id, user_id);
alter table public.food_item
  add constraint food_item_id_user_key unique (id, user_id);
alter table public.exercise_session
  add constraint exercise_session_id_user_key unique (id, user_id);
alter table public.exercise_item
  add constraint exercise_item_id_user_key unique (id, user_id);

-- Replace single-column relationships with tenant-qualified relationships.
alter table public.weight_record
  drop constraint weight_record_daily_record_id_fkey,
  add constraint weight_record_daily_record_user_fkey
    foreign key (daily_record_id, user_id)
    references public.daily_record (id, user_id) on delete cascade;

alter table public.wellness_record
  drop constraint wellness_record_daily_record_id_fkey,
  add constraint wellness_record_daily_record_user_fkey
    foreign key (daily_record_id, user_id)
    references public.daily_record (id, user_id) on delete cascade;

alter table public.meal_record
  drop constraint meal_record_daily_record_id_fkey,
  add constraint meal_record_daily_record_user_fkey
    foreign key (daily_record_id, user_id)
    references public.daily_record (id, user_id) on delete cascade;

alter table public.meal_attachment
  drop constraint meal_attachment_meal_record_id_fkey,
  add constraint meal_attachment_meal_record_user_fkey
    foreign key (meal_record_id, user_id)
    references public.meal_record (id, user_id) on delete cascade;

alter table public.food_item
  drop constraint food_item_meal_record_id_fkey,
  add constraint food_item_meal_record_user_fkey
    foreign key (meal_record_id, user_id)
    references public.meal_record (id, user_id) on delete cascade;

alter table public.food_material
  drop constraint food_material_food_item_id_fkey,
  add constraint food_material_food_item_user_fkey
    foreign key (food_item_id, user_id)
    references public.food_item (id, user_id) on delete cascade;

alter table public.exercise_session
  drop constraint exercise_session_daily_record_id_fkey,
  add constraint exercise_session_daily_record_user_fkey
    foreign key (daily_record_id, user_id)
    references public.daily_record (id, user_id) on delete cascade;

alter table public.exercise_item
  drop constraint exercise_item_exercise_session_id_fkey,
  add constraint exercise_item_exercise_session_user_fkey
    foreign key (exercise_session_id, user_id)
    references public.exercise_session (id, user_id) on delete cascade;

alter table public.set_item
  drop constraint set_item_exercise_item_id_fkey,
  add constraint set_item_exercise_item_user_fkey
    foreign key (exercise_item_id, user_id)
    references public.exercise_item (id, user_id) on delete cascade;

-- Persist display order as a zero-based, unique business key within each
-- parent aggregate where the approved contract requires uniqueness.
alter table public.weight_record
  add constraint weight_record_measurement_order_check
    check (measurement_order >= 0),
  add constraint weight_record_daily_order_key
    unique (daily_record_id, measurement_order);

alter table public.meal_record
  add constraint meal_record_meal_order_check
    check (meal_order >= 0),
  add constraint meal_record_daily_category_order_key
    unique (daily_record_id, recording_category, meal_order);

alter table public.meal_attachment
  add constraint meal_attachment_order_check
    check (attachment_order >= 0);

alter table public.food_item
  add constraint food_item_order_check
    check (food_item_order >= 0),
  add constraint food_item_meal_order_key
    unique (meal_record_id, food_item_order);

alter table public.food_material
  add constraint food_material_order_check
    check (food_material_order >= 0),
  add constraint food_material_food_order_key
    unique (food_item_id, food_material_order);

alter table public.exercise_session
  add constraint exercise_session_order_check
    check (session_order >= 0);

alter table public.exercise_item
  add constraint exercise_item_order_check
    check (item_order >= 0),
  add constraint exercise_item_type_check
    check (exercise_type in ('AEROBIC', 'ANAEROBIC')),
  add constraint exercise_item_recording_style_check
    check (recording_style in ('SETS', 'TEXT'));

alter table public.set_item
  add constraint set_item_order_check
    check (set_order >= 0),
  add constraint set_item_load_unit_check
    check (load_unit is null or load_unit in ('KG', 'LBS', 'BODYWEIGHT'));

-- Composite parent lookups support FK checks and cascades. user_id-leading
-- indexes support the future direct ownership RLS policies on every child.
create index weight_record_daily_record_user_idx
  on public.weight_record (daily_record_id, user_id);
create index weight_record_user_id_idx
  on public.weight_record (user_id);

create index wellness_record_daily_record_user_idx
  on public.wellness_record (daily_record_id, user_id);
create index wellness_record_user_id_idx
  on public.wellness_record (user_id);

create index meal_record_daily_record_user_idx
  on public.meal_record (daily_record_id, user_id);
create index meal_record_user_id_idx
  on public.meal_record (user_id);

create index meal_attachment_meal_record_user_idx
  on public.meal_attachment (meal_record_id, user_id);
create index meal_attachment_user_id_idx
  on public.meal_attachment (user_id);

create index food_item_meal_record_user_idx
  on public.food_item (meal_record_id, user_id);
create index food_item_user_id_idx
  on public.food_item (user_id);

create index food_material_food_item_user_idx
  on public.food_material (food_item_id, user_id);
create index food_material_user_id_idx
  on public.food_material (user_id);

create index exercise_session_daily_record_user_idx
  on public.exercise_session (daily_record_id, user_id);
create index exercise_session_user_id_idx
  on public.exercise_session (user_id);

create index exercise_item_exercise_session_user_idx
  on public.exercise_item (exercise_session_id, user_id);
create index exercise_item_user_id_idx
  on public.exercise_item (user_id);

create index set_item_exercise_item_user_idx
  on public.set_item (exercise_item_id, user_id);
create index set_item_user_id_idx
  on public.set_item (user_id);
