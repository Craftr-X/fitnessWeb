-- 在 Supabase SQL Editor 执行一次（建公开读 bucket exercise-demos）
-- 若已存在同名 policy 且需重建：
--   drop policy if exists "exercise demos public read" on storage.objects;

insert into storage.buckets (id, name, public)
values ('exercise-demos', 'exercise-demos', true)
on conflict (id) do update set public = true;

create policy "exercise demos public read"
on storage.objects for select
to public
using (bucket_id = 'exercise-demos');