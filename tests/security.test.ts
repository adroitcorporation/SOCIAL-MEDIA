import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundedJson } from '../src/backend/http/request';
import { isEmailConfirmed, isLocalDemo } from '../src/backend/auth/session';
import { profileSchema } from '../src/shared/contracts/schemas';
import { isAllowedCollegeEmail } from '../src/shared/config/college-access';
afterEach(() => vi.unstubAllEnvs());
describe('Request and environment safety', () => {
  it('never enables demo authentication in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOCAL_DEMO', 'true');
    expect(isLocalDemo()).toBe(false);
    vi.stubEnv('NODE_ENV', 'development');
    expect(isLocalDemo()).toBe(true);
  });
  it('requires Supabase email confirmation before marking an account verified', () => {
    expect(isEmailConfirmed(null)).toBe(false);
    expect(isEmailConfirmed(undefined)).toBe(false);
    expect(isEmailConfirmed('2026-09-26T10:00:00.000Z')).toBe(true);
  });
  it('allows only LNMIIT college email addresses', () => {
    expect(isAllowedCollegeEmail('student@lnmiit.ac.in')).toBe(true);
    expect(isAllowedCollegeEmail('STUDENT@LNMIIT.AC.IN')).toBe(true);
    expect(isAllowedCollegeEmail('student@othercollege.ac.in')).toBe(false);
    expect(isAllowedCollegeEmail('student@lnmiit.ac.in.attacker.example')).toBe(false);
  });
  it('limits streamed request bytes before buffering the complete payload', async () => {
    const request = new Request('http://localhost/api/profile', {
      method: 'POST',
      body: JSON.stringify({ text: 'a'.repeat(21000) }),
    });
    await expect(boundedJson(request)).rejects.toMatchObject({ status: 413 });
  });
  it('rejects malformed JSON and parses valid JSON', async () => {
    await expect(
      boundedJson(new Request('http://localhost', { method: 'POST', body: '{broken' })),
    ).rejects.toThrow(SyntaxError);
    expect(
      await boundedJson(
        new Request('http://localhost', { method: 'POST', body: '{"hello":"world"}' }),
      ),
    ).toEqual({ hello: 'world' });
  });
  it('rejects executable profile links', () => {
    const profile = {
      name: 'Student',
      photo: '',
      college: 'College',
      degree: 'B.Tech',
      graduationYear: 2028,
      city: 'Pune',
      bio: 'Building useful things with other students.',
      skills: ['React'],
      interests: ['Technology'],
      domains: ['Web Development'],
      lookingFor: ['Project partners'],
      linkedin: '',
      github: '',
      instagram: '',
      portfolio: 'javascript:alert(1)',
    };
    expect(profileSchema.safeParse(profile).success).toBe(false);
  });
});
