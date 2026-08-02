-- FitUp 用户数据表：一个用户一行，整文档（jsonb）存储。
-- 在 Supabase 控制台 SQL Editor 执行一次即可。

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 行级安全：每个用户只能读写自己的那一行，这是数据隔离的根本保证
alter table public.user_data enable row level security;

create policy "users manage own row" on public.user_data
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
