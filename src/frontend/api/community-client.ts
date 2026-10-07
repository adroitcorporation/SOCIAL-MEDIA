import type { HttpClient } from './http-client';
import type { ProfilePost, PostInput, PostPage, PostComment } from '@/shared/contracts/posts';
import type {
  Dashboard,
  ApprovedCollegeDomain,
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
  NotificationSnapshot,
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
import type {
  CollegeOption,
  TeamRequest,
  TeamRecommendation,
} from '@/shared/contracts/recommendations';
const id = encodeURIComponent;
export function createCommunityClient(http: HttpClient) {
  return {
    posts: {
      list: (authorId: string, cursor?: string) =>
        http.request<PostPage<ProfilePost>>(
          `students/${id(authorId)}/posts${cursor ? `?cursor=${id(cursor)}` : ''}`,
        ),
      get: (postId: string) => http.request<ProfilePost>(`posts/${id(postId)}`),
      create: (input: PostInput & { clientId: string }) =>
        http.request<ProfilePost>('posts', input),
      edit: (postId: string, input: PostInput) =>
        http.request<ProfilePost>(`posts/${id(postId)}`, input, 'PATCH'),
      delete: (postId: string) =>
        http.request<SuccessResponse>(`posts/${id(postId)}`, {}, 'DELETE'),
      like: (postId: string, enabled: boolean) =>
        http.request<{ liked: boolean; likeCount: number }>(`posts/${id(postId)}/like`, {
          enabled,
        }),
      comments: (postId: string, cursor?: string) =>
        http.request<PostPage<PostComment>>(
          `posts/${id(postId)}/comments${cursor ? `?cursor=${id(cursor)}` : ''}`,
        ),
      comment: (postId: string, content: string, clientId: string) =>
        http.request<{ id: string }>(`posts/${id(postId)}/comments`, { content, clientId }),
      deleteComment: (postId: string, commentId: string) =>
        http.request<SuccessResponse>(
          `posts/${id(postId)}/comments/${id(commentId)}`,
          {},
          'DELETE',
        ),
      report: (postId: string, reason: string) =>
        http.request<{ id: string }>(`posts/${id(postId)}/report`, { reason }),
    },
    colleges: (search: string) => http.request<CollegeOption[]>(`colleges?search=${id(search)}`),
    recommendations: {
      team: (input: TeamRequest) => http.request<TeamRecommendation>('recommendations/team', input),
      opened: (targetId: string) =>
        http.request<SuccessResponse>('recommendations/interactions', {
          targetId,
          action: 'PROFILE_OPENED',
        }),
    },
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
      domains: () => http.request<ApprovedCollegeDomain[]>('moderation/domains'),
      addDomain: (domain: string, collegeId?: string) =>
        http.request<ApprovedCollegeDomain[]>('moderation/domains', { domain, collegeId }),
      removeDomain: (domain: string) =>
        http.request<ApprovedCollegeDomain[]>('moderation/domains', { domain }, 'DELETE'),
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
      clear: (conversationId: string) =>
        http.request<{ ok: true }>(`conversations/${id(conversationId)}`, {}, 'DELETE'),
      update: (conversationId: string, input: GroupUpdateRequest) =>
        http.request<GroupUpdateResponse>(`conversations/${id(conversationId)}`, input, 'PATCH'),
      messages: (conversationId: string, before?: string, after?: string) =>
        http.request<ChatMessage[]>(
          `conversations/${id(conversationId)}/messages${before ? `?before=${id(before)}` : after ? `?after=${id(after)}` : ''}`,
        ),
      send: (conversationId: string, input: SendMessageRequest) =>
        http.request<Message>(`conversations/${id(conversationId)}/messages`, input),
      deleteMessage: (conversationId: string, messageId: string) =>
        http.request<{ ok: true }>(
          `conversations/${id(conversationId)}/messages/${id(messageId)}`,
          {},
          'DELETE',
        ),
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
      uploadAttachment: (eventId: string, file: File) =>
        http.upload(`events/${id(eventId)}/attachments?name=${id(file.name)}`, file),
      deleteAttachment: (eventId: string, attachmentId: string) =>
        http.request<SuccessResponse>(
          `events/${id(eventId)}/attachments/${id(attachmentId)}`,
          {},
          'DELETE',
        ),
      attachment: (eventId: string, attachmentId: string) =>
        http.blob(`events/${id(eventId)}/attachments/${id(attachmentId)}`),
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
        http.request<CountResponse & NotificationSnapshot>(
          notificationId ? `notifications/${id(notificationId)}` : 'notifications',
          {},
          'PATCH',
        ),
    },
    live: (signal: AbortSignal) => http.openStream('live', signal),
  };
}
export type CommunityClient = ReturnType<typeof createCommunityClient>;
