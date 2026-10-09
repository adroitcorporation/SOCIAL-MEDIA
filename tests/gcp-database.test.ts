import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
it('initializes every existing migration without users and grants runtime DML without schema ownership', async () => {
  const pg = await PGlite.create();
  try {
    const directory = 'src/backend/database/prisma/migrations';
    for (const entry of (await readdir(directory, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name)))
      await pg.exec(await readFile(directory + '/' + entry.name + '/migration.sql', 'utf8'));
    expect((await pg.query('SELECT count(*)::int AS count FROM "User"')).rows).toEqual([
      { count: 0 },
    ]);
    await pg.exec(
      'CREATE ROLE cloudsqlsuperuser; CREATE ROLE cynk_runtime; CREATE TABLE "_prisma_migrations" (id text);',
    );
    const sql = await readFile('deployment/gcp/database-access.sql', 'utf8');
    // PGlite has one database named postgres. Adapt ONLY the database-name guard in this isolated fixture.
    await pg.exec(sql.replace("('cynk_staging','cynk_production')", "('postgres')"));
    await pg.exec('SET ROLE cynk_runtime');
    await pg.exec(
      `INSERT INTO "User" (id,name,"updatedAt") VALUES ('synthetic-google-uid','Test',CURRENT_TIMESTAMP)`,
    );
    expect((await pg.query('SELECT id FROM "User"')).rows).toEqual([
      { id: 'synthetic-google-uid' },
    ]);
    await expect(pg.exec('CREATE TABLE public.forbidden(id text)')).rejects.toThrow();
    await expect(pg.exec('SELECT * FROM "_prisma_migrations"')).rejects.toThrow();
    await expect(pg.exec('TRUNCATE "User" CASCADE')).rejects.toThrow();
    await pg.exec('RESET ROLE');
    expect(
      (
        await pg.query(
          `SELECT rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname='cynk_runtime'`,
        )
      ).rows,
    ).toEqual([{ rolcreatedb: false, rolcreaterole: false, rolbypassrls: false }]);
  } finally {
    await pg.close();
  }
}, 60000);
