-- Apply only to the selected destination project. No historical objects are copied.
-- Public profile photos; private college IDs and event attachments.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos', 'profile-photos', true, 4000000, array['image/jpeg','image/png','image/webp']),
  ('college-ids', 'college-ids', false, 4000000, array['image/jpeg','image/png','image/webp']),
  ('event-attachments', 'event-attachments', false, 8000000, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Founder Circle validated file inserts" on storage.objects;
create policy "Founder Circle validated file inserts" on storage.objects as restrictive
for insert to anon, authenticated with check (bucket_id not in ('profile-photos','college-ids','event-attachments'));
drop policy if exists "Founder Circle validated file updates" on storage.objects;
create policy "Founder Circle validated file updates" on storage.objects as restrictive
for update to anon, authenticated using (bucket_id not in ('profile-photos','college-ids','event-attachments'))
with check (bucket_id not in ('profile-photos','college-ids','event-attachments'));
drop policy if exists "Founder Circle validated file deletes" on storage.objects;
create policy "Founder Circle validated file deletes" on storage.objects as restrictive
for delete to anon, authenticated using (bucket_id not in ('profile-photos','college-ids','event-attachments'));
drop policy if exists "Founder Circle private file reads" on storage.objects;
create policy "Founder Circle private file reads" on storage.objects as restrictive
for select to anon, authenticated using (bucket_id not in ('college-ids','event-attachments'));
commit;
