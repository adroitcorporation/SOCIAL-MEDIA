/** Restore pg_restore's data section into a local PGlite instance only.
 * @param {import('@electric-sql/pglite').PGlite} database @param {string} sql
 */
export async function restoreCopySection(database, sql) {
  const pattern = /^COPY (?:public|auth)\.(?:"[^"]+"|[a-z0-9_]+) \([^\n]*\) FROM stdin;\n/gm;
  const terminator = /^\\\.\n/gm;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(sql))) {
    await database.exec(sql.slice(cursor, match.index));
    terminator.lastIndex = pattern.lastIndex;
    const end = terminator.exec(sql);
    if (!end) throw new Error('Incomplete archive COPY block.');
    const data = sql.slice(pattern.lastIndex, end.index);
    await database.exec(match[0].trim().replace('FROM stdin;', "FROM '/dev/blob';"), {
      blob: new Blob([data]),
    });
    cursor = end.index + end[0].length;
    pattern.lastIndex = cursor;
  }
  await database.exec(sql.slice(cursor));
}
