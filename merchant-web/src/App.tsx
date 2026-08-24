import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import Drawer from './components/Drawer';
import TabsBar, { type TabItem } from './components/TabsBar';
import AuthScreen from './views/AuthScreen';

/* ---- 页面级懒加载：首屏只加载当前页与框架，其余页面按需拉取 ---- */
const OpsHome = lazy(() => import('./views/OpsHome'));
const TableManage = lazy(() => import('./views/TableManage'));
const ReportHome = lazy(() => import('./views/ReportHome'));
const BizStats = lazy(() => import('./views/BizStats'));
const CheckoutManage = lazy(() => import('./views/CheckoutManage'));
const VoucherManage = lazy(() => import('./views/VoucherManage'));
const DiscountManage = lazy(() => import('./views/DiscountManage'));
const PrintAssign = lazy(() => import('./views/PrintAssign'));
const StallManage = lazy(() => import('./views/StallManage'));
const MustDish = lazy(() => import('./views/MustDish'));
const BusinessMode = lazy(() => import('./views/BusinessMode'));
const DishLibrary = lazy(() => import('./views/DishLibrary'));
const DishCategory = lazy(() => import('./views/DishCategory'));
const DishAttribute = lazy(() => import('./views/DishAttribute'));
const StoreProfile = lazy(() => import('./views/StoreProfile'));
const StaffManage = lazy(() => import('./views/StaffManage'));
const RoleManage = lazy(() => import('./views/RoleManage'));
const PlaceholderView = lazy(() => import('./views/PlaceholderView'));
import { NAV_GROUPS, findViewMeta, type GroupKey, type ViewKey } from './data/navigation';
import { getMeApi } from './api/auth';
import {
  clearAuth,
  getStoredShop,
  getStoredUser,
  getToken,
  setStoredShop,
  setStoredUser,
} from './api/http';
import type { MerchantUser } from './api/types';
import { getInitialTheme, toggleTheme, type ThemeMode } from './theme';

/* 当前页面持久化：刷新后停留在原页面 */
const VIEW_KEY = 'merchant_current_view';
const GROUP_KEY = 'merchant_current_group';
const PAGE_KEY = 'merchant_current_page';
/** 打开的子菜单页签持久化：刷新后保留多页签 */
const TABS_KEY = 'merchant_current_tabs';

function loadStoredView(): ViewKey | null {
  const v = localStorage.getItem(VIEW_KEY);
  if (v && (v.startsWith('ops:') || v.startsWith('rpt:'))) return v as ViewKey;
  return null;
}

function homeOf(group: GroupKey): ViewKey {
  return group === 'rpt' ? 'rpt:home' : 'ops:home';
}

function groupLabel(g: GroupKey): string {
  return NAV_GROUPS.find((x) => x.key === g)?.label ?? '首页';
}

/** 恢复页签：只保留当前分组的子首页和该分组已打开的子页面 */
function loadStoredTabs(): TabItem[] {
  const homeG: GroupKey = localStorage.getItem(GROUP_KEY) === 'rpt' ? 'rpt' : 'ops';
  const homeTab: TabItem = { key: homeOf(homeG), label: groupLabel(homeG) };
  try {
    const raw = localStorage.getItem(TABS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (t: unknown) =>
            !!t &&
            typeof (t as TabItem).key === 'string' &&
            typeof (t as TabItem).label === 'string',
        )
      ) {
        const seen = new Set<string>();
        const rest: TabItem[] = [];
        const prefix = `${homeG}:`;
        for (const t of parsed as TabItem[]) {
          if (t.key.endsWith(':home')) continue; // 首页统一按分组名重建
          if (!t.key.startsWith(prefix)) continue; // 只保留当前分组的子页面
          if (seen.has(t.key)) continue;
          seen.add(t.key);
          rest.push(t);
        }
        return [homeTab, ...rest];
      }
    }
  } catch {
    /* 忽略解析失败，走默认 */
  }
  return [homeTab];
}

function persistTabs(next: TabItem[]) {
  localStorage.setItem(TABS_KEY, JSON.stringify(next));
}

function saveCurrentPage(viewKey: ViewKey, label: string) {
  localStorage.setItem(VIEW_KEY, viewKey);
  localStorage.setItem(GROUP_KEY, viewKey.startsWith('rpt:') ? 'rpt' : 'ops');
  localStorage.setItem(PAGE_KEY, label);
}

/** viewKey ↔ URL hash 映射（如 ops:dish:library ↔ #/ops/dish/library） */
function viewKeyToHash(v: ViewKey): string {
  return `#/${v.replace(/:/g, '/')}`;
}

function hashToViewKey(hash: string): ViewKey | null {
  const h = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!h) return null;
  const v = h.replace(/\//g, ':') as ViewKey;
  return findViewMeta(v) ? v : null;
}

/** 将当前视图同步到地址栏 hash */
function syncHash(v: ViewKey) {
  const target = viewKeyToHash(v);
  if (window.location.hash !== target) window.location.hash = target;
}

/** 页面懒加载占位：避免 chunk 拉取期间白屏 */
function PageFallback() {
  return <div className="page-loading">加载中…</div>;
}

