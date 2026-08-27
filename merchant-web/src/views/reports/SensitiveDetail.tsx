import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultRange,
  fetchSensitiveDetail,
  SensitiveDetailResult,
  SensitiveDetailRow,
} from '../../api/reports';
import ReportTable, { ReportColumn } from '../../components/report/ReportTable';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import FavStar from '../../components/FavStar';
import { exportAoaToXlsx } from '../../utils/excel';

const ACTION_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'price_change', label: '改价' },
  { value: 'refund', label: '退菜' },
  { value: 'void_order', label: '作废订单' },
  { value: 'free_order', label: '免单' },
  { value: 'voucher', label: '优惠券核销' },
];

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SensitiveDetail() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [action, setAction] = useState('');
  const [query, setQuery] = useState({ from: range.from, to: range.to, action: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<SensitiveDetailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSensitiveDetail({
        from: query.from,
        to: query.to,
        page,
        page_size: pageSize,
        keyword: query.action || undefined,
      });
      setData(res);
    } catch (e) {
      notify({ type: 'error', text: (e as Error).message || '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ReportColumn<SensitiveDetailRow>[] = [
    { key: 'seq', title: '序号', width: 70, align: 'center', render: (_, i) => (page - 1) * pageSize + i + 1 },
    { key: 'time', title: '操作时间', width: 160, render: (r) => fmtTime(r.time) },
    { key: 'operator', title: '操作人', render: (r) => r.operator },
    { key: 'action_name', title: '操作类型', render: (r) => r.action_name },
    { key: 'amount', title: '涉及金额(元)', align: 'right', render: (r) => r.amount.toFixed(2) },
    { key: 'detail', title: '操作详情', render: (r) => r.detail || '—' },
  ];

  const handleExport = async () => {
    if (!data || data.items.length === 0) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['序号', '操作时间', '操作人', '操作类型', '涉及金额(元)', '操作详情'];
    const body = data.items.map((r, i) => [
      String((page - 1) * pageSize + i + 1),
      fmtTime(r.time),
      r.operator,
      r.action_name,
      r.amount.toFixed(2),
      r.detail,
    ]);
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `敏感操作明细_${query.from}_${query.to}.xlsx`,
        sheetName: '敏感操作明细',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">菜品敏感操作明细</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:sensitive-detail" />
          <span className="hint-text">逐条记录改价、退菜、作废订单、免单、优惠券核销等敏感操作，默认按时间倒序</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="记录总数" value={String(data?.summary.total_count ?? 0)} />
        <StatCard label="涉及金额(元)" value={(data?.summary.total_amount ?? 0).toFixed(2)} />
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
            <select
              className="ant-input report-select"
              style={{ width: 150 }}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          }
          onQuery={() => {
            setQuery({ from, to, action });
            setPage(1);
          }}
          onReset={() => {
            const r = defaultRange();
            setFrom(r.from);
            setTo(r.to);
            setAction('');
            setQuery({ from: r.from, to: r.to, action: '' });
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
          empty={{ title: '暂无敏感操作', desc: '当前查询条件下没有敏感操作记录' }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
