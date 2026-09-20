import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '@/backend/utils/errors';
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json(
      { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2002', 'P2003', 'P2025', 'P2034'].includes(error.code)
  )
    return Response.json(
      { error: 'This item changed or is unavailable. Refresh and try again.' },
      { status: 409 },
    );
  console.error('API request failed', error instanceof Error ? error.message : 'Unknown error');
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
