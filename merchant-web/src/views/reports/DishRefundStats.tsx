import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultRange,
  DishRefundResult,
  DishRefundRow,
  fetchDishRefund,
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

export default function DishRefundStats() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [query, setQuery] = useState({ from: range.from, to: range.to });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<DishRefundResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDishRefund({
        from: query.from,
        to: query.to,
        page,
        page_size: pageSize,
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

  const columns: ReportColumn<DishRefundRow>[] = [
    { key: 'seq', title: '序号', width: 70, align: 'center', render: (_, i) => (page - 1) * pageSize + i + 1 },
    { key: 'name', title: '菜品名称', render: (r) => r.name },
    { key: 'spec_name', title: '规格', render: (r) => r.spec_name ?? '—' },
    { key: 'unit_price', title: '退菜单价(元)', align: 'right', render: (r) => r.unit_price.toFixed(2) },
    { key: 'qty', title: '退菜数量', align: 'right', render: (r) => formatQty(r.qty) },
    { key: 'amount', title: '退菜金额(元)', align: 'right', strong: true, render: (r) => r.amount.toFixed(2) },
    { key: 'order_count', title: '涉及订单数', align: 'center', render: (r) => r.order_count },
    { key: 'qty_ratio', title: '数量占比', align: 'right', render: (r) => `${r.qty_ratio}%` },
    { key: 'amount_ratio', title: '金额占比', align: 'right', render: (r) => `${r.amount_ratio}%` },
  ];

  const handleExport = async () => {
    if (!data || data.items.length === 0) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['序号', '菜品名称', '规格', '退菜单价(元)', '退菜数量', '退菜金额(元)', '涉及订单数', '数量占比', '金额占比'];
    const body = data.items.map((r, i) => [
      String((page - 1) * pageSize + i + 1),
      r.name,
      r.spec_name ?? '',
      r.unit_price.toFixed(2),
      formatQty(r.qty),
      r.amount.toFixed(2),
      String(r.order_count),
      `${r.qty_ratio}%`,
      `${r.amount_ratio}%`,
    ]);
    body.push(['', '合计', '', '', formatQty(data.summary.total_qty), data.summary.total_amount.toFixed(2), '', '', '']);
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `退菜统计_${query.from}_${query.to}.xlsx`,
        sheetName: '菜品退菜统计',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">菜品退菜统计</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:dish-refund" />
          <span className="hint-text">按菜品与规格聚合退菜数量、金额与涉及订单数，用于分析出品与损耗</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="退菜总金额(元)" value={(data?.summary.total_amount ?? 0).toFixed(2)} />
        <StatCard label="退菜总数量" value={formatQty(data?.summary.total_qty ?? 0)} />
        <StatCard label="退菜记录数" value={String(data?.summary.refund_count ?? 0)} />
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
          rowKey={(r) => `${r.dish_id}-${r.spec_name ?? ''}`}
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
            formatQty(data?.summary.total_qty ?? 0),
            (data?.summary.total_amount ?? 0).toFixed(2),
            '',
            '',
            '',
          ]}
          empty={{ title: '暂无退菜数据', desc: '当前查询区间内没有退菜记录，收银退菜后自动统计' }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
