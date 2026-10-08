import { describe, expect, it } from 'vitest';
import {
  historicalStoragePhoto,
  matchesProjectDatabase,
  matchesProjectUrl,
} from '@/shared/config/supabase-project.mjs';
describe('migration project boundaries', () => {
  it('rejects a different project and deceptive URL before credentials can be sent', () => {
    expect(matchesProjectUrl('https://singapore.supabase.co', 'singapore')).toBe(true);
    expect(matchesProjectUrl('https://seoul.supabase.co', 'singapore')).toBe(false);
    expect(matchesProjectUrl('https://singapore.supabase.co.attacker.example', 'singapore')).toBe(
      false,
    );
    expect(matchesProjectUrl('https://user:password@singapore.supabase.co', 'singapore')).toBe(
      false,
    );
    expect(matchesProjectUrl('http://singapore.supabase.co', 'singapore')).toBe(false);
  });
  it('validates pooler identity, not just the regional host', () => {
    expect(
      matchesProjectDatabase(
        'postgresql://postgres.singapore:test@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
        'singapore',
      ),
    ).toBe(true);
    expect(
      matchesProjectDatabase(
        'postgresql://postgres.seoul:test@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
        'singapore',
      ),
    ).toBe(false);
    expect(
      matchesProjectDatabase(
        'postgresql://postgres:test@db.singapore.supabase.co:5432/postgres',
        'singapore',
      ),
    ).toBe(true);
  });
  it('uses initials for historical Storage photos while preserving external/current images', () => {
    const active = 'https://singapore.supabase.co';
    expect(
      historicalStoragePhoto(
        'https://seoul.supabase.co/storage/v1/object/public/profile-photos/a.png',
        active,
      ),
    ).toBe(true);
    expect(
      historicalStoragePhoto(
        'https://singapore.supabase.co/storage/v1/object/public/profile-photos/a.png',
        active,
      ),
    ).toBe(false);
    expect(historicalStoragePhoto('https://images.example/a.png', active)).toBe(false);
  });
});
