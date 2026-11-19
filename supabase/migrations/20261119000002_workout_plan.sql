-- G-01: weekly workout plan (days and exercises)
create table public.workout_plan (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  exercise   text not null,
  sets       int not null default 3,
  reps       int not null default 10,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.workout_plan enable row level security;
create policy "owner_all" on public.workout_plan for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index on public.workout_plan (user_id);
