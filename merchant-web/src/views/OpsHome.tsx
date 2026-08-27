import { useCallback, useEffect, useState } from 'react';
import {
  defaultRange,
  fetchDishRefund,
  fetchOrders,
  fetchReportSummary,
  fetchTableStats,
  OrderRow,
} from '../api/reports';
import { listTablesApi } from '../api/tables';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import StatCard from '../components/StatCard';
import { useToast } from '../components/report/useToast';
import Toast from '../components/Toast';
import { findViewMeta, ViewKey } from '../data/navigation';
import { FAV_EVENT, getFavorites } from '../utils/favorites';

const QUICK_ENTRIES = [
  { label: '开台点餐', tile: 'open' },
  { label: '桌台管理', tile: 'table' },
  { label: '菜品管理', tile: 'dish' },
  { label: '会员营销', tile: 'member' },
  { label: '结账收银', tile: 'checkout' },
  { label: '打印管理', tile: 'print' },
  { label: '营业报表', tile: 'report' },
  { label: '经营设置', tile: 'settings' },
] as const;

/** 运营中心首页：收藏的运营子页快捷入口（金色星标） */
function buildFavEntries(): { key: ViewKey; label: string }[] {
  return getFavorites()
    .filter((k) => k.startsWith('ops:') && k !== 'ops:home')
    .map((k) => ({ key: k, label: findViewMeta(k)?.label ?? k }));
}

function formatToday(): string {
  const now = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d} ${weekdays[now.getDay()]}`;
}

function fmtTime(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

const statusText: Record<string, string> = {
  completed: '已结账',
  on_account: '挂账',
  pending: '待接单',
  void: '已作废',
};

interface OpsHomeProps {
  onNavigate?: (key: ViewKey, label: string) => void;
}

export default function OpsHome({ onNavigate }: OpsHomeProps) {
  const [loading, setLoading] = useState(true);
  const [favEntries, setFavEntries] = useState(() => buildFavEntries());
  const [summary, setSummary] = useState<{ revenue: number; order_count: number } | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [usedTables, setUsedTables] = useState(0);
  const [tableTotal, setTableTotal] = useState(0);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = defaultRange().to; // 今天
      const [sum, tableStats, refund, orderRes, tables] = await Promise.all([
        fetchReportSummary({ from: today, to: today }),
        fetchTableStats({ from: today, to: today, page_size: 100 }),
        fetchDishRefund({ from: today, to: today }),
        fetchOrders({ from: today, to: today, page_size: 100 }),
        listTablesApi({ page_size: 100 }),
      ]);
      setSummary({ revenue: sum.revenue, order_count: sum.order_count });
      setRefundAmount(refund.summary?.total_amount ?? 0);
      setUsedTables(tableStats.items.length);
      setTableTotal(tables.total);
      setOrders(orderRes.items);
    } catch (e) {
      notify({ type: 'error', text: (e as Error).message || '首页数据加载失败' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFav = () => setFavEntries(buildFavEntries());
    window.addEventListener(FAV_EVENT, onFav);
    return () => window.removeEventListener(FAV_EVENT, onFav);
  }, []);

  const avg = summary && summary.order_count > 0 ? summary.revenue / summary.order_count : 0;
  const usage = tableTotal > 0 ? (usedTables / tableTotal) * 100 : 0;

  return (
    <div className={`page ${loading ? 'is-refreshing' : ''}`}>
      <Toast toast={toast} onClose={close} />
      <div className="page-head">
        <h1 className="page-title">首页</h1>
        <div className="page-head-right">
          <button
            className="refresh-btn"
            onClick={load}
            disabled={loading}
            aria-label="刷新首页数据"
            title="刷新首页数据"
          >
            <Icon name="refresh" className={`refresh-icon ${loading ? 'spin' : ''}`} />
            <span>{loading ? '刷新中…' : '刷新'}</span>
          </button>
          <div className="date-badge">{formatToday()}</div>
        </div>
      </div>

      <div className="stats-row">
        <StatCard label="今日营业额" value={`¥${(summary?.revenue ?? 0).toFixed(2)}`} loading={loading} sub="实收金额" />
        <StatCard label="今日订单" value={`${summary?.order_count ?? 0} 单`} loading={loading} sub="已结账订单" />
        <StatCard label="客单价" value={`¥${avg.toFixed(2)}`} loading={loading} sub="营业额 ÷ 订单数" />
        <StatCard
          label="桌台使用率"
          value={`${usage.toFixed(0)}%`}
          loading={loading}
          sub={`${usedTables}/${tableTotal} 桌有单`}
        />
        <StatCard label="今日退款" value={`¥${refundAmount.toFixed(2)}`} loading={loading} sub="退菜/拒单退款" />
      </div>

      <div className="home-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        <section className="panel" style={{ flex: 1, minWidth: 0 }}>
          <div className="panel-head">
            <div className="panel-title">当日订单</div>
          </div>
          <div className="panel-body">
            <div className="data-table">
              <div className="area-table-scroll checkout-scroll">
                <table className="checkout-real-table">
                  <colgroup>
                    <col style={{ width: 100 }} />
                    <col />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 120 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="th-center">时间</th>
                      <th>订单号</th>
                      <th>桌台</th>
                      <th className="th-center">金额</th>
                      <th className="th-center">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ height: 160, textAlign: 'center', padding: 0 }}>
                          <EmptyState title="今日暂无订单" />
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id}>
                          <td className="td-center">{fmtTime(o.settled_at ?? o.created_at)}</td>
                          <td>{o.order_no}</td>
                          <td>{o.table_name ?? '—'}</td>
                          <td className="td-center">¥{o.paid_amount.toFixed(2)}</td>
                          <td className="td-center">
                            <span className={`status-tag ${o.status === 'completed' ? 'status-on' : ''}`}>
                              {statusText[o.status] ?? o.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="panel quick-panel">
          <div className="panel-head">
            <div className="panel-title">快捷入口</div>
          </div>
          <div className="panel-body">
            <div className="quick-grid">
              {favEntries.map((entry) => (
                <div
                  key={entry.key}
                  className="quick-item"
                  title={entry.label}
                  onClick={() => onNavigate?.(entry.key, entry.label)}
                >
                  <div className="quick-tile fav">
                    <Icon name="star-filled" />
                  </div>
                  <span className="quick-label">{entry.label}</span>
                </div>
              ))}
              {QUICK_ENTRIES.map((entry) => (
                <div key={entry.label} className="quick-item" title={entry.label}>
                  <div className={`quick-tile ${entry.tile}`} />
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
