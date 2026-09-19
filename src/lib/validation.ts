import { z } from 'zod';
const text = (max: number) => z.string().trim().min(1).max(max);
const list = z.array(text(50)).max(20);
export const safeUrl = z.union([
  z.literal(''),
  z
    .url()
    .max(2048)
    .refine((v) => new URL(v).protocol === 'https:', 'Use an HTTPS URL'),
]);
export const profileSchema = z.object({
  name: text(80),
  photo: safeUrl,
  college: text(150),
  degree: text(100),
  graduationYear: z.number().int().min(2020).max(2040),
  city: text(80),
  bio: z.string().trim().max(1000),
  skills: list,
  interests: list,
  domains: list,
  lookingFor: list,
  linkedin: safeUrl,
  github: safeUrl,
  instagram: safeUrl,
  portfolio: safeUrl,
});
export const ideaSchema = z.object({
  title: text(120),
  description: text(5000),
  category: text(60),
  skills: list,
  tags: list,
});
export const groupSchema = z.object({
  name: text(80),
  memberIds: z.array(text(100)).min(1).max(49),
});
export const messageSchema = z.object({ body: text(4000), clientId: z.string().uuid() });
