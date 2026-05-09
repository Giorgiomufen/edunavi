-- EduNavi migration · 2026-05-09 · enne pitch'i demo'd
-- Kopeeri see Supabase SQL Editorisse ja vajuta Run.

-- 1) Per-klass eristamine (FR-32)
alter table public.responses
  add column if not exists class_name text;
create index if not exists responses_class_idx
  on public.responses (lesson_id, class_name);

-- 2) Kuvamisrežiim per ülesanne (FR-13 / FR-14)
alter table public.exercises
  add column if not exists display_mode text default 'full';

-- Kontroll-piiranguid lisame eraldi (et idempotentne oleks):
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'exercises_display_mode_check') then
    alter table public.exercises
      add constraint exercises_display_mode_check
      check (display_mode in ('full','theme','blind'));
  end if;
end $$;

-- 3) Vabatahtlikud anonüümsed kommentaarid (FR-22 / FR-27)
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  exercise_id  uuid references public.exercises(id) on delete cascade,
  session_id   text,
  class_name   text,
  text         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists comments_lesson_idx   on public.comments (lesson_id, created_at);
create index if not exists comments_exercise_idx on public.comments (exercise_id);

alter table public.comments enable row level security;
drop policy if exists comments_all on public.comments;
create policy comments_all on public.comments
  for all using (true) with check (true);
