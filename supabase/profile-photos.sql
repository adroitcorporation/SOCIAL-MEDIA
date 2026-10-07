-- Run in the SQL editor of the SAME Supabase project used for Auth.
-- Safe to rerun; no objects or user data are deleted. Public reads are intentional.
-- Uploads go through /api/profile/photo using a backend-only service-role key.
-- Restrictive policies also override unrelated permissive legacy upload policies.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  4000000,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own profile photos" on storage.objects;
drop policy if exists "Profile photos require validated uploads" on storage.objects;
create policy "Profile photos require validated uploads" on storage.objects
as restrictive for insert to anon, authenticated
with check (bucket_id <> 'profile-photos');

drop policy if exists "Profile photos require server updates" on storage.objects;
create policy "Profile photos require server updates" on storage.objects
as restrictive for update to anon, authenticated
using (bucket_id <> 'profile-photos') with check (bucket_id <> 'profile-photos');

drop policy if exists "Profile photos require server deletes" on storage.objects;
create policy "Profile photos require server deletes" on storage.objects
as restrictive for delete to anon, authenticated
using (bucket_id <> 'profile-photos');

commit;
