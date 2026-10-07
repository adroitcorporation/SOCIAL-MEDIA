import type { AppState, Connection, Student } from '@/shared/contracts/responses';

export function applyConnection(state: AppState, result: Connection, profile?: Student): AppState {
  const existing = state.connections.find((connection) => connection.id === result.id);
  const otherId = result.requesterId === state.me.id ? result.receiverId : result.requesterId;
  const other =
    state.students.find((student) => student.id === otherId) ??
    (profile?.id === otherId ? profile : undefined);
  const item = existing
    ? { ...existing, ...result }
    : other
      ? {
          ...result,
          requester: result.requesterId === state.me.id ? state.me : other,
          receiver: result.receiverId === state.me.id ? state.me : other,
        }
      : undefined;
  const connections = state.connections.filter((connection) => connection.id !== result.id);
  if (item && ['PENDING', 'ACCEPTED'].includes(result.status)) connections.unshift(item);
  const removed =
    result.status === 'ACCEPTED' && state.students.some((student) => student.id === otherId);
  return {
    ...state,
    connections,
    students: removed ? state.students.filter((student) => student.id !== otherId) : state.students,
    totalStudents: removed ? Math.max(0, state.totalStudents - 1) : state.totalStudents,
  };
}
