import type {
  ConnectionStatus,
  ConversationType,
  MemberRole,
  VerificationMethod,
  VerificationStatus,
} from './enums';
// Dates cross the HTTP boundary as ISO-8601 strings, never ORM Date objects.
export type IsoDateTime = string;
export interface ApiConfig {
  demo: boolean;
  configured: boolean;
}
export interface ApiErrorResponse {
  error: string;
}
export interface SuccessResponse {
  ok: boolean;
}
export interface CountResponse {
  count: number;
}
export interface CollegeVerification {
  id: string;
  method: VerificationMethod;
  collegeEmail: string | null;
  userId: string;
  reviewerId: string | null;
  reviewedAt: IsoDateTime | null;
  status: VerificationStatus;
  reviewNote: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface VerificationReviewItem extends CollegeVerification {
  user: Student;
}
export interface Student {
  id: string;
  name: string;
  photo: string;
  college: string;
  degree: string;
  graduationYear: number;
  city: string;
  bio: string;
  skills: string[];
  interests: string[];
  domains: string[];
  lookingFor: string[];
  linkedin: string;
  github: string;
  instagram: string;
  portfolio: string;
  emailVerified: boolean;
  collegeVerified: boolean;
  onboarded: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface Connection {
  id: string;
  pairKey: string;
  requesterId: string;
  receiverId: string;
  status: ConnectionStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface ConnectionItem extends Connection {
  requester: Student;
  receiver: Student;
}
export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  image: string | null;
  ownerId: string | null;
  directKey: string | null;
  ideaId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface ConversationMember {
  conversationId: string;
  userId: string;
  role: MemberRole;
  joinedAt: IsoDateTime;
  lastReadAt: IsoDateTime;
}
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  clientId: string;
  createdAt: IsoDateTime;
}
export interface ChatMessage extends Message {
  sender: Student;
}
export interface ConversationItem extends Conversation {
  members: (ConversationMember & { user: Student })[];
  messages: ChatMessage[];
  myRole: MemberRole;
  unread: number;
}
export interface Idea {
  id: string;
  authorId: string;
  title: string;
  description: string;
  category: string;
  skills: string[];
  tags: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface IdeaResonance {
  ideaId: string;
  userId: string;
  createdAt: IsoDateTime;
}
export interface ResonanceItem extends IdeaResonance {
  user: Student;
}
export interface IdeaItem extends Idea {
  author: Student;
  resonances: IdeaResonance[];
  _count: { resonances: number };
  conversation: { id: string } | null;
}
export interface SavedEvent {
  userId: string;
  eventId: string;
}
export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: string;
  organizer: string;
  location: string;
  startsAt: IsoDateTime;
  url: string;
  savedBy: SavedEvent[];
}
export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  href: string;
  readAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}
export interface AppState {
  me: Student;
  verification?: CollegeVerification | null;
  isModerator?: boolean;
  students: Student[];
  totalStudents: number;
  connections: ConnectionItem[];
  ideas: IdeaItem[];
  events: EventItem[];
  notifications: NotificationItem[];
  conversations: ConversationItem[];
  blockedIds: string[];
}
export interface SkipResponse {
  userId: string;
  targetId: string;
}
export type GroupUpdateResponse = Conversation | SuccessResponse;
