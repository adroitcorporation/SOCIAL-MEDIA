import { describe, expect, it } from 'vitest';
import { parseStorageCredentials } from '../scripts/lib/storage-sync-env';
const base = `SOURCE_SUPABASE_URL=https://rznbuzkgzsryadokvcfh.supabase.co
SOURCE_SUPABASE_SERVICE_ROLE_KEY=sb_secret_source_fixture
DEST_SUPABASE_URL=https://lxofcmzgzbgqvlmwizgm.supabase.co
DEST_SUPABASE_SERVICE_ROLE_KEY=sb_secret_dest_fixture`;
describe('isolated Storage credential parsing', () => {
  it('normalizes the known REST suffix while rejecting arbitrary paths', () => {
    expect(
      parseStorageCredentials(base.replaceAll('.supabase.co', '.supabase.co/rest/v1/')).source.url,
    ).toBe('https://rznbuzkgzsryadokvcfh.supabase.co');
    expect(() =>
      parseStorageCredentials(base.replaceAll('.supabase.co', '.supabase.co/unknown')),
    ).toThrow('project URL');
  });
  it('loads all four variables without changing process environment', () => {
    const previous = process.env.SOURCE_SUPABASE_URL;
    const parsed = parseStorageCredentials(base);
    expect(parsed.source.url).toBe('https://rznbuzkgzsryadokvcfh.supabase.co');
    expect(parsed.destination.key).toBe('sb_secret_dest_fixture');
    expect(process.env.SOURCE_SUPABASE_URL).toBe(previous);
  });
  it('rejects swapped project URLs without disclosing credential values', () => {
    expect(() =>
      parseStorageCredentials(
        base.replace('https://rznbuzkgzsryadokvcfh', 'https://lxofcmzgzbgqvlmwizgm'),
      ),
    ).toThrow('source project URL');
  });
  it('rejects frontend keys and missing values', () => {
    expect(() =>
      parseStorageCredentials(base.replace('sb_secret_source_fixture', 'sb_publishable_fixture')),
    ).toThrow('backend-only');
    expect(() => parseStorageCredentials(base.replace('sb_secret_dest_fixture', ''))).toThrow(
      'missing',
    );
  });
  it('rejects mismatched legacy project or role claims', () => {
    const key =
      'eyJ.' +
      Buffer.from(JSON.stringify({ ref: 'wrong', role: 'anon' })).toString('base64url') +
      '.fixture';
    expect(() => parseStorageCredentials(base.replace('sb_secret_source_fixture', key))).toThrow(
      'role or project mismatch',
    );
  });
});
