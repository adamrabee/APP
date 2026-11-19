-- me app — initial schema (BRD §4, §7)
-- Every table carries user_id (defaults to the signed-in user) and is locked by RLS to its owner.

create extension if not exists pgcrypto;

-- ───────────── helpers ─────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────── profile & settings (X-03, X-06, R weights) ─────────────
create table public.profiles (
  user_id        uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name   text,
  language       text not null default 'ar',
  currency       text not null default 'SAR',
  city           text,
  latitude       double precision,
  longitude      double precision,
  prayer_method  text not null default 'umm_al_qura',
  theme          text not null default 'light' check (theme in ('light','dark')),
  calorie_goal   int,
  protein_goal   int,
  quran_daily_pages numeric,
  university_date date,
  score_weights  jsonb not null default '{"tasks":1,"habits":1,"prayers":1,"study":1,"routine":1}',
  hidden_sections text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.notification_settings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  type        text not null,
  enabled     boolean not null default true,
  time        time,
  quiet_from  time,
  quiet_to    time,
  daily_cap   int,
  created_at  timestamptz not null default now(),
  unique (user_id, type)
);

-- ───────────── tasks & habits (T-01…T-07) ─────────────
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  parent_id   uuid references public.tasks on delete cascade,      -- subtasks (T-03)
  title       text not null,
  category    text not null default 'personal' check (category in ('work','study','health','personal')),
  due_date    date,
  due_time    time,
  repeat_rule jsonb,            -- {"freq":"daily"|"weekly"|"days","days":[0..6]}
  notes       text,
  remind_at   time,
  sort_order  int not null default 0,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  name           text not null,
  icon           text,
  "group"        text not null default 'general' check ("group" in ('general','me')),
  target_per_day int not null default 1,
  period         text not null default 'daily' check (period in ('daily','weekly')),
  schedule       jsonb,         -- flexible repeat, e.g. {"every_days":21} (M-04)
  remind_at      time,
  archived       boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id   uuid not null references public.habits on delete cascade,
  date       date not null,
  count      int not null default 1,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

-- ───────────── worship (W-01…W-05, Q-01…Q-09) ─────────────
create table public.prayer_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null,
  prayer     text not null check (prayer in ('fajr','dhuhr','asr','maghrib','isha')),
  status     text not null check (status in ('on_time','late','missed')),
  created_at timestamptz not null default now(),
  unique (user_id, date, prayer)
);

create table public.quran_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  date          date not null,
  pages_read    numeric not null default 0,
  last_position text,
  created_at    timestamptz not null default now(),
  unique (user_id, date)
);

create table public.quran_tables (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quran_columns (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  table_id   uuid not null references public.quran_tables on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.quran_rows (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  table_id   uuid not null references public.quran_tables on delete cascade,
  name       text not null,
  date       date,
  note       text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.quran_cells (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  table_id   uuid not null references public.quran_tables on delete cascade,
  row_id     uuid not null references public.quran_rows on delete cascade,
  column_id  uuid not null references public.quran_columns on delete cascade,
  kind       text not null default 'free' check (kind in ('page','juz','surah','ayah','free')),
  text       text,
  status     text not null default 'none' check (status in ('none','doing','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (row_id, column_id)
);

-- ───────────── study (S-01…S-12) ─────────────
create table public.subjects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  color        text not null default '#5E7F6A',
  weekly_hours numeric not null default 0,
  exam_date    date,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.subject_units (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id   uuid not null references public.subjects on delete cascade,
  title        text not null,
  sort_order   int not null default 0,
  status       text not null default 'not_started' check (status in ('not_started','in_progress','done','needs_review')),
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create table public.study_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  unit_id    uuid references public.subject_units on delete set null,
  started_at timestamptz not null default now(),
  minutes    int not null,
  created_at timestamptz not null default now()
);

create table public.study_slots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  unit_id    uuid not null references public.subject_units on delete cascade,
  due_date   date not null,
  step       smallint not null check (step in (1,3,7,30)),
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create table public.flashcards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id    uuid not null references public.subjects on delete cascade,
  front         text not null,
  back          text not null,
  ease          numeric not null default 2.5,
  interval_days int not null default 0,
  due_date      date not null default current_date,
  created_at    timestamptz not null default now()
);

create table public.exam_results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  date       date not null,
  score      numeric not null,
  max_score  numeric not null,
  is_mock    boolean not null default true,
  note       text,
  created_at timestamptz not null default now()
);

create table public.mistakes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  text       text not null,
  times_seen int not null default 0,
  created_at timestamptz not null default now()
);

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid references public.subjects on delete cascade,   -- null = general quick note (H-04)
  title      text,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  title        text not null,
  target_date  date,
  progress     numeric not null default 0,
  is_countdown boolean not null default false,
  created_at   timestamptz not null default now()
);

-- study schedule generator (SP-01…SP-09)
create table public.study_assignments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references public.subjects on delete cascade,
  title      text not null,
  due_date   date,
  est_hours  numeric not null default 1,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.study_schedules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  start_date    date not null,
  days          int not null,
  hours_per_day numeric not null,
  start_time    time not null,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table public.study_schedule_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  schedule_id   uuid not null references public.study_schedules on delete cascade,
  day           date not null,
  subject_id    uuid references public.subjects on delete cascade,
  assignment_id uuid references public.study_assignments on delete cascade,
  title         text not null,
  kind          text not null check (kind in ('assignment','review','custom')),
  minutes       int not null,
  status        text not null default 'pending' check (status in ('pending','completed')),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ───────────── me / skincare / journal (M-01…M-11) ─────────────
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  step         text,
  opened_at    date,
  pao_months   int,
  running_low  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.skincare_steps (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  routine      text not null check (routine in ('AM','PM')),
  name         text not null,
  sort_order   int not null default 0,
  product_id   uuid references public.products on delete set null,
  days_of_week smallint[],      -- null = every day; set = weekly treatment (M-02)
  created_at   timestamptz not null default now()
);

create table public.routine_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  routine         text not null check (routine in ('AM','PM')),
  date            date not null,
  completed_steps uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  unique (user_id, routine, date)
);

