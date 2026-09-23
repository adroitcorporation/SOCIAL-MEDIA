import { NextResponse } from 'next/server';
import { pageIdentity, pageSessionCookie } from '@/backend/auth/page-session';
import { requireThat } from '@/backend/utils/errors';
import { errorResponse } from '@/backend/http/error-response';

function validatePageSessionRequest(request: Request) {
  // This adapter also runs on the frontend-only deployment without APP_URL.
  // It accepts bearer authentication, never cookie authentication.
  const origin = request.headers.get('origin');
  requireThat(!origin || origin === new URL(request.url).origin, 403, 'Invalid request origin.');
  requireThat(request.headers.get('content-type')?.includes('application/json'), 415, 'Send JSON.');
}

export async function POST(request: Request) {
  try {
    validatePageSessionRequest(request);
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    await pageIdentity(token);
    const response = NextResponse.json({ ok: true });
    if (token)
      response.cookies.set(pageSessionCookie, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3600,
      });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    validatePageSessionRequest(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(pageSessionCookie);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
