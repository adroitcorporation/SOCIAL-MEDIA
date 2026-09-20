'use client';
import { createContext, useContext } from 'react';
import type { AppState, Student } from '@/shared/contracts/responses';
import type { CommunityClient } from '@/frontend/api/community-client';
export interface CircleContextValue {
  state: AppState;
  busy: boolean;
  mutate: <T>(operation: () => Promise<T>) => Promise<T>;
  api: CommunityClient;
  refresh: () => Promise<void>;
  toast: (message: string, error?: boolean) => void;
  viewProfile: (student: Student) => void;
  navigate: (path: string) => void;
}
export const CircleContext = createContext<CircleContextValue | null>(null);
export function useCircle() {
  const context = useContext(CircleContext);
  if (!context) throw new Error('Missing circle context');
  return context;
}
