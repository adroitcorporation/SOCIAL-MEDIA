// Offline preparation only: no database/client dependency and no write executor.
const sourceOrigin = 'https://rznbuzkgzsryadokvcfh.supabase.co';
const destinationOrigin = 'https://lxofcmzgzbgqvlmwizgm.supabase.co';
const prefix = '/storage/v1/object/public/profile-photos/';
export type VerifiedPhoto = {
  bucket: string;
  path: string;
  sha256: string;
  source_destination_sha256_match: boolean;
  public_head_status: number;
};
export function planPhotoUrls(
  profiles: { id: string; photo: string }[],
  verified: VerifiedPhoto[],
) {
  const paths = new Set<string>();
  for (const object of verified) {
    if (
      object.bucket !== 'profile-photos' ||
      !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(object.path) ||
      object.path.includes('..') ||
      !/^[a-f0-9]{64}$/.test(object.sha256) ||
      !object.source_destination_sha256_match ||
      object.public_head_status !== 200 ||
      paths.has(object.path)
    )
      throw new Error('Invalid or duplicate verified public-photo evidence');
    paths.add(object.path);
  }
  const seen = new Set<string>();
  const changes: { id: string; expectedPhoto: string; replacementPhoto: string; sha256: string }[] =
    [];
  const unresolved: string[] = [];
  for (const profile of profiles) {
    if (!profile.id || seen.has(profile.id)) throw new Error('Invalid or duplicate profile ID');
    seen.add(profile.id);
    if (!profile.photo) continue;
    let url: URL;
    try {
      url = new URL(profile.photo);
    } catch {
      continue;
    }
    if (url.origin !== sourceOrigin) continue;
    const path = url.pathname.slice(prefix.length);
    // Exact canonical URL prevents parser-normalized traversal, credentials and encoded separators.
    if (
      !url.pathname.startsWith(prefix) ||
      profile.photo !== sourceOrigin + prefix + path ||
      !paths.has(path)
    ) {
      unresolved.push(profile.id);
      continue;
    }
    changes.push({
      id: profile.id,
      expectedPhoto: profile.photo,
      replacementPhoto: destinationOrigin + prefix + path,
      sha256: verified.find((object) => object.path === path)!.sha256,
    });
  }
  return { mode: 'dry-run' as const, sourceOrigin, destinationOrigin, changes, unresolved };
}
