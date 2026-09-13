-- ============================================================
-- QuizPulse AI - Supabase Database Schema & Realtime Setup
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Quizzes Table
create table if not exists public.quizzes (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text default '',
  category text default 'General Trivia',
  difficulty text default 'medium',
  topic text default '',
  creator_id text default 'anonymous',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Questions Table
create table if not exists public.questions (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  question text not null,
  options jsonb not null, -- Array of strings e.g. ["Option A", "Option B", "Option C", "Option D"]
  correct_index int not null default 0,
  time_limit int not null default 15,
  points int not null default 1000,
  explanation text default '',
  ai_host_comment text default '',
  order_index int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Game Rooms Table
create table if not exists public.game_rooms (
  id uuid primary key default uuid_generate_v4(),
  room_code text unique not null,
  host_id text not null,
  quiz_id uuid references public.quizzes(id) on delete set null,
  quiz_data jsonb, -- Stores complete snapshot of quiz questions
  status text not null default 'LOBBY', -- 'LOBBY', 'STARTING', 'QUESTION', 'ANSWER_REVEAL', 'LEADERBOARD', 'GAME_OVER'
  current_question_index int not null default 0,
  question_started_at bigint, -- epoch millisecond timestamp
  settings jsonb default '{"timePerQuestion": 15, "speedBonus": true, "streakBonus": true, "showExplanations": true, "aiCommentaryEnabled": true}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Room Players Table
create table if not exists public.room_players (
  id uuid primary key default uuid_generate_v4(),
  room_code text not null,
  player_id text not null,
  nickname text not null,
  avatar text default '⚡',
  score int not null default 0,
  streak int not null default 0,
  last_answer jsonb,
  is_host boolean default false,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(room_code, player_id)
);

-- 5. Enable Row Level Security (RLS) & Public Policies for Game Rooms
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.game_rooms enable row level security;
alter table public.room_players enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Allow public read access on quizzes" on public.quizzes;
drop policy if exists "Allow public insert on quizzes" on public.quizzes;
drop policy if exists "Allow public read access on questions" on public.questions;
drop policy if exists "Allow public insert on questions" on public.questions;
drop policy if exists "Allow all on game_rooms" on public.game_rooms;
drop policy if exists "Allow all on room_players" on public.room_players;

-- Create Open Policies for frictionless party play
create policy "Allow public read access on quizzes" on public.quizzes for select using (true);
create policy "Allow public insert on quizzes" on public.quizzes for insert with check (true);
create policy "Allow public read access on questions" on public.questions for select using (true);
create policy "Allow public insert on questions" on public.questions for insert with check (true);
create policy "Allow all on game_rooms" on public.game_rooms for all using (true) with check (true);
create policy "Allow all on room_players" on public.room_players for all using (true) with check (true);

-- Enable Realtime for live updates on game_rooms and room_players
alter publication supabase_realtime add table public.game_rooms;
alter publication supabase_realtime add table public.room_players;
