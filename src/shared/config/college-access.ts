export const collegeName = 'The LNM Institute of Information Technology Jaipur';
export const allowedEmailDomain = 'lnmiit.ac.in';

export function isAllowedCollegeEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${allowedEmailDomain}`);
}