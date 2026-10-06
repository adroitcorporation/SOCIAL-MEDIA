import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';

it('migrates partial approvals and preserves manual evidence while repairing unproven legacy flags', async () => {
  const pg = await PGlite.create();
  try {
    const directory = 'src/backend/database/prisma/migrations';
    const names = (await readdir(directory))
      .filter((name) => name !== 'migration_lock.toml')
      .sort();
    for (const name of names.filter((name) => name < '202610070001'))
      await pg.exec(await readFile(`${directory}/${name}/migration.sql`, 'utf8'));
    await pg.exec(`
      INSERT INTO "College" (id, name, "shortName", city, state, "verifiedDomains")
        VALUES ('__approved_email_domains__', 'Domains', 'Domains', 'Global', 'Global', ARRAY['@MNIT.AC.IN', 'mnit.ac.in', 'bad domain']);
      INSERT INTO "User" (id, name, "updatedAt", "emailVerified", "collegeVerified")
        VALUES ('manual', 'Manual', now(), true, true), ('polluted', 'Polluted', now(), true, true), ('pending', 'Pending', now(), true, false);
      INSERT INTO "CollegeVerificationRequest" (id, "userId", method, status, "updatedAt")
        VALUES ('approved', 'manual', 'COLLEGE_ID', 'APPROVED', now()), ('rejected', 'polluted', 'COLLEGE_ID', 'REJECTED', now()), ('pending-id', 'pending', 'COLLEGE_ID', 'PENDING', now());
    `);
    await pg.exec(
      await readFile(`${directory}/202610070001_approved_college_domains/migration.sql`, 'utf8'),
    );
    expect(
      (
        await pg.query<{ domain: string }>(
          'SELECT domain FROM "ApprovedCollegeDomain" ORDER BY domain',
        )
      ).rows.map((row) => row.domain),
    ).toEqual(['lnmiit.ac.in', 'mnit.ac.in']);
    expect(
      (
        await pg.query(
          'SELECT id, "collegeVerified", "collegeVerificationSource" FROM "User" ORDER BY id',
        )
      ).rows,
    ).toEqual([
      { id: 'manual', collegeVerified: true, collegeVerificationSource: 'COLLEGE_ID' },
      { id: 'pending', collegeVerified: false, collegeVerificationSource: null },
      { id: 'polluted', collegeVerified: false, collegeVerificationSource: null },
    ]);
    expect(
      (
        await pg.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM "CollegeVerificationRequest"',
        )
      ).rows[0].count,
    ).toBe(3);
    await expect(
      pg.exec(`INSERT INTO "ApprovedCollegeDomain" (domain) VALUES ('mnit.ac.in')`),
    ).rejects.toThrow();
    await expect(
      pg.exec(`INSERT INTO "ApprovedCollegeDomain" (domain) VALUES ('MNIT.AC.IN')`),
    ).rejects.toThrow();
  } finally {
    await pg.close();
  }
});
