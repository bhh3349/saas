import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  OrderRow,
  OrdersResult,
  ReportSummary,
  defaultRange,
  fetchOrders,
  fetchReportSummary,
} from '../../api/reports';
import ReportTable, { ReportColumn } from '../../components/report/ReportTable';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import FavStar from '../../components/FavStar';
import { exportAoaToXlsx } from '../../utils/excel';

const modeText: Record<string, string> = { table: '堂食', ticket: '外带' };
const statusText: Record<string, string> = { completed: '已结账', on_account: '挂账' };

function fmtTime(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function itemsSummary(items: OrderRow['items']): string {
  return items
    .map((it) => `${it.name}${it.spec_name ? `(${it.spec_name})` : ''}×${it.qty}`)
    .join('、');
}

export default function InStoreOrders() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [status, setStatus] = useState('all');
  const [method, setMethod] = useState('all');
  const [tableName, setTableName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState({
    from: range.from,
    to: range.to,
    status: 'all',
    method: 'all',
    table_name: '',
    keyword: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<OrdersResult | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const methodOptions = useMemo(
    () => (summary?.methods ?? []).map((m) => m.name),
    [summary],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, sum] = await Promise.all([
        fetchOrders({
          from: query.from,
          to: query.to,
          page,
          page_size: pageSize,
          status: query.status,
          method: query.method,
          table_name: query.table_name || undefined,
          keyword: query.keyword || undefined,
        }),
        fetchReportSummary({ from: query.from, to: query.to }),
      ]);
      setData(res);
      setSummary(sum);
    } catch (e) {
      notify({ type: 'error', text: (e as Error).message || '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ReportColumn<OrderRow>[] = [
    { key: 'seq', title: '序号', width: 60, align: 'center', render: (_, i) => (page - 1) * pageSize + i + 1 },
    { key: 'order_no', title: '订单号', width: 130, render: (r) => r.order_no },
    { key: 'settled_at', title: '结账时间', width: 110, render: (r) => fmtTime(r.settled_at) },
    { key: 'mode', title: '类型', width: 70, align: 'center', render: (r) => modeText[r.mode] ?? r.mode },
    {
      key: 'place',
      title: '桌台/取餐号',
      width: 100,
      align: 'center',
      render: (r) => (r.mode === 'table' ? r.table_name ?? '—' : r.ticket_no ? `#${r.ticket_no}` : '—'),
    },
    { key: 'items', title: '品项', minWidth: 180, render: (r) => itemsSummary(r.items) },
    { key: 'total_amount', title: '应付(元)', width: 95, align: 'right', render: (r) => r.total_amount.toFixed(2) },
    { key: 'paid_amount', title: '实收(元)', width: 95, align: 'right', strong: true, render: (r) => r.paid_amount.toFixed(2) },
    { key: 'payment_method_name', title: '结账方式', width: 95, render: (r) => r.payment_method_name ?? '—' },
    { key: 'status', title: '状态', width: 75, align: 'center', render: (r) => <span className={`tag ${r.status}`}>{statusText[r.status] ?? r.status}</span> },
    { key: 'remark', title: '备注', width: 120, render: (r) => r.remark || '—' },
  ];

  const handleExport = async () => {
    if (!data || data.items.length === 0) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['序号', '订单号', '结账时间', '类型', '桌台/取餐号', '品项', '应付(元)', '实收(元)', '结账方式', '状态', '备注'];
    const body = data.items.map((r, i) => [
      String((page - 1) * pageSize + i + 1),
      r.order_no,
      fmtTime(r.settled_at),
      modeText[r.mode] ?? r.mode,
      r.mode === 'table' ? (r.table_name ?? '') : r.ticket_no ? `#${r.ticket_no}` : '',
      itemsSummary(r.items),
      r.total_amount.toFixed(2),
      r.paid_amount.toFixed(2),
      r.payment_method_name ?? '',
      statusText[r.status] ?? r.status,
      r.remark ?? '',
    ]);
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `店内订单明细_${query.from}_${query.to}.xlsx`,
        sheetName: '店内订单明细',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">店内订单明细</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:in-store-orders" />
          <span className="hint-text">已结账 + 挂账订单明细，按结账时间倒序</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="订单数(已结账)" value={String(summary?.order_count ?? 0)} />
        <StatCard label="营业额(元)" value={(summary?.revenue ?? 0).toFixed(2)} />
        <StatCard label="挂账待收(元)" value={(summary?.pending_receivable ?? 0).toFixed(2)} />
      </div>

      <div className="panel">
        <ReportToolbar
          from={from}
          to={to}
          onRangeChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
          extra={
            <>
              <select className="ant-input search-input report-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 100 }}>
                <option value="all">全部状态</option>
                <option value="completed">已结账</option>
                <option value="on_account">挂账</option>
              </select>
              <select className="ant-input search-input report-select" value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: 120 }}>
                <option value="all">全部结账方式</option>
                {methodOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                className="ant-input search-input"
                placeholder="桌台名"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                style={{ width: 110 }}
              />
              <input
                className="ant-input search-input"
                placeholder="订单号/备注"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: 130 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setQuery({ from, to, status, method, table_name: tableName, keyword });
                    setPage(1);
                  }
                }}
              />
            </>
          }
          onQuery={() => {
            setQuery({ from, to, status, method, table_name: tableName, keyword });
            setPage(1);
          }}
          onReset={() => {
            const r = defaultRange();
            setFrom(r.from);
            setTo(r.to);
            setStatus('all');
            setMethod('all');
            setTableName('');
            setKeyword('');
            setQuery({ from: r.from, to: r.to, status: 'all', method: 'all', table_name: '', keyword: '' });
            setPage(1);
          }}
          actions={
            <button className="tm-btn tm-btn-default" type="button" onClick={handleExport}>
              导出
            </button>
          }
        />
        <ReportTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(r) => r.id}
          loading={loading}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          empty={{ title: '暂无订单', desc: '当前查询条件下没有已结账或挂账的订单' }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
