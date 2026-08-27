import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CouponStatsResult,
  CouponStatsRow,
  defaultRange,
  fetchIncomeCoupon,
} from '../../api/reports';
import ReportTable, { ReportColumn } from '../../components/report/ReportTable';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import FavStar from '../../components/FavStar';
import { exportAoaToXlsx } from '../../utils/excel';

export default function IncomeCouponStats() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [query, setQuery] = useState({ from: range.from, to: range.to });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<CouponStatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchIncomeCoupon({ from: query.from, to: query.to });
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

  const columns: ReportColumn<CouponStatsRow>[] = [
    { key: 'seq', title: '序号', width: 70, align: 'center', render: (_, i) => (page - 1) * pageSize + i + 1 },
    { key: 'coupon_name', title: '券名称', render: (r) => r.coupon_name },
    { key: 'redeem_count', title: '核销数量', align: 'right', render: (r) => r.redeem_count },
    { key: 'redeem_amount', title: '核销金额(元)', align: 'right', strong: true, render: (r) => r.redeem_amount.toFixed(2) },
    { key: 'order_count', title: '参与订单数', align: 'right', render: (r) => r.order_count },
    { key: 'amount_ratio', title: '金额占比', align: 'right', render: (r) => `${r.amount_ratio}%` },
  ];

  const handleExport = async () => {
    if (!data || data.items.length === 0) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['序号', '券名称', '核销数量', '核销金额(元)', '参与订单数', '金额占比'];
    const body = data.items.map((r, i) => [
      String(i + 1),
      r.coupon_name,
      String(r.redeem_count),
      r.redeem_amount.toFixed(2),
      String(r.order_count),
      `${r.amount_ratio}%`,
    ]);
    body.push(['', '合计', String(data.summary.redeem_count), data.summary.redeem_amount.toFixed(2), String(data.summary.order_count), '']);
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `券收入统计_${query.from}_${query.to}.xlsx`,
        sheetName: '券收入统计',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">券收入统计</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:income-coupon" />
          <span className="hint-text">按优惠券聚合核销数量与核销金额，评估券营销效果</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="券核销总金额(元)" value={(data?.summary.redeem_amount ?? 0).toFixed(2)} />
        <StatCard label="核销券数" value={String(data?.summary.redeem_count ?? 0)} />
        <StatCard label="参与订单数" value={String(data?.summary.order_count ?? 0)} />
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
          rowKey={(r) => r.voucher_id}
          loading={loading}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          summary={[
            '合计',
            '',
            String(data?.summary.redeem_count ?? 0),
            (data?.summary.redeem_amount ?? 0).toFixed(2),
            String(data?.summary.order_count ?? 0),
            '',
          ]}
          empty={{ title: '暂无券核销数据', desc: '当前查询区间内没有券核销记录，结账核销优惠券后自动统计' }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
