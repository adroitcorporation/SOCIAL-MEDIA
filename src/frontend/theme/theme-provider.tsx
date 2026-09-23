'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isTheme, themeStorageKey, type Theme } from './theme-script';

const ThemeContext = createContext<{ theme: Theme | null; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const preference = useRef<Theme | null>(null);

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    try {
      const stored = localStorage.getItem(themeStorageKey);
      preference.current = isTheme(stored) ? stored : null;
    } catch {}
    const apply = () => {
      const next = preference.current ?? (system.matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== themeStorageKey && event.key !== null) return;
      preference.current = isTheme(event.newValue) ? event.newValue : null;
      apply();
    };
    apply();
    system.addEventListener('change', apply);
    window.addEventListener('storage', onStorage);
    return () => {
      system.removeEventListener('change', apply);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    preference.current = next;
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(themeStorageKey, next);
    } catch {
      /* Keep the in-memory choice when storage is unavailable. */
    }
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('Theme controls require ThemeProvider.');
  return value;
}
