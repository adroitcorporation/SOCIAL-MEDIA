import { z } from 'zod';
import { connectionActions, groupActions } from './enums';
const text = (max: number) => z.string().trim().min(1).max(max);
const list = z.array(text(50)).max(20);
const requiredProfileText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max);
const requiredProfileList = (label: string) =>
  z.array(text(50)).min(1, `Add at least one ${label}.`).max(20);
export const safeUrl = z.union(
  [
    z.literal(''),
    z
      .url()
      .max(2048)
      .refine((v) => {
        try {
          return new URL(v).protocol === 'https:';
        } catch {
          return false;
        }
      }, 'Use an HTTPS URL'),
  ],
  { error: 'Enter a valid HTTPS URL or leave this field blank.' },
);
export const profileSchema = z.object({
  name: requiredProfileText('Full name', 80),
  photo: safeUrl.default(''),
  college: requiredProfileText('College', 150),
  degree: requiredProfileText('Degree / course', 100),
  graduationYear: z
    .number()
    .int()
    .min(2020, 'Select a graduation year from 2020 to 2040.')
    .max(2040, 'Select a graduation year from 2020 to 2040.'),
  city: requiredProfileText('City', 80),
  bio: requiredProfileText('Bio', 1000),
  skills: requiredProfileList('skill'),
  interests: requiredProfileList('interest'),
  domains: requiredProfileList('domain'),
  lookingFor: requiredProfileList('Looking for option'),
  linkedin: safeUrl.default(''),
  github: safeUrl.default(''),
  instagram: safeUrl.default(''),
  portfolio: safeUrl.default(''),
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
export const connectionActionSchema = z.enum(connectionActions);
export const groupActionSchema = z.object({
  action: z.enum(groupActions),
  userId: z.string().max(100).optional(),
  value: z.string().max(2048).optional(),
});