export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken());
  const [user, setUser] = useState<MerchantUser | null>(() => getStoredUser<MerchantUser>());
  const [shopName, setShopName] = useState(() => getStoredShop());
  const [group, setGroup] = useState<GroupKey>(() =>
    localStorage.getItem(GROUP_KEY) === 'rpt' ? 'rpt' : 'ops',
  );
  const [view, setView] = useState<ViewKey>(
    () => hashToViewKey(window.location.hash) ?? loadStoredView() ?? 'ops:home',
  );
  const [pageLabel, setPageLabel] = useState(() => localStorage.getItem(PAGE_KEY) || groupLabel('ops'));
  /** 已打开的子菜单页签 */
  const [tabs, setTabs] = useState<TabItem[]>(() => loadStoredTabs());
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [homeTick, setHomeTick] = useState(0);

  /** 启动时校验会话：有 token → GET /auth/me 刷新用户信息；失效则清会话回登录页 */
  useEffect(() => {
    if (!getToken()) {
      return;
    }
    getMeApi()
      .then((me) => {
        setUser(me);
        setStoredUser(me);
        if (me.shopName) {
          setShopName(me.shopName);
          setStoredShop(me.shopName);
        }
        setAuthed(true);
      })
      .catch(() => {
        clearAuth();
        setAuthed(false);
      });
  }, []);

  /** 地址栏 hash 变化（手动改 URL / 前进后退 / 直接输入带路径的网址）→ 同步页面与页签 */
  useEffect(() => {
    const onHashChange = () => {
      const v = hashToViewKey(window.location.hash);
      if (!v) return;
      const meta = findViewMeta(v);
      const label = meta?.label ?? '首页';
      const g: GroupKey = v.startsWith('rpt:') ? 'rpt' : 'ops';
      setView(v);
      setPageLabel(label);
      setGroup(g);
      saveCurrentPage(v, label);
      setTabs((prev) => {
        const tabLabel = v.endsWith(':home') ? groupLabel(g) : label;
        if (prev.some((t) => t.key === v)) {
          const cur = prev.find((t) => t.key === v);
          if (cur && cur.label !== tabLabel) {
            const next = prev.map((t) => (t.key === v ? { ...t, label: tabLabel } : t));
            persistTabs(next);
            return next;
          }
          return prev;
        }
        const next = [...prev, { key: v, label: tabLabel }];
        persistTabs(next);
        return next;
      });
      if (v === 'ops:home') setHomeTick((t) => t + 1);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  /** 登录/进入主框架后，保证地址栏 hash 与当前视图一致（首次进入时写入默认 hash） */
  useEffect(() => {
    if (authed && hashToViewKey(window.location.hash) !== view) {
      window.location.hash = viewKeyToHash(view);
    }
  }, [authed, view]);

  /** 点击菜单 / 子菜单 → 打开或激活对应页签（切到首页时递增 tick，强制 OpsHome 重 mount 触发刷新动画） */
  const handleSelect = useCallback((viewKey: ViewKey, label: string) => {
    const g: GroupKey = viewKey.startsWith('rpt:') ? 'rpt' : 'ops';
    setView(viewKey);
    setPageLabel(label);
    setGroup(g);
    saveCurrentPage(viewKey, label);
    syncHash(viewKey);
    /** 子首页页签固定用分组名展示（运营中心 / 报表中心） */
    const tabLabel = viewKey.endsWith(':home') ? groupLabel(g) : label;
    setTabs((prev) => {
      if (prev.some((t) => t.key === viewKey)) {
        const cur = prev.find((t) => t.key === viewKey);
        if (cur && cur.label !== tabLabel) {
          const next = prev.map((t) => (t.key === viewKey ? { ...t, label: tabLabel } : t));
          persistTabs(next);
          return next;
        }
        return prev; // 已打开，仅激活
      }
      const next = [...prev, { key: viewKey, label: tabLabel }];
      persistTabs(next);
      return next;
    });
    if (viewKey === 'ops:home') setHomeTick((t) => t + 1);
  }, []);

  /** 切换顶部 Tab（运营中心 / 报表中心）→ 切换到该组首页，并只保留该组子首页 */
  const handleGroupChange = useCallback(
    (g: GroupKey) => {
      const home = homeOf(g);
      const homeLabel = groupLabel(g);
      setView(home);
      setPageLabel('首页');
      setGroup(g);
      saveCurrentPage(home, '首页');
      syncHash(home);
      const homeTabs = [{ key: home, label: homeLabel }];
      setTabs(homeTabs);
      persistTabs(homeTabs);
      if (home === 'ops:home') setHomeTick((t) => t + 1);
    },
    [],
  );

  /** 点击页签 → 切换到该页面 */
  const handleTabSelect = useCallback(
    (key: ViewKey) => {
      const tab = tabs.find((t) => t.key === key);
      if (!tab) return;
      const label = key.endsWith(':home') ? '首页' : tab.label;
      setView(key);
      setPageLabel(label);
      setGroup(key.startsWith('rpt:') ? 'rpt' : 'ops');
      saveCurrentPage(key, label);
      syncHash(key);
      if (key === 'ops:home') setHomeTick((t) => t + 1);
    },
    [tabs],
  );

  /** 关闭页签：若关闭的是当前页签，则激活相邻页签；全部关闭则回该组首页 */
  const handleTabClose = useCallback(
    (key: ViewKey) => {
      const idx = tabs.findIndex((t) => t.key === key);
      if (idx < 0) return;
      const next = tabs.filter((t) => t.key !== key);
      persistTabs(next);
      setTabs(next);
      if (key !== view) return;
      const neighbor = next[Math.min(idx, next.length - 1)];
      if (neighbor) {
        setView(neighbor.key);
        setPageLabel(neighbor.label);
        setGroup(neighbor.key.startsWith('rpt:') ? 'rpt' : 'ops');
        saveCurrentPage(neighbor.key, neighbor.label);
        syncHash(neighbor.key);
        if (neighbor.key === 'ops:home') setHomeTick((t) => t + 1);
      } else {
        const homeGroup = key.startsWith('rpt:') ? 'rpt' : 'ops';
        const home = homeOf(homeGroup);
        const homeLabel = groupLabel(homeGroup);
        setView(home);
        setPageLabel('首页');
        setGroup(homeGroup);
        saveCurrentPage(home, '首页');
        syncHash(home);
        const homeTabs = [{ key: home, label: homeLabel }];
        setTabs(homeTabs);
        persistTabs(homeTabs);
        if (home === 'ops:home') setHomeTick((t) => t + 1);
      }
    },
    [tabs, view],
  );

  /** 关闭全部页签（保留当前分组的首页页签） */
  const handleClearTabs = useCallback(() => {
    const home = homeOf(group);
    const homeLabel = groupLabel(group);
    setView(home);
    setPageLabel('首页');
    saveCurrentPage(home, '首页');
    syncHash(home);
    const homeTabs = [{ key: home, label: homeLabel }];
    setTabs(homeTabs);
    persistTabs(homeTabs);
    if (home === 'ops:home') setHomeTick((t) => t + 1);
  }, [group]);

  /** 登录成功：boss 角色进入主框架（携带后端下发的真实店铺名） */
  const handleLogin = useCallback((u: MerchantUser, shopName: string) => {
    setUser(u);
    setStoredUser(u);
    if (shopName) {
      setShopName(shopName);
      setStoredShop(shopName);
    }
    setAuthed(true);
  }, []);

  /** 黑白主题切换 */
  const handleToggleTheme = useCallback(() => {
    setTheme((t) => toggleTheme(t));
  }, []);

  /* ---- 未登录：登录页（自适应容器，内容居中） ---- */
  if (!authed) {
    return (
      <div className="app app-auth">
        <AuthScreen onLogin={handleLogin} />
      </div>
    );
  }

  /* ---- 已登录：主框架（流式自适应布局） ---- */
  /** 按 viewKey 渲染页面内容 */
  const renderView = (v: ViewKey): React.ReactNode => {
    switch (v) {
      case 'ops:home':
        return <OpsHome key={homeTick} />;
      case 'ops:restaurant:table':
        return <TableManage onNavigate={handleSelect} />;
      case 'ops:checkout':
        return <CheckoutManage />;
      case 'ops:checkout:coupon':
        return <VoucherManage />;
      case 'ops:checkout:discount':
        return <DiscountManage />;
      case 'ops:print:assign':
        return <PrintAssign />;
      case 'ops:print:station':
        return <StallManage />;
      case 'ops:business:must':
        return <MustDish />;
      case 'ops:business:mode':
        return <BusinessMode />;
      case 'ops:dish:library':
        return <DishLibrary />;
      case 'ops:dish:category':
        return <DishCategory />;
      case 'ops:dish:attribute':
        return <DishAttribute />;
      case 'ops:archive:store':
        return <StoreProfile />;
      case 'ops:archive:staff':
        return <StaffManage />;
      case 'ops:archive:role':
        return <RoleManage />;
      case 'rpt:home':
        return <ReportHome />;
      case 'rpt:biz-stats':
        return <BizStats />;
      default:
        return <PlaceholderView title={pageLabel} />;
    }
  };

  return (
    <div className="app">
      <TopBar
        group={group}
        pageLabel={pageLabel}
        onGroupChange={handleGroupChange}
        shopName={shopName || (user?.name ? `${user.name}的店` : '我的店铺')}
        userName={user?.name || user?.phone || ''}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
      <div className="app-body">
        <Drawer group={group} activeView={view} onSelect={handleSelect} />
        <main className="main">
          <TabsBar
            tabs={tabs}
            activeKey={view}
            onSelect={handleTabSelect}
            onClose={handleTabClose}
            onClear={handleClearTabs}
          />
          <div className="main-frame">
            <Suspense fallback={<PageFallback />}>
              {tabs.map((t) => (
                <div
                  key={t.key}
                  className={`tab-pane ${view === t.key ? 'active' : ''}`}
                  style={{ display: view === t.key ? 'flex' : 'none' }}
                >
                  {renderView(t.key)}
                </div>
              ))}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
