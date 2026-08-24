import { useEffect, useRef } from 'react';
import type { ViewKey } from '../data/navigation';

export interface TabItem {
  key: ViewKey;
  label: string;
}

interface TabsBarProps {
  tabs: TabItem[];
  activeKey: ViewKey;
  onSelect: (key: ViewKey) => void;
  onClose: (key: ViewKey) => void;
  onClear: () => void;
}

/** 子菜单导航页签栏：类似浏览器多标签页，支持切换 / 单独关闭 / 全部关闭 */
export default function TabsBar({
  tabs,
  activeKey,
  onSelect,
  onClose,
  onClear,
}: TabsBarProps) {
  const listRef = useRef<HTMLDivElement>(null);

  /** 激活页签变化时滚动到可视区域 */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.pill-tab-item.active');
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeKey, tabs.length]);

  return (
    <div className="pill-tabs">
      <div className="pill-tabs-nav">
        <div className="pill-tabs-list" ref={listRef}>
          {tabs.map((t) => {
            const isHome = t.key === 'ops:home' || t.key === 'rpt:home';
            return (
              <div
                key={t.key}
                className={`pill-tab-item ${t.key === activeKey ? 'active' : ''}`}
                onClick={() => onSelect(t.key)}
                title={t.label}
              >
                <span className="pill-tab-text">{t.label}</span>
                {!isHome && (
                  <span
                    className="pill-tab-close"
                    role="button"
                    aria-label={`关闭 ${t.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(t.key);
                    }}
                  >
                    ×
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {tabs.length > 1 && (
        <span
          className="pill-tabs-clear"
          role="button"
          title="关闭全部页签"
          aria-label="关闭全部页签"
          onClick={onClear}
        >
          <svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M899.1 869.6l-53-305.6H864c14.4 0 26-11.6 26-26V346c0-14.4-11.6-26-26-26H618V138c0-14.4-11.6-26-26-26H432c-14.4 0-26 11.6-26 26v182H160c-14.4 0-26 11.6-26 26v192c0 14.4 11.6 26 26 26h17.9l-53 305.6a25.95 25.95 0 0025.6 30.4h723c1.5 0 3-.1 4.4-.4a25.88 25.88 0 0021.2-30zM204 390h272V182h72v208h272v104H204V390zm468 440V674c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8v156H416V674c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8v156H202.8l45.1-260H776l45.1 260H672z" />
          </svg>
        </span>
      )}
    </div>
  );
}
