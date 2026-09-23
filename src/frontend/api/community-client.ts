import type { HttpClient } from './http-client';
import type {
  Dashboard,
  ModerationUser,
  ReportItem,
  EventInput,
} from '@/shared/contracts/moderation';
import type { AccountStatus, UserRole, ReportStatus } from '@/shared/contracts/permissions';
import type { EventItem } from '@/shared/contracts/responses';
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
  CollegeVerification,
  VerificationReviewItem,
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
  VerificationRequest,
  VerificationReviewRequest,
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
    verification: {
      latest: () => http.request<CollegeVerification | null>('verification'),
      submit: (input: VerificationRequest) =>
        http.request<CollegeVerification>('verification', input),
    },
    moderation: {
      dashboard: () => http.request<Dashboard>('moderation/dashboard'),
      users: (query = '', rolesOnly = false) =>
        http.request<ModerationUser[]>(`moderation/${rolesOnly ? 'roles' : 'users'}?${query}`),
      reports: (query = '') => http.request<ReportItem[]>(`moderation/reports?${query}`),
      reviewReport: (reportId: string, status: ReportStatus, reviewNote: string) =>
        http.request<ReportItem>(
          `moderation/reports/${id(reportId)}`,
          { status, reviewNote },
          'PATCH',
        ),
      changeRole: (userId: string, role: UserRole, reason: string) =>
        http.request<ModerationUser>(
          `moderation/users/${id(userId)}/role`,
          { role, reason },
          'PATCH',
        ),
      changeStatus: (userId: string, accountStatus: AccountStatus, reason: string) =>
        http.request<ModerationUser>(
          `moderation/users/${id(userId)}/status`,
          { accountStatus, reason },
          'PATCH',
        ),
      document: (requestId: string) =>
        http.blob(`moderation/verifications/${id(requestId)}/document`),
      list: () => http.request<VerificationReviewItem[]>('moderation/verifications'),
      review: (requestId: string, input: VerificationReviewRequest) =>
        http.request<CollegeVerification>(
          `moderation/verifications/${id(requestId)}`,
          input,
          'PATCH',
        ),
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
      managed: (query = '') =>
        http.request<EventItem[]>(`events/managed${query ? `?${query}` : ''}`),
      create: (input: EventInput) => http.request<{ id: string }>('events', input),
      edit: (eventId: string, input: EventInput) =>
        http.request<{ id: string }>(`events/${id(eventId)}`, input, 'PATCH'),
      delete: (eventId: string) =>
        http.request<SuccessResponse>(`events/${id(eventId)}`, {}, 'DELETE'),
      save: (eventId: string, input: SaveEventRequest) =>
        http.request<SavedEvent | CountResponse>(`events/${id(eventId)}`, input),
    },
    reports: {
      submit: (targetId: string, reason: string) =>
        http.request<{ id: string }>('reports', { targetId, reason }),
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
