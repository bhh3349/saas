import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultRange,
  fetchSensitiveStats,
  SensitiveRow,
  SensitiveStatsResult,
} from '../../api/reports';
import ReportTable, { ReportColumn } from '../../components/report/ReportTable';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import FavStar from '../../components/FavStar';
import { exportAoaToXlsx } from '../../utils/excel';

export default function SensitiveStats() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [query, setQuery] = useState({ from: range.from, to: range.to });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<SensitiveStatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSensitiveStats({ from: query.from, to: query.to });
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

  const columns: ReportColumn<SensitiveRow>[] = [
    { key: 'seq', title: '序号', width: 70, align: 'center', render: (_, i) => (page - 1) * pageSize + i + 1 },
    { key: 'action_name', title: '操作类型', render: (r) => r.action_name },
    { key: 'count', title: '操作次数', align: 'right', strong: true, render: (r) => r.count },
    { key: 'amount', title: '涉及金额(元)', align: 'right', render: (r) => r.amount.toFixed(2) },
    { key: 'count_ratio', title: '次数占比', align: 'right', render: (r) => `${r.count_ratio}%` },
  ];

  const handleExport = async () => {
    if (!data || data.items.length === 0) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['序号', '操作类型', '操作次数', '涉及金额(元)', '次数占比'];
    const body = data.items.map((r, i) => [
      String(i + 1),
      r.action_name,
      String(r.count),
      r.amount.toFixed(2),
      `${r.count_ratio}%`,
    ]);
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `敏感操作统计_${query.from}_${query.to}.xlsx`,
        sheetName: '敏感操作统计',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">敏感操作统计</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:sensitive-stats" />
          <span className="hint-text">统计改价、退菜、作废订单、免单、优惠券核销等敏感操作，保障账实相符</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="操作总次数" value={String(data?.summary.total_count ?? 0)} />
        <StatCard label="涉及金额(元)" value={(data?.summary.total_amount ?? 0).toFixed(2)} />
        <StatCard label="操作类型数" value={String(data?.total ?? 0)} />
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
          rowKey={(r) => r.action}
          loading={loading}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          summary={[
            '合计',
            '',
            String(data?.summary.total_count ?? 0),
            (data?.summary.total_amount ?? 0).toFixed(2),
            '',
          ]}
          empty={{ title: '暂无敏感操作', desc: '当前查询区间内没有改价、退菜、作废订单等敏感操作记录' }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
