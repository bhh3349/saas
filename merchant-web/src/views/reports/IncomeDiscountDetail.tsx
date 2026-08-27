import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultRange,
  fetchIncomeDiscountDetail,
  IncomeDiscountDetailResult,
  IncomeDiscountDetailRow,
} from '../../api/reports';
import ReportTable, { ReportColumn } from '../../components/report/ReportTable';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import FavStar from '../../components/FavStar';
import { exportAoaToXlsx } from '../../utils/excel';

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'discount', label: '折扣优惠' },
  { value: 'voucher', label: '优惠券' },
  { value: 'price_change', label: '改价' },
  { value: 'free', label: '免单' },
];

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function IncomeDiscountDetail() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [type, setType] = useState('');
  const [query, setQuery] = useState({ from: range.from, to: range.to, type: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<IncomeDiscountDetailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchIncomeDiscountDetail({
        from: query.from,
        to: query.to,
        page,
        page_size: pageSize,
        keyword: query.type || undefined,
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

  const columns: ReportColumn<IncomeDiscountDetailRow>[] = [
    { key: 'seq', title: '序号', width: 70, align: 'center', render: (_, i) => (page - 1) * pageSize + i + 1 },
    { key: 'settled_at', title: '结账时间', width: 150, render: (r) => fmtTime(r.settled_at) },
    { key: 'order_no', title: '订单号', render: (r) => r.order_no },
    { key: 'discount_type', title: '优惠类型', render: (r) => r.discount_name },
    { key: 'discount_amount', title: '优惠金额(元)', align: 'right', strong: true, render: (r) => r.discount_amount.toFixed(2) },
    { key: 'total_amount', title: '订单金额(元)', align: 'right', render: (r) => r.total_amount.toFixed(2) },
    { key: 'paid_amount', title: '实收金额(元)', align: 'right', render: (r) => r.paid_amount.toFixed(2) },
    { key: 'payment_method_name', title: '结账方式', align: 'center', render: (r) => r.payment_method_name ?? '—' },
  ];

  const handleExport = async () => {
    if (!data || data.items.length === 0) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['序号', '结账时间', '订单号', '优惠类型', '优惠金额(元)', '订单金额(元)', '实收金额(元)', '结账方式'];
    const body = data.items.map((r, i) => [
      String((page - 1) * pageSize + i + 1),
      fmtTime(r.settled_at),
      r.order_no,
      r.discount_name,
      r.discount_amount.toFixed(2),
      r.total_amount.toFixed(2),
      r.paid_amount.toFixed(2),
      r.payment_method_name ?? '',
    ]);
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `收入优惠明细_${query.from}_${query.to}.xlsx`,
        sheetName: '收入优惠明细',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">收入优惠明细</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:income-discount-detail" />
          <span className="hint-text">逐条记录每笔订单的优惠明细（折扣 / 优惠券 / 改价 / 免单），默认按结账时间倒序</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="优惠总金额(元)" value={(data?.summary.discount_amount ?? 0).toFixed(2)} />
        <StatCard label="优惠订单数" value={String(data?.summary.order_count ?? 0)} />
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
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          }
          onQuery={() => {
            setQuery({ from, to, type });
            setPage(1);
          }}
          onReset={() => {
            const r = defaultRange();
            setFrom(r.from);
            setTo(r.to);
            setType('');
            setQuery({ from: r.from, to: r.to, type: '' });
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
          rowKey={(r) => r.order_id}
          loading={loading}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          empty={{ title: '暂无优惠明细', desc: '当前查询条件下没有订单优惠记录' }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
