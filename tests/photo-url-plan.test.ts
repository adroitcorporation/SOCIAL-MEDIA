import { describe, expect, it } from 'vitest';
import { planPhotoUrls } from '../scripts/lib/photo-url-plan';
const source = 'https://rznbuzkgzsryadokvcfh.supabase.co';
const destination = 'https://lxofcmzgzbgqvlmwizgm.supabase.co';
const prefix = '/storage/v1/object/public/profile-photos/';
const verified = [
  {
    bucket: 'profile-photos',
    path: 'owner/photo.jpg',
    sha256: 'a'.repeat(64),
    source_destination_sha256_match: true,
    public_head_status: 200,
  },
];
describe('offline photo URL cutover plan', () => {
  it('maps only a verified public file and is idempotent without mutating inputs', () => {
    const profiles = [{ id: 'student', photo: source + prefix + 'owner/photo.jpg' }];
    const plan = planPhotoUrls(profiles, verified);
    expect(plan.changes).toEqual([
      {
        id: 'student',
        expectedPhoto: profiles[0].photo,
        replacementPhoto: destination + prefix + 'owner/photo.jpg',
        sha256: 'a'.repeat(64),
      },
    ]);
    expect(profiles[0].photo).toBe(source + prefix + 'owner/photo.jpg');
    expect(
      planPhotoUrls([{ id: 'student', photo: plan.changes[0].replacementPhoto }], verified).changes,
    ).toHaveLength(0);
  });
  it.each([
    source + prefix + 'owner/missing.jpg',
    source + prefix + 'owner/photo.jpg?token=secret',
    source + prefix + 'owner/photo.jpg#fragment',
    source + prefix + 'owner/../owner/photo.jpg',
    source + prefix + 'owner%2Fphoto.jpg',
    source + '/storage/v1/object/public/college-ids/owner/photo.jpg',
    'https://user:password@rznbuzkgzsryadokvcfh.supabase.co' + prefix + 'owner/photo.jpg',
  ])('does not rewrite ambiguous, missing, private or noncanonical references: %s', (photo) => {
    const plan = planPhotoUrls([{ id: 'student', photo }], verified);
    expect(plan.changes).toHaveLength(0);
    expect(plan.unresolved).toEqual(['student']);
  });
  it('preserves external, deceptive-host, current, blank and malformed references', () => {
    for (const photo of [
      '',
      'broken',
      'https://images.example/photo.jpg',
      source + '.evil.example' + prefix + 'owner/photo.jpg',
      destination + prefix + 'owner/photo.jpg',
    ])
      expect(planPhotoUrls([{ id: 'student', photo }], verified).changes).toHaveLength(0);
  });
  it('rejects failed hashes, private buckets, duplicate evidence and duplicate profiles', () => {
    expect(() =>
      planPhotoUrls([], [{ ...verified[0], source_destination_sha256_match: false }]),
    ).toThrow();
    expect(() => planPhotoUrls([], [{ ...verified[0], bucket: 'college-ids' }])).toThrow();
    expect(() => planPhotoUrls([], [verified[0], verified[0]])).toThrow();
    expect(() =>
      planPhotoUrls(
        [
          { id: 'same', photo: '' },
          { id: 'same', photo: '' },
        ],
        verified,
      ),
    ).toThrow();
  });
});
