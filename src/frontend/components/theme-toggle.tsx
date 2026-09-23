'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/frontend/theme/theme-provider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label="Dark mode"
      aria-pressed={theme === 'dark'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
    >
      <Moon className="theme-moon" size={18} aria-hidden="true" />
      <Sun className="theme-sun" size={18} aria-hidden="true" />
    </button>
  );
}
