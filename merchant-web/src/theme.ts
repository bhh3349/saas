export type ThemeMode = 'dark' | 'light';

const THEME_KEY = 'merchant_theme';

/** 读取初始主题：localStorage 优先，默认暗色（设计稿） */
export function getInitialTheme(): ThemeMode {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

/** 应用主题：设置 <html data-theme> + 持久化 */
export function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

/** 切换并返回新主题 */
export function toggleTheme(current: ThemeMode): ThemeMode {
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
