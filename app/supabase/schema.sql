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

-- ====================================================================
-- 身材照片存储（模块②）
-- 私有 bucket：图片二进制存这里，元数据存 user_data.photos（jsonb）。
-- 对象 key 形如 `${userId}/${id}.jpg`，用 storage.foldername(name)[1] 取 owner 做隔离。
-- ====================================================================

insert into storage.buckets (id, name, public) values ('body_photos', 'body_photos', false)
on conflict (id) do nothing;

-- 仅允许访问自己路径下的对象：select / insert / delete 三类策略
create policy "users read own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'body_photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users insert own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'body_photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'body_photos' and (storage.foldername(name))[1] = auth.uid()::text);

