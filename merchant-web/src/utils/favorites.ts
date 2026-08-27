import type { ViewKey } from '../data/navigation';

const FAV_KEY = 'merchant.quick.favs';
export const FAV_EVENT = 'fav-updated';

/** 读取全部收藏的页面 key（按收藏时间先后排列） */
export function getFavorites(): ViewKey[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) {
      return arr.filter(
        (k): k is ViewKey =>
          typeof k === 'string' && (k.startsWith('ops:') || k.startsWith('rpt:')),
      );
    }
  } catch {
    /* 忽略脏数据 */
  }
  return [];
}

export function isFavorite(key: ViewKey): boolean {
  return getFavorites().includes(key);
}

/** 切换收藏状态，返回新状态（true = 已收藏） */
export function toggleFavorite(key: ViewKey): boolean {
  const list = getFavorites();
  const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(FAV_EVENT));
  return next.includes(key);
}
