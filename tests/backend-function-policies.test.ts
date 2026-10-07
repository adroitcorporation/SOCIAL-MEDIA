import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

it('removes inherited and explicit browser helper grants while preserving backend and unrelated functions', async () => {
  const pg = await PGlite.create();
  try {
    await pg.exec(`
      create role anon;
      create role authenticated;
      create function public.fc_key(value text) returns text language sql immutable as $$ select lower(value) $$;
      create function public.unrelated(value text) returns text language sql immutable as $$ select value $$;
      grant execute on function public.fc_key(text) to anon, authenticated;
    `);
    const policy = await readFile('supabase/backend-only-functions.sql', 'utf8');
    await pg.exec(policy);
    await pg.exec(policy);
    for (const role of ['anon', 'authenticated']) {
      await pg.exec(`set role ${role}`);
      await expect(pg.query("select public.fc_key('TEST')")).rejects.toMatchObject({
        code: '42501',
      });
      expect((await pg.query("select public.unrelated('safe') as result")).rows).toEqual([
        { result: 'safe' },
      ]);
      await pg.exec('reset role');
    }
    expect((await pg.query("select public.fc_key('TEST') as result")).rows).toEqual([
      { result: 'test' },
    ]);
  } finally {
    await pg.close();
  }
});
