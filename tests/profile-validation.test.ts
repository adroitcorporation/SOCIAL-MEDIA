import { describe, expect, it } from 'vitest';
import { profileSchema } from '@/shared/contracts/schemas';
import { errorResponse } from '@/backend/http/error-response';

const valid = {
  name: 'Aditi Sharma',
  college: 'IIT Bombay',
  degree: 'B.Tech',
  graduationYear: 2028,
  city: 'Mumbai',
  bio: 'Building tools for students.',
  skills: ['React', 'Python'],
  interests: ['Technology'],
  domains: ['Web Development'],
  lookingFor: ['Project partners'],
};
const required = [
  'name',
  'college',
  'degree',
  'graduationYear',
  'city',
  'bio',
  'skills',
  'interests',
  'domains',
  'lookingFor',
] as const;
const lists = ['skills', 'interests', 'domains', 'lookingFor'] as const;

describe('required profile contract', () => {
  it('accepts predefined values and defaults omitted optional URLs to empty strings', () => {
    expect(profileSchema.parse(valid)).toEqual({
      ...valid,
      photo: '',
      linkedin: '',
      github: '',
      instagram: '',
      portfolio: '',
    });
  });
  it.each(required)(
    'rejects a missing %s and returns a field-specific API error',
    async (field) => {
      const input: Record<string, unknown> = { ...valid };
      delete input[field];
      const result = profileSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Missing field was accepted');
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
      const response = errorResponse(result.error);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain(field);
    },
  );
  it.each(['name', 'college', 'degree', 'city', 'bio'])('rejects whitespace-only %s', (field) => {
    expect(profileSchema.safeParse({ ...valid, [field]: '   ' }).success).toBe(false);
  });
  it.each(lists)('rejects empty and blank-only %s', (field) => {
    for (const value of [[], [''], ['  '], ['React', ' ']]) {
      expect(profileSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
    }
  });
  it('accepts custom list values and custom degree/city without imposing enum restrictions', () => {
    const custom = {
      ...valid,
      degree: 'B.Des',
      city: 'Pilani',
      skills: ['Robotics'],
      interests: ['Astronomy'],
      domains: ['Space technology'],
      lookingFor: ['Study partners'],
    };
    expect(profileSchema.parse(custom)).toMatchObject(custom);
  });
  it.each(['photo', 'linkedin', 'github', 'instagram', 'portfolio'])(
    'keeps %s optional while enforcing HTTPS',
    (field) => {
      expect(profileSchema.safeParse({ ...valid, [field]: '' }).success).toBe(true);
      expect(
        profileSchema.safeParse({ ...valid, [field]: 'https://example.com/profile' }).success,
      ).toBe(true);
      for (const value of ['http://example.com', 'javascript:alert(1)', 'not a URL']) {
        expect(profileSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
      }
    },
  );
  it('preserves inclusive graduation year boundaries', () => {
    for (const year of [2020, 2040])
      expect(profileSchema.safeParse({ ...valid, graduationYear: year }).success).toBe(true);
    for (const year of [2019, 2041, 2028.5, 0])
      expect(profileSchema.safeParse({ ...valid, graduationYear: year }).success).toBe(false);
  });
});
