import type { z } from 'zod';
import type {
  profileSchema,
  ideaSchema,
  groupSchema,
  messageSchema,
  groupActionSchema,
} from './schemas';
import type { ConnectionAction } from './enums';
export type ProfileUpdateRequest = z.infer<typeof profileSchema>;
export type CreateIdeaRequest = z.infer<typeof ideaSchema>;
export type CreateGroupRequest = z.infer<typeof groupSchema> & { type: 'GROUP' };
export type SendMessageRequest = z.infer<typeof messageSchema>;
export type GroupUpdateRequest = z.infer<typeof groupActionSchema>;
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
