import 'server-only';
import { AppError } from './errors';

// Server-side operational switch. Leave unset during normal operation.
export const migrationMaintenance = () => process.env.MIGRATION_MAINTENANCE === 'true';

export function requireApplicationOpen() {
  if (migrationMaintenance())
    throw new AppError(503, 'Founder Circle is temporarily unavailable for maintenance.');
}

export function maintenanceResponse() {
  return Response.json(
    {
      error: 'Founder Circle is temporarily unavailable for maintenance.',
      code: 'MIGRATION_MAINTENANCE',
    },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } },
  );
}
