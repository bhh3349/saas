import { useCallback, useEffect, useMemo, useState } from 'react';
import { PromoStatsResult, defaultRange, fetchPromoStats } from '../../api/reports';
import ReportTable, { ReportColumn } from '../../components/report/ReportTable';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';

interface PromoRow {
  name: string;
  type: string;
  discount_amount: number;
  order_count: number;
  gift_qty: number;
}

const EMPTY: PromoStatsResult = { total: 0, items: [], summary: { promo_count: 0, discount_amount: 0, order_count: 0 } };

export default function PromoStats() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [query, setQuery] = useState({ from: range.from, to: range.to });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<PromoStatsResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPromoStats({ from: query.from, to: query.to });
      setData(res ?? EMPTY);
    } catch (e) {
      notify({ type: 'error', text: (e as Error).message || '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [query, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ReportColumn<PromoRow>[] = [
    { key: 'name', title: '活动名称', render: (r) => r.name },
    { key: 'type', title: '活动类型', width: 120, align: 'center', render: (r) => r.type },
    { key: 'discount_amount', title: '优惠金额(元)', width: 120, align: 'right', strong: true, render: (r) => r.discount_amount.toFixed(2) },
    { key: 'order_count', title: '参与订单数', width: 110, align: 'right', render: (r) => r.order_count },
    { key: 'gift_qty', title: '赠送菜品数', width: 110, align: 'right', render: (r) => r.gift_qty },
  ];

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">促销活动统计</h1>
        <div className="page-head-right">
          <span className="hint-text">按促销活动聚合优惠金额与参与订单（口径为已结账 + 挂账订单）</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="活动数" value={String(data.summary.promo_count ?? 0)} />
        <StatCard label="优惠总金额(元)" value={(data.summary.discount_amount ?? 0).toFixed(2)} />
        <StatCard label="参与订单数" value={String(data.summary.order_count ?? 0)} />
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
        />
        <ReportTable
          columns={columns}
          rows={data.items ?? []}
          rowKey={(r) => r.name}
          loading={loading}
          total={data.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          empty={{
            title: '暂无促销活动数据',
            desc: '暂无促销活动数据。请先在收银端配置并使用优惠券、折扣等促销，结账后即可在此查看统计。',
          }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
