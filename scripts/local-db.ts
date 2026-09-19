import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { mkdir } from 'node:fs/promises';
async function main() {
  await mkdir('.local', { recursive: true });
  const db = await PGlite.create('.local/postgres');
  const server = new PGLiteSocketServer({ db, port: 54329, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  console.log(
    'Local development database listening on 127.0.0.1:54329. Run npm run demo in another terminal.',
  );
  const close = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
