import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DailyReportRow,
  defaultRange,
  fetchDailyReport,
  fetchOrders,
  OrderRow,
} from '../api/reports';
import { listTablesApi } from '../api/tables';
import EmptyState from '../components/EmptyState';
import StatCard from '../components/StatCard';
import ReportToolbar from '../components/report/ReportToolbar';
import TrendChart from '../components/report/TrendChart';
import { useToast } from '../components/report/useToast';
import Toast from '../components/Toast';
import FavStar from '../components/FavStar';
import { exportAoaToXlsx } from '../utils/excel';

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

export default function BizStats() {
  const def = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [query, setQuery] = useState({ from: def.from, to: def.to });
  const [rows, setRows] = useState<DailyReportRow[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{ date: string; orders: OrderRow[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, tables] = await Promise.all([
        fetchDailyReport({ from: query.from, to: query.to }),
        listTablesApi({ page_size: 100 }),
      ]);
      setRows(res.items);
      setTableTotal(tables.total);
    } catch (e) {
      notify({ type: 'error', text: (e as Error).message || '营业统计加载失败' });
    } finally {
      setLoading(false);
    }
  }, [query, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.order_count, 0);
  const avgAmount = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const openDetail = async (date: string) => {
    setDetailLoading(true);
    setDetail({ date, orders: [] });
    try {
      const res = await fetchOrders({ from: date, to: date, page_size: 100 });
      setDetail({ date, orders: res.items });
    } catch (e) {
      notify({ type: 'error', text: (e as Error).message || '当日订单加载失败' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = () => {
    if (rows.length === 0) {
      notify({ type: 'error', text: '没有可导出的数据' });
      return;
    }
    const aoa: (string | number)[][] = [
      ['日期', '营业额(元)', '订单数', '客单价(元)', '有单桌台数'],
      ...rows.map((r) => [r.date, r.revenue, r.order_count, r.avg_amount, r.table_count]),
      ['合计', +totalRevenue.toFixed(2), totalOrders, +avgAmount.toFixed(2), ''],
    ];
    exportAoaToXlsx(aoa, { filename: `综合营业统计_${from}_${to}` });
  };

  return (
    <div className="page">
      <Toast toast={toast} onClose={close} />
      <div className="page-head">
        <h1 className="page-title">综合营业统计</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:biz-stats" />
        </div>
      </div>

      <ReportToolbar
        from={from}
        to={to}
        onRangeChange={(f, t) => {
          setFrom(f);
          setTo(t);
        }}
        onQuery={() => setQuery({ from, to })}
        onReset={() => {
          setFrom(def.from);
          setTo(def.to);
          setQuery({ from: def.from, to: def.to });
        }}
        actions={
          <button className="tm-btn tm-btn-default" type="button" onClick={handleExport}>
            导出
          </button>
        }
      />

      <div className="stats-row">
        <StatCard label="区间营业额" value={`¥${totalRevenue.toFixed(2)}`} loading={loading} sub={`${query.from} 至 ${query.to}`} />
        <StatCard label="订单总数" value={`${totalOrders} 单`} loading={loading} sub="已结账订单" />
        <StatCard label="区间客单价" value={`¥${avgAmount.toFixed(2)}`} loading={loading} sub="营业额 ÷ 订单数" />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div className="panel-title">营业趋势</div>
          <div className="panel-more">{query.from} 至 {query.to} · 按日</div>
        </div>
        <div className="panel-body report-chart">
          {rows.length === 0 ? (
            <EmptyState title="暂无数据" desc="选择时间范围后查看营业趋势" />
          ) : (
            <TrendChart
              data={rows}
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
          <div className="panel-title">营业明细</div>
        </div>
        <div className="panel-body">
          <div className="data-table biz-cols-table">
            <div className="area-table-scroll checkout-scroll">
              <table className="checkout-real-table biz-cols-table">
                <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '24%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="th-center">日期</th>
                    <th className="th-center">营业额</th>
                    <th className="th-center">订单数</th>
                    <th className="th-center">客单价</th>
                    <th className="th-center">桌台使用率</th>
                    <th className="th-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ height: 180, textAlign: 'center', padding: 0 }}>
                        <EmptyState title="暂无数据" desc="选择时间范围后查看营业明细" />
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const usage = tableTotal > 0 ? (r.table_count / tableTotal) * 100 : 0;
                      return (
                        <tr key={r.date}>
                          <td className="td-center">{r.date}</td>
                          <td className="td-center">¥{r.revenue.toFixed(2)}</td>
                          <td className="td-center">{r.order_count} 单</td>
                          <td className="td-center">¥{r.avg_amount.toFixed(2)}</td>
                          <td className="td-center">
                            {r.order_count > 0 ? `${usage.toFixed(0)}%` : '—'}
                          </td>
                          <td className="td-center">
                            <div className="row-actions" style={{ justifyContent: 'center' }}>
                              <button
                                className="action-link"
                                type="button"
                                onClick={() => openDetail(r.date)}
                              >
                                查看
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {detail && (
        <div className="modal-mask" onClick={() => setDetail(null)}>
          <div className="modal-card" style={{ width: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">当日订单 · {detail.date}</div>
              <button className="modal-close" onClick={() => setDetail(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-2)' }}>加载中…</div>
              ) : detail.orders.length === 0 ? (
                <EmptyState title="当日暂无订单" />
              ) : (
                <table className="checkout-real-table">
                  <colgroup>
                    <col style={{ width: 90 }} />
                    <col />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 100 }} />
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
                    {detail.orders.map((o) => (
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
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-primary" onClick={() => setDetail(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
