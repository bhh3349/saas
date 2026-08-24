import { NAV_GROUPS, type GroupKey } from '../data/navigation';
import Icon from './Icon';
import type { ThemeMode } from '../theme';

interface TopBarProps {
  group: GroupKey;
  pageLabel: string;
  onGroupChange: (g: GroupKey) => void;
  shopName: string;
  userName: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export default function TopBar({ group, pageLabel, onGroupChange, shopName, userName, theme, onToggleTheme }: TopBarProps) {
  const groupLabel = NAV_GROUPS.find((g) => g.key === group)?.label ?? '';

  return (
    <header className="topbar">
      <div className="brand-mark" aria-label="食刻">
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.5 8.8a6.5 6.5 0 0 0 13 0Z" fill="#fff" />
          <path d="M3.6 8.1H2.1a.85.85 0 0 0 0 1.7h1.5V8.1Z" fill="#fff" />
          <path d="M16.4 8.1h1.5a.85.85 0 0 1 0 1.7h-1.5V8.1Z" fill="#fff" />
          <path d="M8 5.4c-.7-.9.2-1.7.6-2.6M12 5.4c.7-.9-.2-1.7-.6-2.6" stroke="#fff" strokeWidth="1.15" strokeLinecap="round" opacity=".9" />
        </svg>
      </div>
      <span className="brand-name">食刻 · 商户后台</span>

      <nav className="primary-nav">
        {NAV_GROUPS.map((g) => (
          <button
            key={g.key}
            className={`topbar-tab ${g.key === group ? 'active' : ''}`}
            onClick={() => onGroupChange(g.key)}
          >
            {g.label}
          </button>
        ))}
      </nav>

      <div className="topbar-spacer" />

      <div className="breadcrumb">
        <span>{groupLabel}</span>
        <span className="sep">/</span>
        <span className="current">{pageLabel}</span>
      </div>

      <div className="top-right">
        <div className="global-search">
          <Icon name="search" className="search-icon" />
          <span className="placeholder">搜索订单、菜品、会员…</span>
        </div>

        <div className="status-badge">
          <span className="status-dot" />
          营业中
        </div>

        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'}
          title={theme === 'dark' ? '切换为浅色' : '切换为深色'}
        >
          <Icon name={theme === 'dark' ? 'theme-sun' : 'theme-moon'} className="theme-icon" />
        </button>

        <div className="top-divider" />

        <span className="shop-name">{shopName}</span>
        <div className="avatar" aria-label="用户头像" />
        <span className="user-name">{userName}</span>
      </div>
    </header>
  );
}
