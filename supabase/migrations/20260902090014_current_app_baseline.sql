-- Baseline for a fresh Supabase database.
--
-- DO NOT run this migration against the existing production database. The
-- production schema already contains these objects and has no migration
-- history yet. Connecting that database to migration management is a separate
-- task.
--
-- This migration contains schema only. It intentionally contains no Auth
-- users, application rows, seed data, project identifiers, or secrets.

create table public.app_user (
  id uuid not null,
  display_name text,
  created_at timestamp with time zone not null default now(),
  constraint app_user_pkey primary key (id),
  constraint app_user_id_fkey
    foreign key (id) references auth.users (id) on delete cascade
);

create table public.daily_record_store (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  record_date date not null,
  record_json jsonb not null,
  saved_at timestamp with time zone not null default now(),
  constraint daily_record_store_pkey primary key (id),
  constraint daily_record_store_user_id_fkey
    foreign key (user_id) references public.app_user (id) on delete cascade,
  constraint daily_record_store_user_date_key unique (user_id, record_date)
);

create table public.daily_record (
  id uuid not null,
  user_id uuid not null,
  record_date date not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint daily_record_pkey primary key (id),
  constraint daily_record_user_id_fkey
    foreign key (user_id) references public.app_user (id) on delete cascade,
  constraint daily_record_user_date_key unique (user_id, record_date)
);

create table public.weight_record (
  id uuid not null,
  daily_record_id uuid not null,
  measurement_time_slot character varying not null,
  measurement_order integer not null,
  measured_at timestamp with time zone,
  weight numeric(5,2) not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint weight_record_pkey primary key (id),
  constraint weight_record_daily_record_id_fkey
    foreign key (daily_record_id) references public.daily_record (id) on delete cascade
);

create table public.wellness_record (
  daily_record_id uuid not null,
  sleep_duration_category character varying,
  sleep_quality character varying,
  sleep_duration_minutes integer,
  sleep_source character varying,
  water_intake character varying,
  physical_condition character varying,
  mood character varying,
  hunger_level character varying,
  bowel_movement character varying,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint wellness_record_pkey primary key (daily_record_id),
  constraint wellness_record_daily_record_id_fkey
    foreign key (daily_record_id) references public.daily_record (id) on delete cascade
);

create table public.meal_record (
  id uuid not null,
  daily_record_id uuid not null,
  recording_category character varying not null,
  meal_order integer not null,
  eaten_at timestamp with time zone,
  meal_memo text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint meal_record_pkey primary key (id),
  constraint meal_record_daily_record_id_fkey
    foreign key (daily_record_id) references public.daily_record (id) on delete cascade
);

create table public.meal_attachment (
  id uuid not null,
  meal_record_id uuid not null,
  storage_path text not null,
  attachment_order integer,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint meal_attachment_pkey primary key (id),
  constraint meal_attachment_meal_record_id_fkey
    foreign key (meal_record_id) references public.meal_record (id) on delete cascade
);

create table public.food_item (
  id uuid not null,
  meal_record_id uuid not null,
  food_item_order integer not null,
  food_name text not null,
  food_amount numeric(6,2) not null,
  food_amount_unit text not null,
  food_calorie numeric(6,2) not null,
  food_protein numeric(5,2),
  food_fat numeric(5,2),
  food_carbohydrates numeric(5,2),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint food_item_pkey primary key (id),
  constraint food_item_meal_record_id_fkey
    foreign key (meal_record_id) references public.meal_record (id) on delete cascade
);

create table public.food_material (
  id uuid not null,
  food_item_id uuid not null,
  food_material_order integer not null,
  food_material_name text not null,
  food_material_amount numeric(6,2) not null,
  food_material_amount_unit text not null,
  food_material_calorie numeric(6,2) not null,
  food_material_protein numeric(5,2),
  food_material_fat numeric(5,2),
  food_material_carbohydrates numeric(5,2),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint food_material_pkey primary key (id),
  constraint food_material_food_item_id_fkey
    foreign key (food_item_id) references public.food_item (id) on delete cascade
);

create table public.exercise_session (
  id uuid not null,
  daily_record_id uuid not null,
  session_order integer not null,
  session_label text,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  memo text,
  calories_burned integer,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint exercise_session_pkey primary key (id),
  constraint exercise_session_daily_record_id_fkey
    foreign key (daily_record_id) references public.daily_record (id) on delete cascade,
  constraint exercise_session_daily_order_key unique (daily_record_id, session_order)
);

create table public.exercise_item (
  id uuid not null,
  exercise_session_id uuid not null,
  item_order integer not null,
  body_part text,
  exercise_name text not null,
  exercise_type character varying not null,
  recording_style character varying not null,
  free_text text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint exercise_item_pkey primary key (id),
  constraint exercise_item_exercise_session_id_fkey
    foreign key (exercise_session_id) references public.exercise_session (id) on delete cascade,
  constraint exercise_item_session_order_key unique (exercise_session_id, item_order)
);

create table public.set_item (
  id uuid not null,
  exercise_item_id uuid not null,
  set_order integer not null,
  load_value numeric(6,2),
  load_unit character varying,
  reps integer,
  has_sides boolean not null,
  reps_left integer,
  reps_right integer,
  duration_seconds integer,
  memo text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint set_item_pkey primary key (id),
  constraint set_item_exercise_item_id_fkey
    foreign key (exercise_item_id) references public.exercise_item (id) on delete cascade,
  constraint set_item_exercise_order_key unique (exercise_item_id, set_order)
);

alter table public.app_user enable row level security;
alter table public.daily_record_store enable row level security;
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

create policy "Users can manage their own profile"
on public.app_user
as permissive
for all
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can manage their own daily records"
on public.daily_record_store
as permissive
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Prevent local/cloud default privileges from exposing dormant normalized
-- tables. Policies and application grants will be added when their
-- persistence path and ownership chain are implemented.
revoke all on table
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
from anon, authenticated;

revoke all on table public.app_user, public.daily_record_store
from anon, authenticated;

grant select, insert, update, delete
on table public.app_user, public.daily_record_store
to authenticated;
