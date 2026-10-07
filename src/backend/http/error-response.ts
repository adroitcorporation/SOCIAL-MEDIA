import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '@/backend/utils/errors';
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      {
        error: error.message,
        ...(error.details ? { message: error.message, ...error.details } : {}),
      },
      { status: error.status },
    );
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
  // Exception text can include ORM arguments, tokens or private content. Log only safe categories.
  console.error(
    JSON.stringify({
      event: 'api_request_failed',
      kind: error instanceof Prisma.PrismaClientKnownRequestError ? 'database' : 'unexpected',
      ...(error instanceof Prisma.PrismaClientKnownRequestError && /^P[0-9]{4}$/.test(error.code)
        ? { code: error.code }
        : {}),
    }),
  );
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
