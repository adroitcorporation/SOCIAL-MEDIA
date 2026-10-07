import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { requireActiveActor } from './permissions';
import { decodeVerificationImage } from './verification-image';
import { requireThat } from '@/backend/utils/errors';
import { safeUrl } from '@/shared/contracts/schemas';

/** Only decoded images from active application accounts reach public storage. */
export async function uploadProfilePhoto(actor: string, bytes: Uint8Array, mime: string) {
  await requireActiveActor(actor);
  const image = await decodeVerificationImage(
    `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`,
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  requireThat(url && key, 503, 'Profile photo uploads are not configured. Contact support.');
  const storage = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from('profile-photos');
  const extension = image.documentMime === 'image/jpeg' ? 'jpg' : image.documentMime.slice(6);
  const path = `${actor}/${randomUUID()}.${extension}`;
  await requireActiveActor(actor);
  const { error } = await storage.upload(path, image.documentBytes, {
    contentType: image.documentMime,
    upsert: false,
    cacheControl: '31536000',
  });
  requireThat(!error, 502, 'Unable to upload this photo. Please try again.');
  try {
    await requireActiveActor(actor);
    return { url: safeUrl.parse(storage.getPublicUrl(path).data.publicUrl) };
  } catch (error) {
    await storage.remove([path]);
    throw error;
  }
}
