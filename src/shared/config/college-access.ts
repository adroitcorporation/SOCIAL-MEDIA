export const collegeName = 'The LNM Institute of Information Technology Jaipur';
export const allowedEmailDomain = 'lnmiit.ac.in';
export function normalizeApprovedDomain(value: string): string {
  const domain = value.trim().toLowerCase().replace(/^@/, '');
  if (
    domain.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
  )
    return '';
  return domain;
}

export function normalizeCollegeEmailDomain(email: string) {
  const match = /^[^\s@]+@([^\s@]+)$/.exec(email.trim());
  return match ? normalizeApprovedDomain(match[1]) : '';
}

export function isAllowedCollegeEmail(email: string) {
  const domain = normalizeCollegeEmailDomain(email);
  return Boolean(domain && domain === allowedEmailDomain);
}
