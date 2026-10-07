import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

it('denies browser photo writes despite permissive legacy policies, preserving public reads and other buckets', async () => {
  const pg = await PGlite.create();
  try {
    await pg.exec(`
      create schema storage;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (name text primary key, bucket_id text);
      alter table storage.objects enable row level security;
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      grant usage on schema storage to anon, authenticated, service_role;
      grant all on storage.objects to anon, authenticated, service_role;
      create policy legacy on storage.objects for all to anon, authenticated using (true) with check (true);
    `);
    const policy = await readFile('supabase/profile-photos.sql', 'utf8');
    await pg.exec(policy);
    await pg.exec(policy); // Setup is repeatable without deleting existing objects.
    await pg.query("insert into storage.objects values ('owner/photo.png', 'profile-photos')");
    for (const role of ['anon', 'authenticated']) {
      await pg.exec(`set role ${role}`);
      await expect(
        pg.query("insert into storage.objects values ('owner/forged.png', 'profile-photos')"),
      ).rejects.toMatchObject({ code: '42501' });
      expect(
        (
          await pg.query(
            "update storage.objects set name='changed' where bucket_id='profile-photos' returning name",
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await pg.query(
            "delete from storage.objects where bucket_id='profile-photos' returning name",
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (await pg.query("select name from storage.objects where bucket_id='profile-photos'")).rows,
      ).toHaveLength(1);
      await pg.query(`insert into storage.objects values ('${role}/other.png', 'another-bucket')`);
      await expect(
        pg.query(
          `update storage.objects set bucket_id='profile-photos' where name='${role}/other.png'`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await pg.exec('reset role');
    }
    await pg.exec('set role service_role');
    await pg.query("insert into storage.objects values ('owner/validated.png', 'profile-photos')");
    await pg.exec('reset role');
    expect(
      (await pg.query("select name from storage.objects where bucket_id='profile-photos'")).rows,
    ).toHaveLength(2);
  } finally {
    await pg.close();
  }
});
