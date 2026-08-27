import { useState } from 'react';
import type { ViewKey } from '../data/navigation';
import { isFavorite, toggleFavorite } from '../utils/favorites';
import Icon from './Icon';

/**
 * 页面右上角收藏星标：点亮后将该页面加入所属首页（运营中心/报表中心）的快捷入口。
 */
export default function FavStar({ viewKey }: { viewKey: ViewKey }) {
  const [fav, setFav] = useState(() => isFavorite(viewKey));
  return (
    <button
      type="button"
      className={`fav-star ${fav ? 'active' : ''}`}
      title={fav ? '取消快捷入口' : '加入首页快捷入口'}
      onClick={(e) => {
        e.stopPropagation();
        setFav(toggleFavorite(viewKey));
      }}
    >
      <Icon name={fav ? 'star-filled' : 'star'} />
    </button>
  );
}

/**
 * 子页包装容器：右上角悬浮星标，不侵入页面自身布局。
 * 用于页头右侧无操作区的页面（运营中心子页）。
 */
export function FavPage({ viewKey, children }: { viewKey: ViewKey; children: React.ReactNode }) {
  return (
    <div className="fav-page">
      <FavStar viewKey={viewKey} />
      {children}
    </div>
  );
}
