import type { snapshot } from '@/services/community';
import type { User, Message } from '@prisma/client';
type Json<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
export type AppState = Json<Awaited<ReturnType<typeof snapshot>>>;
export type Student = Json<User>;
export type ChatMessage = Json<Message & { sender: User }>;
export type IdeaItem = AppState['ideas'][number];
export type ConversationItem = AppState['conversations'][number];
