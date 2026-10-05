import { z } from 'zod';
import type { Student } from './responses';
export interface Match { matchScore: number; reasons: string[] }
export interface CollegeOption { id: string; name: string; shortName: string; city: string; state: string; country: string; aliases: string[] }
export const teamRequestSchema = z.object({
  ideaId: z.string().min(1).max(100).optional(),
  requiredSkills: z.array(z.string().trim().min(1).max(50)).max(12).default([]),
  teamSize: z.number().int().min(1).max(8).default(4),
}).refine((v) => v.ideaId || v.requiredSkills.length, 'Choose an idea or required skills.');
export type TeamRequest = z.input<typeof teamRequestSchema>;
export interface TeamRecommendation { users: (Student & Match)[]; compatibility: number; coveredSkills: string[]; missingSkills: string[] }
export const interactionSchema = z.object({targetId: z.string().min(1).max(100), action: z.literal('PROFILE_OPENED')});
