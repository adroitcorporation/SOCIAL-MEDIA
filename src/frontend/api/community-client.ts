import type { HttpClient } from './http-client';
import type {
  ApiConfig,
  AppState,
  Student,
  Connection,
  Conversation,
  ChatMessage,
  Message,
  Idea,
  ResonanceItem,
  GroupUpdateResponse,
  SuccessResponse,
  CountResponse,
  SkipResponse,
  SavedEvent,
} from '@/shared/contracts/responses';
import type {
  ProfileUpdateRequest,
  ConnectionRequest,
  ConnectionUpdateRequest,
  DirectConversationRequest,
  CreateGroupRequest,
  GroupUpdateRequest,
  SendMessageRequest,
  CreateIdeaRequest,
  ResonateRequest,
  IdeaGroupRequest,
  SaveEventRequest,
} from '@/shared/contracts/requests';
const id = encodeURIComponent;
export function createCommunityClient(http: HttpClient) {
  return {
    config: () => http.request<ApiConfig>('config'),
    state: (query = '') => http.request<AppState>(`state${query ? `?${query}` : ''}`),
    profiles: {
      get: (userId: string) => http.request<Student>(`students/${id(userId)}`),
      update: (input: ProfileUpdateRequest) => http.request<Student>('profile', input, 'PATCH'),
    },
    connections: {
      request: (input: ConnectionRequest) => http.request<Connection>('connections', input),
      update: (connectionId: string, input: ConnectionUpdateRequest) =>
        http.request<Connection>(`connections/${id(connectionId)}`, input, 'PATCH'),
    },
    blocks: {
      add: (userId: string) => http.request<SuccessResponse>(`blocks/${id(userId)}`, {}),
      remove: (userId: string) => http.request<CountResponse>(`blocks/${id(userId)}`, {}, 'DELETE'),
    },
    skips: {
      add: (userId: string) => http.request<SkipResponse>(`skips/${id(userId)}`, {}),
      clear: () => http.request<CountResponse>('skips', {}, 'DELETE'),
    },
    conversations: {
      create: (input: DirectConversationRequest | CreateGroupRequest) =>
        http.request<Conversation>('conversations', input),
      update: (conversationId: string, input: GroupUpdateRequest) =>
        http.request<GroupUpdateResponse>(`conversations/${id(conversationId)}`, input, 'PATCH'),
      messages: (conversationId: string, before?: string) =>
        http.request<ChatMessage[]>(
          `conversations/${id(conversationId)}/messages${before ? `?before=${id(before)}` : ''}`,
        ),
      send: (conversationId: string, input: SendMessageRequest) =>
        http.request<Message>(`conversations/${id(conversationId)}/messages`, input),
    },
    ideas: {
      create: (input: CreateIdeaRequest) => http.request<Idea>('ideas', input),
      resonate: (ideaId: string, input: ResonateRequest) =>
        http.request<SuccessResponse>(`ideas/${id(ideaId)}/resonate`, input),
      resonances: (ideaId: string) =>
        http.request<ResonanceItem[]>(`ideas/${id(ideaId)}/resonances`),
      group: (ideaId: string, input: IdeaGroupRequest) =>
        http.request<Conversation>(`ideas/${id(ideaId)}/group`, input),
    },
    events: {
      save: (eventId: string, input: SaveEventRequest) =>
        http.request<SavedEvent | CountResponse>(`events/${id(eventId)}`, input),
    },
    notifications: {
      markRead: (notificationId?: string) =>
        http.request<CountResponse>(
          notificationId ? `notifications/${id(notificationId)}` : 'notifications',
          {},
          'PATCH',
        ),
    },
    live: (signal: AbortSignal) => http.openStream('live', signal),
  };
}
export type CommunityClient = ReturnType<typeof createCommunityClient>;
