import { useCallback, useEffect, useState } from 'react';
import {
  DailyReportRow,
  fetchDailyReport,
  fetchReportSummary,
  fetchTableStats,
  MethodSummary,
  ReportSummary,
} from '../api/reports';
import { listTablesApi } from '../api/tables';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import StatCard from '../components/StatCard';
import TrendChart from '../components/report/TrendChart';
import { useToast } from '../components/report/useToast';
import Toast from '../components/Toast';
import { findViewMeta, ViewKey } from '../data/navigation';
import { FAV_EVENT, getFavorites } from '../utils/favorites';

const TABS = ['日', '周', '月'] as const;

/** 报表中心快捷入口：点击跳转到对应报表页面 */
const QUICK_ENTRIES: { key: ViewKey; label: string; tile: string }[] = [
  { key: 'rpt:biz-stats', label: '综合营业统计', tile: 'report' },
  { key: 'rpt:compare', label: '营业指标同环比', tile: 'table' },
  { key: 'rpt:dish-sales', label: '菜品销售统计', tile: 'dish' },
  { key: 'rpt:promo-stats', label: '促销活动统计', tile: 'print' },
  { key: 'rpt:in-store-orders', label: '店内订单明细', tile: 'open' },
  { key: 'rpt:dish-refund', label: '退菜统计', tile: 'member' },
  { key: 'rpt:income-discount', label: '收入优惠统计', tile: 'checkout' },
  { key: 'rpt:income-coupon', label: '券收入统计', tile: 'settings' },
];

/** 报表中心首页：收藏的报表页快捷入口（排除默认已有的） */
function buildFavEntries(): { key: ViewKey; label: string; fav: boolean }[] {
  return getFavorites()
    .filter((k) => k.startsWith('rpt:') && k !== 'rpt:home')
    .map((k) => ({ key: k, label: findViewMeta(k)?.label ?? k, fav: true }))
    .filter((e) => !QUICK_ENTRIES.some((q) => q.key === e.key));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 按 日/周/月 计算查询区间 */
function rangeFor(tab: string): { from: string; to: string } {
  const now = new Date();
  const today = fmt(now);
  if (tab === '日') return { from: today, to: today };
  if (tab === '周') {
    const day = now.getDay() || 7; // 周日=7
    return {
      from: fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)),
      to: today,
    };
  }
  return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

interface ReportHomeProps {
  onNavigate?: (key: ViewKey, label: string) => void;
}

export default function ReportHome({ onNavigate }: ReportHomeProps) {
  const [activeTab, setActiveTab] = useState<string>('日');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [usedTables, setUsedTables] = useState(0);
  const [tableTotal, setTableTotal] = useState(0);
  const [trendRows, setTrendRows] = useState<DailyReportRow[]>([]);
  const [favEntries, setFavEntries] = useState(() => buildFavEntries());
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = rangeFor(activeTab);
      // 趋势图：日 tab 展示近 7 天走势，周/月展示区间内每日数据
      const now = new Date();
      const trendFrom =
        activeTab === '日'
          ? fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
          : from;
      const [sum, tableStats, tables, trend] = await Promise.all([
        fetchReportSummary({ from, to }),
        fetchTableStats({ from, to, page_size: 100 }),
        listTablesApi({ page_size: 100 }),
        fetchDailyReport({ from: trendFrom, to }),
      ]);
      setSummary(sum);
      setUsedTables(tableStats.items.length);
      setTableTotal(tables.total);
      setTrendRows(trend.items);
    } catch (e) {
      notify({ type: 'error', text: (e as Error).message || '营业概览加载失败' });
    } finally {
      setLoading(false);
    }
  }, [activeTab, notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onFav = () => setFavEntries(buildFavEntries());
    window.addEventListener(FAV_EVENT, onFav);
    return () => window.removeEventListener(FAV_EVENT, onFav);
  }, []);

  const revenue = summary?.revenue ?? 0;
  const orderCount = summary?.order_count ?? 0;
  const avg = orderCount > 0 ? revenue / orderCount : 0;
  const usage = tableTotal > 0 ? (usedTables / tableTotal) * 100 : 0;
  const methods: MethodSummary[] = summary?.methods ?? [];
  const totalAmount = methods.reduce((s, m) => s + m.amount, 0);

  return (
    <div className="page">
      <Toast toast={toast} onClose={close} />
      <div className="page-head">
        <h1 className="page-title">营业概览</h1>
      </div>

      <div className="report-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`pill-tab ${tab === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="stats-row">
        <StatCard label="营业额" value={`¥${revenue.toFixed(2)}`} loading={loading} sub={`${summary?.from ?? '—'} 至 ${summary?.to ?? '—'}`} />
        <StatCard label="订单数" value={`${orderCount} 单`} loading={loading} sub="已结账订单" />
        <StatCard label="客单价" value={`¥${avg.toFixed(2)}`} loading={loading} sub="营业额 ÷ 订单数" />
        <StatCard label="桌台使用率" value={`${usage.toFixed(0)}%`} loading={loading} sub={`${usedTables}/${tableTotal} 桌有单`} />
      </div>

      <div className="home-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="panel">
            <div className="panel-head">
              <div className="panel-title">营业趋势</div>
              <div className="panel-more">{activeTab === '日' ? '近 7 日 · 按日' : `${summary?.from ?? '—'} 至 ${summary?.to ?? '—'} · 按日`}</div>
            </div>
            <div className="panel-body report-chart">
              {trendRows.length === 0 ? (
                <EmptyState title="暂无数据" />
              ) : (
                <TrendChart
                  data={trendRows}
                  xLabel={(r) => r.date.slice(5)}
                  series={[
                    { key: 'revenue', name: '营业额', color: '#D5432A', axis: 'left', format: (v) => `¥${v.toFixed(2)}` },
                    { key: 'order_count', name: '订单数', color: '#C8903B', axis: 'right', format: (v) => `${v} 单` },
                  ]}
                />
              )}
            </div>
          </section>

          <section className="panel" style={{ flex: 1, minHeight: 0 }}>
            <div className="panel-head">
              <div className="panel-title">收入构成</div>
              {methods.length > 0 && <div className="panel-more">按结账方式</div>}
            </div>
            <div className="panel-body report-chart">
              {methods.length === 0 ? (
                <EmptyState title="暂无数据" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 560, padding: '8px 4px' }}>
                  {methods.map((m) => {
                    const pct = totalAmount > 0 ? (m.amount / totalAmount) * 100 : 0;
                    return (
                      <div key={m.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                          <span>{m.name}</span>
                          <span style={{ color: 'var(--color-text-2)' }}>
                            {m.order_count} 单 · ¥{m.amount.toFixed(2)} · {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ height: 10, borderRadius: 5, background: 'var(--color-surface3)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 5, background: 'var(--color-primary)', width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="panel quick-panel">
          <div className="panel-head">
            <div className="panel-title">快捷入口</div>
          </div>
          <div className="panel-body">
            <div className="quick-grid">
              {[...favEntries, ...QUICK_ENTRIES.map((q) => ({ ...q, fav: false }))].map((entry) => (
                <div
                  key={entry.key}
                  className="quick-item"
                  title={entry.label}
                  onClick={() => onNavigate?.(entry.key, entry.label)}
                >
                  {entry.fav ? (
                    <div className="quick-tile fav">
                      <Icon name="star-filled" />
                    </div>
                  ) : (
                    <div className={`quick-tile ${entry.tile}`} />
                  )}
                  <span className="quick-label">{entry.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
