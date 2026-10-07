import { describe, it, expect } from 'vitest';
import { runInNewContext } from 'node:vm';
import { themeScript, themeStorageKey } from '@/frontend/theme/theme-script';

describe('pre-paint theme resolution', () => {
  it.each([undefined, null, 'invalid', 'light', 'dark'])(
    'saved %s takes priority over default Light without consulting OS',
    (stored) => {
      const document = { documentElement: { dataset: {} as { theme?: string } } };
      runInNewContext(themeScript, {
        document,
        localStorage: {
          getItem: (key: string) => {
            expect(key).toBe(themeStorageKey);
            return stored;
          },
        },
      });
      expect(document.documentElement.dataset.theme).toBe(stored === 'dark' ? 'dark' : 'light');
    },
  );
  it('uses Light when storage is inaccessible', () => {
    const document = { documentElement: { dataset: {} as { theme?: string } } };
    runInNewContext(themeScript, {
      document,
      localStorage: {
        getItem: () => {
          throw new Error('Unavailable');
        },
      },
    });
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