create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null,
  mood       text check (mood in ('happy','calm','tired','upset')),
  prompt     text,
  body       text not null,     -- encrypted on device before upload
  created_at timestamptz not null default now()
);

-- ───────────── gym, food, money (v2: G-*, F-*) ─────────────
create table public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null,
  name       text,
  created_at timestamptz not null default now()
);

create table public.workout_sets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  exercise   text not null,
  set_no     int not null default 1,
  reps       int not null,
  weight     numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.body_metrics (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null,
  weight     numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null,
  name       text not null,
  calories   int not null default 0,
  protein    numeric not null default 0,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null default current_date,
  type       text not null check (type in ('expense','income')),
  amount_sar numeric(12,2) not null check (amount_sar >= 0),
  category   text,
  source     text check (source in ('affiliate','teaching','other')),
  note       text,
  created_at timestamptz not null default now()
);

create table public.budgets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  month      date not null,     -- first day of month
  category   text not null,
  limit_sar  numeric(12,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, month, category)
);

-- ───────────── weekly review (R-01…R-07) ─────────────
create table public.weekly_reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  week_start     date not null,
  score          numeric not null,
  section_scores jsonb not null default '{}',
  best_day       date,
  created_at     timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ───────────── skill tree (K-01…K-21) ─────────────
create table public.skill_nodes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  parent_id   uuid references public.skill_nodes on delete cascade,  -- null = root "me"
  name        text not null,
  description text,
  icon        text,
  status      text not null default 'auto' check (status in ('auto','none','learning','progress','done')),
  progress    numeric not null default 0 check (progress between 0 and 100),
  aggregate   boolean not null default false,
  notes       text,
  goal        text,
  target_date date,
  collapsed   boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.skill_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  node_id   uuid not null references public.skill_nodes on delete cascade,
  hours     numeric not null,
  note      text,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.skill_milestones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  node_id    uuid not null references public.skill_nodes on delete cascade,
  text       text not null,
  done       boolean not null default false,
  done_at    timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ───────────── work (WK-01…WK-13) ─────────────
create table public.work_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  description text,
  notes       text,
  deadline    date,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.work_tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  title           text not null,
  description     text,
  priority        text not null default 'low' check (priority in ('high','med','low')),
  due_date        date,
  done            boolean not null default false,
  done_at         timestamptz,
  project_id      uuid references public.work_projects on delete set null,  -- WK-04: detach, don't delete
  repeat          text not null default 'none' check (repeat in ('none','daily','weekly','monthly')),
  tracked_seconds int not null default 0,
  created_at      timestamptz not null default now()
);

create table public.work_inbox (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  text       text not null,
  kind       text not null default 'task' check (kind in ('task','idea','link','note')),
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.work_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  title      text not null default '',
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_state (
  user_id          uuid primary key default auth.uid() references auth.users on delete cascade,
  focus_task_id    uuid references public.work_tasks on delete set null,
  timer_task_id    uuid references public.work_tasks on delete set null,
  timer_started_at timestamptz,
  created_at       timestamptz not null default now()
);

create table public.work_activity (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  text       text not null,
  kind       text not null,
  created_at timestamptz not null default now()
);

-- ───────────── RLS, owner policy, indexes, updated_at triggers ─────────────
do $$
declare
  t text;
  fk record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    -- index user_id unless it is already the primary key
    if not exists (
      select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
      where i.indrelid = format('public.%I', t)::regclass and i.indisprimary and a.attname = 'user_id'
    ) then
      execute format('create index on public.%I (user_id)', t);
    end if;
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'updated_at') then
      execute format('create trigger set_updated_at before update on public.%I
                      for each row execute function public.set_updated_at()', t);
    end if;
  end loop;

  -- index every single-column foreign key that isn't user_id
  for fk in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and array_length(c.conkey, 1) = 1 and a.attname <> 'user_id'
  loop
    execute format('create index on %s (%I)', fk.tbl, fk.col);
  end loop;
end $$;

-- handy query indexes
create index on public.tasks (user_id, due_date) where done_at is null;
create index on public.habit_logs (user_id, date);
create index on public.prayer_logs (user_id, date);
create index on public.reviews (user_id, due_date) where done_at is null;
create index on public.flashcards (user_id, due_date);
create index on public.transactions (user_id, date);
create index on public.work_tasks (user_id, due_date) where done = false;

-- profile row on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.work_state (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
