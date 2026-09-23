import type { z } from 'zod';
import type {
  profileSchema,
  ideaSchema,
  groupSchema,
  messageSchema,
  groupActionSchema,
  verificationRequestSchema,
  verificationReviewSchema,
} from './schemas';
import type { ConnectionAction } from './enums';
export type ProfileUpdateRequest = z.input<typeof profileSchema>;
export type CreateIdeaRequest = z.infer<typeof ideaSchema>;
export type CreateGroupRequest = z.infer<typeof groupSchema> & { type: 'GROUP' };
export type SendMessageRequest = z.infer<typeof messageSchema>;
export type GroupUpdateRequest = z.infer<typeof groupActionSchema>;
export type VerificationRequest = z.infer<typeof verificationRequestSchema>;
export type VerificationReviewRequest = z.infer<typeof verificationReviewSchema>;
export interface ConnectionRequest {
  userId: string;
}
export interface ConnectionUpdateRequest {
  action: ConnectionAction;
}
export interface DirectConversationRequest {
  type: 'DIRECT';
  userId: string;
}
export interface ResonateRequest {
  enabled: boolean;
}
export interface IdeaGroupRequest {
  memberIds: string[];
}
export interface SaveEventRequest {
  saved: boolean;
}
