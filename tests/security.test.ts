import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundedJson } from '../src/lib/request';
import { isLocalDemo } from '../src/lib/auth';
import { profileSchema } from '../src/lib/validation';
afterEach(() => vi.unstubAllEnvs());
describe('Request and environment safety', () => {
  it('never enables demo authentication in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOCAL_DEMO', 'true');
    expect(isLocalDemo()).toBe(false);
    vi.stubEnv('NODE_ENV', 'development');
    expect(isLocalDemo()).toBe(true);
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
      bio: '',
      skills: [],
      interests: [],
      domains: [],
      lookingFor: [],
      linkedin: '',
      github: '',
      instagram: '',
      portfolio: 'javascript:alert(1)',
    };
    expect(profileSchema.safeParse(profile).success).toBe(false);
  });
});
