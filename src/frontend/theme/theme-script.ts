export const themeStorageKey = 'founder-circle-theme';
export type Theme = 'light' | 'dark';
export const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

// Static, trusted code runs in the document head before the first paint. Keep
// system preference as the default; only explicit choices belong in storage.
export const themeScript = `(() => {
  let preference;
  try { preference = localStorage.getItem('${themeStorageKey}'); } catch {}
  const theme = preference === 'light' || preference === 'dark'
    ? preference
    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
})();`;
