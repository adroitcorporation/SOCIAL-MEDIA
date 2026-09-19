'use client';
import { createContext, useContext } from 'react';
import type { AppState, Student } from '@/lib/types';
export interface CircleContextValue {
  state: AppState;
  busy: boolean;
  mutate: <T = unknown>(path: string, body?: unknown, method?: string) => Promise<T>;
  api: <T>(path: string, body?: unknown, method?: string) => Promise<T>;
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
