import type {
  User,
  Connection as DbConnection,
  Conversation as DbConversation,
  Message as DbMessage,
  Idea as DbIdea,
} from '@prisma/client';
import type {
  snapshot,
  readMessages,
  listResonances,
  manageGroup,
} from '@/backend/services/community';
import type {
  AppState,
  Student,
  Connection,
  Conversation,
  Message,
  ChatMessage,
  Idea,
  ResonanceItem,
  GroupUpdateResponse,
} from '@/shared/contracts/responses';
import { serialize } from './serialization';
// Explicit return types make ORM/service changes fail compilation if they break the API contract.
export const present = {
  state: (value: Awaited<ReturnType<typeof snapshot>>): AppState => serialize(value),
  student: (value: User): Student => serialize(value),
  connection: (value: DbConnection): Connection => serialize(value),
  conversation: (value: DbConversation): Conversation => serialize(value),
  groupUpdate: (value: Awaited<ReturnType<typeof manageGroup>>): GroupUpdateResponse =>
    serialize(value),
  message: (value: DbMessage): Message => serialize(value),
  messages: (value: Awaited<ReturnType<typeof readMessages>>): ChatMessage[] => serialize(value),
  idea: (value: DbIdea): Idea => serialize(value),
  resonances: (value: Awaited<ReturnType<typeof listResonances>>): ResonanceItem[] =>
    serialize(value),
};
