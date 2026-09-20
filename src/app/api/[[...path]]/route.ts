import { handleApiRequest } from '@/backend/http/api-handler';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path?: string[] }> };
async function handler(request: Request, context: Context) {
  return handleApiRequest(request, (await context.params).path ?? []);
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
