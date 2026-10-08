import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { restoreCopySection } from '../scripts/lib/restore-copy.mjs';

it('preserves populated COPY blocks after empty ones and PostgreSQL text escapes', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(
      'CREATE TABLE empty_test (value text); CREATE TABLE populated_test (value text);',
    );
    await restoreCopySection(
      db,
      'COPY public.empty_test (value) FROM stdin;\n\\.\n\nCOPY public.populated_test (value) FROM stdin;\nhello\\nworld\n\\N\n\\\\.\n\\.\n',
    );
    expect((await db.query('SELECT * FROM empty_test')).rows).toEqual([]);
    expect((await db.query('SELECT * FROM populated_test')).rows).toEqual([
      { value: 'hello\nworld' },
      { value: null },
      { value: '\\.' },
    ]);
    await expect(
      restoreCopySection(db, 'COPY public.empty_test (value) FROM stdin;\nincomplete\n'),
    ).rejects.toThrow('Incomplete');
  } finally {
    await db.close();
  }
});
