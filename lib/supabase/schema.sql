-- ==============================================================================
-- QuizPulse AI - Supabase PostgreSQL Schema & Realtime Setup
-- ==============================================================================

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Quizzes Table (Creator Quiz Templates)
create table if not exists public.quizzes (
  id text primary key,
  title text not null,
  description text,
  category text,
  difficulty text default 'medium',
  topic text not null,
  questions jsonb not null default '[]'::jsonb,
  creator_id text,
  creator_name text,
  created_at timestamptz default now()
);

-- 3. Quiz Rooms Table (Live & Scheduled Multiplayer Game Rooms)
create table if not exists public.quiz_rooms (
  id text primary key,
  room_code varchar(10) not null unique,
  host_id text not null,
  creator_id text,
  creator_name text,
  quiz jsonb not null,
  status text not null default 'LOBBY',
  current_question_index integer default 0,
  question_started_at bigint,
  scheduled_start_at bigint,
  is_public boolean default true,
  max_candidates integer,
  settings jsonb not null default '{}'::jsonb,
  players jsonb not null default '{}'::jsonb,
  last_revealed_answer jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Checkers 1v1 Arena Rooms Table
create table if not exists public.checkers_rooms (
  id text primary key,
  room_code varchar(12) not null unique,
  host_id text not null,
  host_name text default 'Host',
  host_avatar text default 'crown',
  guest_id text,
  guest_name text,
  guest_avatar text default 'zap',
  status text not null default 'LOBBY', -- 'LOBBY', 'STARTING', 'PLAYING', 'GAME_OVER'
  countdown_started_at bigint,
  scheduled_start_at bigint,
  turn_timer_sec integer default 30,
  is_trivia_clash boolean default false,
  board_state jsonb,
  current_turn text default 'red',
  winner text,
  move_history jsonb default '[]'::jsonb,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Fast Lookups Indexes
create index if not exists idx_quiz_rooms_room_code on public.quiz_rooms(room_code);
create index if not exists idx_quiz_rooms_status on public.quiz_rooms(status);
create index if not exists idx_quiz_rooms_creator_id on public.quiz_rooms(creator_id);
create index if not exists idx_quizzes_creator_id on public.quizzes(creator_id);
create index if not exists idx_checkers_rooms_code on public.checkers_rooms(room_code);
create index if not exists idx_checkers_rooms_status on public.checkers_rooms(status);

-- 6. Row Level Security (RLS)
alter table public.quizzes enable row level security;
alter table public.quiz_rooms enable row level security;
alter table public.checkers_rooms enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Public and authenticated users can read quizzes" on public.quizzes;
drop policy if exists "Public and authenticated users can insert/update quizzes" on public.quizzes;
drop policy if exists "Public and authenticated users can read rooms" on public.quiz_rooms;
drop policy if exists "Public and authenticated users can insert/update rooms" on public.quiz_rooms;
drop policy if exists "Allow all operations on checkers_rooms" on public.checkers_rooms;

-- Allow read & write for multiplayer rooms
create policy "Public and authenticated users can read quizzes"
  on public.quizzes for select
  using (true);

create policy "Public and authenticated users can insert/update quizzes"
  on public.quizzes for all
  using (true);

create policy "Public and authenticated users can read rooms"
  on public.quiz_rooms for select
  using (true);

create policy "Public and authenticated users can insert/update rooms"
  on public.quiz_rooms for all
  using (true);

create policy "Allow all operations on checkers_rooms"
  on public.checkers_rooms for all
  using (true)
  with check (true);

-- 7. Realtime Publication
alter publication supabase_realtime add table public.quiz_rooms;
alter publication supabase_realtime add table public.checkers_rooms;
