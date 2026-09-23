export const connectionStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'] as const;
export type ConnectionStatus = (typeof connectionStatuses)[number];
export const conversationTypes = ['DIRECT', 'GROUP'] as const;
export type ConversationType = (typeof conversationTypes)[number];
export const memberRoles = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export const verificationMethods = ['EMAIL', 'COLLEGE_ID'] as const;
export const verificationStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type VerificationMethod = (typeof verificationMethods)[number];
export type VerificationStatus = (typeof verificationStatuses)[number];
export type MemberRole = (typeof memberRoles)[number];
export const connectionActions = ['accept', 'reject', 'cancel'] as const;
export type ConnectionAction = (typeof connectionActions)[number];
export const groupActions = [
  'add',
  'remove',
  'promote',
  'demote',
  'rename',
  'image',
  'leave',
  'delete',
  'transfer',
] as const;
export type GroupAction = (typeof groupActions)[number];
