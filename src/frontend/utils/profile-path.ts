import type { Student } from '@/shared/contracts/responses';

export function profileHandle(name: string) {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'user'
  );
}

export function profilePath(user: Pick<Student, 'id' | 'name'>) {
  return `/u/${profileHandle(user.name)}--${encodeURIComponent(user.id)}`;
}
