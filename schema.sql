-- EduNavi schema — paste this into Supabase SQL Editor and click Run.
-- Idempotent: safe to run multiple times.

create extension if not exists "pgcrypto";

-- LESSONS — one row per teaching session
create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid references auth.users(id) on delete set null,
  room_code   text not null,
  topic       text,
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index if not exists lessons_room_code_idx on public.lessons (room_code);
create index if not exists lessons_teacher_idx   on public.lessons (teacher_id, created_at desc);

-- EXERCISES — each question posted within a lesson
create table if not exists public.exercises (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  text        text not null,
  posted_at   timestamptz not null default now()
);
create index if not exists exercises_lesson_idx on public.exercises (lesson_id, posted_at);

-- RESPONSES — anonymous student responses
create table if not exists public.responses (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  session_id   text,
  answer       text not null check (answer in ('yes','no','unsure')),
  created_at   timestamptz not null default now()
);
create index if not exists responses_exercise_idx on public.responses (exercise_id);
create index if not exists responses_lesson_idx   on public.responses (lesson_id, created_at);

-- PRESENCE_EVENTS — student joins / leaves
create table if not exists public.presence_events (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  session_id  text not null,
  action      text not null check (action in ('join','leave')),
  created_at  timestamptz not null default now()
);
create index if not exists presence_lesson_idx on public.presence_events (lesson_id, created_at);

-- ===== RLS =====
alter table public.lessons         enable row level security;
alter table public.exercises       enable row level security;
alter table public.responses       enable row level security;
alter table public.presence_events enable row level security;

-- LESSONS: anyone can do CRUD in v1 (anonymous teacher).
-- When auth lands in Phase 2, tighten to `auth.uid() = teacher_id`.
drop policy if exists lessons_insert_any on public.lessons;
drop policy if exists lessons_select_any on public.lessons;
drop policy if exists lessons_update_any on public.lessons;
drop policy if exists lessons_all       on public.lessons;
create policy lessons_all on public.lessons
  for all using (true) with check (true);

-- EXERCISES: anyone can insert / select (will scope to lesson owner in Phase 2)
drop policy if exists exercises_all on public.exercises;
create policy exercises_all on public.exercises
  for all using (true) with check (true);

-- RESPONSES: anyone can insert (anonymous students). Selects open in Phase 1.
drop policy if exists responses_all on public.responses;
create policy responses_all on public.responses
  for all using (true) with check (true);

-- PRESENCE_EVENTS: anyone can insert (anonymous students)
drop policy if exists presence_all on public.presence_events;
create policy presence_all on public.presence_events
  for all using (true) with check (true);
