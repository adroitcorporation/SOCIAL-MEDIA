import { describe, expect, it } from 'vitest';
import { getProfileCompletion } from '@/shared/contracts/profile-completion';
import { connectionReadyProfile } from './fixtures/connection-ready';
import { ApiError, createHttpClient } from '@/frontend/api/http-client';

describe('shared connection readiness', () => {
  it('uses seven essential requirements, with domains as an alternative to interests', () => {
    expect(getProfileCompletion(connectionReadyProfile)).toEqual({
      isComplete: true,
      percentage: 100,
      missingFields: [],
    });
    expect(
      getProfileCompletion({ ...connectionReadyProfile, interests: [], domains: ['Education'] })
        .isComplete,
    ).toBe(true);
    expect(getProfileCompletion({}).percentage).toBe(0);
    expect(getProfileCompletion({ ...connectionReadyProfile, bio: '' })).toEqual({
      isComplete: false,
      percentage: 86,
      missingFields: ['bio'],
    });
  });
  it.each([
    ['name', '   ', 'name'],
    ['bio', 'too short', 'bio'],
    ['bio', 'a                     b', 'bio'],
    ['college', ' ', 'college'],
    ['graduationYear', 0, 'graduationYear'],
    ['skills', [' ', '...'], 'skills'],
    ['lookingFor', [' '], 'lookingFor'],
    ['interests', [' '], 'interestsOrDomains'],
  ])('rejects meaningless %s values', (field, value, missing) => {
    expect(
      getProfileCompletion({ ...connectionReadyProfile, [field as string]: value }).missingFields,
    ).toContain(missing);
  });
  it('preserves the structured backend error for the global Connect prompt', async () => {
    const client = createHttpClient({
      fetch: async () =>
        Response.json(
          {
            error: 'Complete your profile before sending connection requests.',
            code: 'PROFILE_INCOMPLETE',
            missingFields: ['bio'],
          },
          { status: 403 },
        ),
    });
    await expect(client.request('connections', { userId: 'peer' })).rejects.toMatchObject({
      status: 403,
      code: 'PROFILE_INCOMPLETE',
      missingFields: ['bio'],
    } satisfies Partial<ApiError>);
  });
});
