import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DishDetailResult,
  DishDetailRow,
  defaultRange,
  fetchDishDetail,
} from '../../api/reports';
import ReportTable, { ReportColumn } from '../../components/report/ReportTable';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import FavStar from '../../components/FavStar';
import { exportAoaToXlsx } from '../../utils/excel';

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtTime(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const modeText: Record<string, string> = { table: '堂食', ticket: '外带' };

export default function DishDetail() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [query, setQuery] = useState({ from: range.from, to: range.to });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<DishDetailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDishDetail({ from: query.from, to: query.to, page, page_size: pageSize });
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

  const columns: ReportColumn<DishDetailRow>[] = [
    { key: 'seq', title: '序号', width: 60, align: 'center', render: (_, i) => (page - 1) * pageSize + i + 1 },
    { key: 'settled_at', title: '营业日期', width: 120, render: (r) => (r.settled_at ? String(r.settled_at).slice(0, 10) : '—') },
    { key: 'order_no', title: '订单号', width: 140, render: (r) => r.order_no },
    { key: 'name', title: '菜品名称', render: (r) => r.name },
    { key: 'spec_name', title: '规格', width: 100, render: (r) => r.spec_name ?? '—' },
    { key: 'qty', title: '数量', width: 80, align: 'right', render: (r) => formatQty(r.qty) },
    { key: 'unit_price', title: '单价(元)', width: 90, align: 'right', render: (r) => r.unit_price.toFixed(2) },
    { key: 'amount', title: '金额(元)', width: 100, align: 'right', strong: true, render: (r) => r.amount.toFixed(2) },
    { key: 'table_name', title: '桌台/取餐号', width: 110, render: (r) => r.table_name ?? (r.ticket_no ? `#${r.ticket_no}` : '—') },
    { key: 'mode', title: '类型', width: 70, align: 'center', render: (r) => modeText[r.mode] ?? r.mode },
    { key: 'payment_method_name', title: '结账方式', width: 100, render: (r) => r.payment_method_name ?? '—' },
  ];

  const handleExport = async () => {
    if (!data || data.items.length === 0) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['序号', '营业日期', '订单号', '菜品名称', '规格', '数量', '单价(元)', '金额(元)', '桌台/取餐号', '类型', '结账方式'];
    const body = data.items.map((r, i) => [
      String((page - 1) * pageSize + i + 1),
      r.settled_at ? String(r.settled_at).slice(0, 10) : '',
      r.order_no,
      r.name,
      r.spec_name ?? '',
      formatQty(r.qty),
      r.unit_price.toFixed(2),
      r.amount.toFixed(2),
      r.table_name ?? (r.ticket_no ? `#${r.ticket_no}` : ''),
      modeText[r.mode] ?? r.mode,
      r.payment_method_name ?? '',
    ]);
    body.push(['', '', '', '合计', '', formatQty(data.summary.total_qty), '', data.summary.total_amount.toFixed(2)]);
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `菜品销售明细_${query.from}_${query.to}.xlsx`,
        sheetName: '菜品销售明细',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">菜品销售明细</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:dish-detail" />
          <span className="hint-text">记录每个品项的销/退数据，默认按结账时间倒序，已结账 + 挂账订单</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="明细记录数" value={String(data?.total ?? 0)} />
        <StatCard label="销售总数量" value={formatQty(data?.summary.total_qty ?? 0)} />
        <StatCard label="销售总额(元)" value={(data?.summary.total_amount ?? 0).toFixed(2)} />
      </div>

      <div className="panel">
        <ReportToolbar
          from={from}
          to={to}
          onRangeChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
          onQuery={() => {
            setQuery({ from, to });
            setPage(1);
          }}
          onReset={() => {
            const r = defaultRange();
            setFrom(r.from);
            setTo(r.to);
            setQuery({ from: r.from, to: r.to });
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
          rowKey={(r) => `${r.order_id}_${r.order_no}_${r.name}_${r.qty}`}
          loading={loading}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          summary={[
            '合计',
            '',
            '',
            '',
            '',
            formatQty(data?.summary.total_qty ?? 0),
            '',
            (data?.summary.total_amount ?? 0).toFixed(2),
            '',
            '',
            '',
          ]}
          empty={{ title: '暂无销售明细', desc: '当前查询区间内没有已结账或挂账的菜品销售记录' }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
