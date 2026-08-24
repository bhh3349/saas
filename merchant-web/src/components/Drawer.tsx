import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NAV_GROUPS,
  type GroupKey,
  type ViewKey,
  type NavItem,
  type SubMenu,
} from '../data/navigation';
import Icon from './Icon';

interface DrawerProps {
  group: GroupKey;
  activeView: ViewKey;
  onSelect: (viewKey: ViewKey, label: string) => void;
}

export default function Drawer({ group, activeView, onSelect }: DrawerProps) {
  const items = useMemo(
    () => NAV_GROUPS.find((g) => g.key === group)?.items ?? [],
    [group],
  );

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 切换顶部 Tab 时清除悬浮状态
  useEffect(() => {
    setHoveredKey(null);
  }, [group]);

  const hoveredItem = useMemo(
    () => items.find((item) => item.key === hoveredKey) ?? null,
    [hoveredKey, items],
  );

  /** 递归判断子菜单（含三级）是否命中当前视图 */
  const isSubSelected = (s: SubMenu): boolean => {
    if (s.key === activeView) return true;
    return s.children?.some((c) => isSubSelected(c)) ?? false;
  };

  const isSelected = (item: NavItem) => {
    if (item.key === activeView) return true;
    return item.sub?.some((s) => isSubSelected(s)) ?? false;
  };

  const handleItemEnter = (item: NavItem) => {
    if (!item.sub?.length) return;
    const el = itemRefs.current[item.key];
    if (el) setFlyoutTop(el.offsetTop);
    setHoveredKey(item.key);
  };

  const handleItemClick = (item: NavItem) => {
    onSelect(item.key, item.label);
  };

  const handleTagClick = (e: React.MouseEvent, viewKey: ViewKey, label: string) => {
    e.stopPropagation();
    onSelect(viewKey, label);
  };

  return (
    <aside className="drawer" onMouseLeave={() => setHoveredKey(null)}>
      <div className="drawer-scroll">
        {items.map((item) => (
          <div
            key={item.key}
            ref={(el) => {
              itemRefs.current[item.key] = el;
            }}
            className={`nav-item ${isSelected(item) ? 'selected' : ''}`}
            onMouseEnter={() => handleItemEnter(item)}
            onClick={() => handleItemClick(item)}
            title={item.label}
          >
            <Icon name={item.icon} className="nav-icon" />
            <span className="nav-label">{item.label}</span>
          </div>
        ))}
      </div>

      {hoveredItem?.sub && hoveredItem.sub.length > 0 && (
        <div
          className="flyout"
          style={{ top: flyoutTop }}
          onMouseEnter={() => setHoveredKey(hoveredItem.key)}
        >
          <div className="flyout-title">{hoveredItem.label}</div>
          <div className="flyout-tags">
            {hoveredItem.sub.map((sub) =>
              sub.children && sub.children.length > 0 ? (
                <div key={sub.key} className="flyout-group">
                  <div className="flyout-group-title">{sub.label}</div>
                  <div className="flyout-group-tags">
                    {sub.children.map((child) => (
                      <button
                        key={child.key}
                        className={`flyout-tag ${child.key === activeView ? 'active' : ''}`}
                        onClick={(e) => handleTagClick(e, child.key, child.label)}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  key={sub.key}
                  className={`flyout-tag ${sub.key === activeView ? 'active' : ''}`}
                  onClick={(e) => handleTagClick(e, sub.key, sub.label)}
                >
                  {sub.label}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
