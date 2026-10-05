import data from './taxonomy.json';

export const taxonomy = data;
export type TaxonomyField = keyof typeof taxonomy;
export const selectionLimits = { skills: 7, interests: 7, lookingFor: 4, domains: 7 };
export const keyOf = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
export function normalizeValue(field: TaxonomyField, value: string): string {
  const key = keyOf(value);
  return (
    taxonomy[field].find((item) => [item.label, ...item.aliases].some((v) => keyOf(v) === key))
      ?.label ?? value.trim()
  );
}
export function normalizeList(field: TaxonomyField, values: string[]): string[] {
  return [
    ...new Map(
      values
        .filter((v) => v.trim())
        .map((v) => {
          const label = normalizeValue(field, v);
          return [keyOf(label), label];
        }),
    ).values(),
  ];
}
export function searchTaxonomy(field: TaxonomyField, search: string) {
  const key = keyOf(search);
  return taxonomy[field].filter((item) =>
    [item.label, ...item.aliases].some((v) => keyOf(v).includes(key)),
  );
}

export const intentSkills: Record<string, string[]> = {
  'Web Developer': ['Web Development', 'Full Stack Development'],
  'App Developer': ['App Development', 'Full Stack Development'],
  'AI/ML Developer': ['AI / Machine Learning', 'Data Science'],
  Designer: ['UI/UX Design', 'Graphic Design', 'Product Design'],
  'UI/UX Designer': ['UI/UX Design', 'Product Design'],
  'Video Editor': ['Video Editing'],
  'Content Creator': ['Content Creation', 'Writing / Copywriting'],
  'Marketing/Growth Partner': ['Growth & Marketing', 'Digital Marketing', 'Social Media'],
  'Business Partner': ['Business Development', 'Entrepreneurship', 'Finance'],
  'Research Collaborator': ['Research'],
  'Film/Content Team': ['Filmmaking', 'Acting', 'Videography', 'Video Editing'],
  'E-Cell Collaborations': ['Event Management', 'Community Building', 'Sponsorship & Outreach'],
};
export const complementaryPairs = [
  ['Web Development', 'UI/UX Design'],
  ['App Development', 'UI/UX Design'],
  ['Full Stack Development', 'Product Design'],
  ['Web Development', 'Product Design'],
  ['Web Development', 'Growth & Marketing'],
  ['Full Stack Development', 'Growth & Marketing'],
  ['AI / Machine Learning', 'Web Development'],
  ['AI / Machine Learning', 'App Development'],
  ['Content Creation', 'Video Editing'],
  ['Filmmaking', 'Acting'],
  ['Filmmaking', 'Videography'],
  ['Entrepreneurship', 'Business Development'],
  ['Entrepreneurship', 'Growth & Marketing'],
  ['Event Management', 'Sponsorship & Outreach'],
  ['Robotics / IoT', 'AI / Machine Learning'],
  ['Hardware / Electronics', 'Web Development'],
  ['Research', 'Web Development'],
] as const;
export function desiredSkills(lookingFor: string[]) {
  return [
    ...new Set(normalizeList('lookingFor', lookingFor).flatMap((v) => intentSkills[v] ?? [])),
  ];
}
export function complementarySkills(skills: string[]) {
  const normalized = normalizeList('skills', skills);
  return [
    ...new Set(
      complementaryPairs.flatMap(([a, b]) =>
        normalized.includes(a) ? [b] : normalized.includes(b) ? [a] : [],
      ),
    ),
  ];
}
