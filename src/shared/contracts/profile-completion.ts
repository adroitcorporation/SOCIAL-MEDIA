export const MIN_CONNECTION_BIO_LENGTH = 20;
export const profileRequirements = [
  { field: 'name', label: 'Name' },
  { field: 'bio', label: `Bio (at least ${MIN_CONNECTION_BIO_LENGTH} characters)` },
  { field: 'college', label: 'College' },
  { field: 'graduationYear', label: 'Graduation year (2020–2040)' },
  { field: 'skills', label: 'At least one skill' },
  { field: 'interestsOrDomains', label: 'At least one interest or domain' },
  { field: 'lookingFor', label: 'At least one Looking for selection' },
] as const;
type ProfileRequirement = (typeof profileRequirements)[number]['field'];
type ProfileInput = Partial<
  Record<Exclude<ProfileRequirement, 'interestsOrDomains'> | 'interests' | 'domains', unknown>
>;
const meaningfulText = (value: unknown, min: number, max: number) =>
  typeof value === 'string' &&
  value.trim().replace(/\s+/gu, ' ').length >= min &&
  value.trim().length <= max &&
  /[\p{L}\p{N}]/u.test(value);
const hasEntry = (value: unknown) =>
  Array.isArray(value) && value.some((entry) => meaningfulText(entry, 1, 50));

// Readiness is derived from profile data, never the legacy onboarded flag or verification.
export function getProfileCompletion(profile: ProfileInput) {
  const complete: Record<ProfileRequirement, boolean> = {
    name: meaningfulText(profile.name, 1, 80),
    bio: meaningfulText(profile.bio, MIN_CONNECTION_BIO_LENGTH, 1000),
    college: meaningfulText(profile.college, 1, 150),
    graduationYear:
      typeof profile.graduationYear === 'number' &&
      Number.isInteger(profile.graduationYear) &&
      profile.graduationYear >= 2020 &&
      profile.graduationYear <= 2040,
    skills: hasEntry(profile.skills),
    interestsOrDomains: hasEntry(profile.interests) || hasEntry(profile.domains),
    lookingFor: hasEntry(profile.lookingFor),
  };
  const missingFields = profileRequirements
    .filter(({ field }) => !complete[field])
    .map(({ field }) => field);
  return {
    isComplete: missingFields.length === 0,
    percentage: Math.round(
      ((profileRequirements.length - missingFields.length) / profileRequirements.length) * 100,
    ),
    missingFields,
  };
}
