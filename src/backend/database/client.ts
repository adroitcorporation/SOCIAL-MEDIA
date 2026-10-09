import 'server-only';
import { PrismaClient } from '@prisma/client';
import { validateGcpEnvironment } from '@/shared/config/gcp-environment.mjs';
import { matchesProjectUrl, matchesProjectDatabase } from '@/shared/config/supabase-project.mjs';
if (process.env.AUTH_PROVIDER === 'identity-platform') validateGcpEnvironment(process.env);
const expected = process.env.SUPABASE_EXPECTED_PROJECT_REF;
if (
  expected &&
  (!matchesProjectDatabase(process.env.DATABASE_URL, expected) ||
    !matchesProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, expected))
) {
  throw new Error('Database/Auth project mismatch. Refusing application database access.');
}
const globalDb = globalThis as unknown as { db?: PrismaClient };
export const db = globalDb.db ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.db = db;
