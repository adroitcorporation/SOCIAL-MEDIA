import { z } from 'zod';
import { connectionActions, groupActions, verificationMethods } from './enums';
import { MAX_VERIFICATION_DATA_URL_LENGTH } from './verification';
import { selectionLimits } from '@/shared/recommendations/taxonomy';
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
const profileBaseSchema = z.object({
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
export function profileSchemaForExisting(existing?: Partial<Record<keyof typeof selectionLimits, string[]>>) {
  return profileBaseSchema.superRefine((value,ctx)=>{
    for(const field of Object.keys(selectionLimits) as (keyof typeof selectionLimits)[]) {
      const values=value[field], previous=existing?.[field]??[];
      const legacy=values.length<=previous.length&&values.every(v=>previous.includes(v));
      if(values.length>selectionLimits[field]&&!legacy)ctx.addIssue({code:'custom',path:[field],message:`Choose up to ${selectionLimits[field]} ${field === 'lookingFor'?'options':field}.`});
    }
  });
}
export const profileSchema = profileSchemaForExisting();
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
export const verificationRequestSchema = z
  .object({
    method: z.enum(verificationMethods),
    collegeEmail: z.string().trim().email().max(254).optional(),
    documentUrl: z
      .string()
      .max(MAX_VERIFICATION_DATA_URL_LENGTH)
      .refine(
        (value) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),
        'Upload a JPG, PNG, or WebP image up to 4 MB.',
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.method === 'EMAIL' && !value.collegeEmail)
      context.addIssue({
        code: 'custom',
        path: ['collegeEmail'],
        message: 'College email is required.',
      });
    if (value.method === 'COLLEGE_ID' && !value.documentUrl)
      context.addIssue({
        code: 'custom',
        path: ['documentUrl'],
        message: 'College ID image is required.',
      });
  });
export const verificationReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().max(500).default(''),
});
