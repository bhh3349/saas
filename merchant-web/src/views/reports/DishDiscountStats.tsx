import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultRange,
  DiscountStatsResult,
  DiscountStatsRow,
  fetchDishDiscount,
} from '../../api/reports';
import ReportTable, { ReportColumn } from '../../components/report/ReportTable';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import FavStar from '../../components/FavStar';
import { exportAoaToXlsx } from '../../utils/excel';

const TYPE_LABELS: Record<string, string> = {
  discount: '折扣优惠',
  voucher: '优惠券',
  price_change: '改价',
  free: '免单',
};

function typeName(r: DiscountStatsRow): string {
  return TYPE_LABELS[r.discount_type] ?? r.discount_name ?? '其他优惠';
}

export default function DishDiscountStats() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [query, setQuery] = useState({ from: range.from, to: range.to });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<DiscountStatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDishDiscount({ from: query.from, to: query.to });
      setData(res);
    } catch (e) {
      notify({ type: 'error', text: (e as Error).message || '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [query, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (data?.items ?? []).slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const columns: ReportColumn<DiscountStatsRow>[] = [
    { key: 'seq', title: '序号', width: 70, align: 'center', render: (_, i) => (page - 1) * pageSize + i + 1 },
    { key: 'type', title: '优惠类型', render: (r) => typeName(r) },
    { key: 'discount_amount', title: '优惠金额(元)', align: 'right', strong: true, render: (r) => r.discount_amount.toFixed(2) },
    { key: 'order_count', title: '优惠订单数', align: 'right', render: (r) => r.order_count },
    { key: 'amount_ratio', title: '金额占比', align: 'right', render: (r) => `${r.amount_ratio}%` },
    { key: 'order_ratio', title: '订单占比', align: 'right', render: (r) => `${r.order_ratio}%` },
  ];

  const handleExport = async () => {
    if (!data || data.items.length === 0) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['序号', '优惠类型', '优惠金额(元)', '优惠订单数', '金额占比', '订单占比'];
    const body = data.items.map((r, i) => [
      String(i + 1),
      typeName(r),
      r.discount_amount.toFixed(2),
      String(r.order_count),
      `${r.amount_ratio}%`,
      `${r.order_ratio}%`,
    ]);
    body.push(['', '合计', data.summary.discount_amount.toFixed(2), String(data.summary.order_count), '', '']);
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `菜品优惠统计_${query.from}_${query.to}.xlsx`,
        sheetName: '菜品优惠统计',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  const summaryOrderRatio = data?.summary.order_count && data.items.length
    ? +((data.summary.order_count / Math.max(data.items.reduce((s, r) => s + r.order_count, 0), 1)) * 100).toFixed(2)
    : 0;

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">菜品优惠统计</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:dish-discount" />
          <span className="hint-text">按优惠类型（折扣 / 优惠券 / 改价 / 免单）聚合优惠金额与订单数</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="优惠总金额(元)" value={(data?.summary.discount_amount ?? 0).toFixed(2)} />
        <StatCard label="优惠订单数" value={String(data?.summary.order_count ?? 0)} />
        <StatCard label="优惠订单占比" value={`${summaryOrderRatio}%`} />
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
          rows={rows}
          rowKey={(r) => r.discount_type}
          loading={loading}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          summary={[
            '合计',
            '',
            (data?.summary.discount_amount ?? 0).toFixed(2),
            String(data?.summary.order_count ?? 0),
            '',
            '',
          ]}
          empty={{ title: '暂无优惠数据', desc: '当前查询区间内没有订单优惠记录，结账时传入优惠参数后自动统计' }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
