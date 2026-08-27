import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TableStatsResult,
  TableStatsRow,
  defaultRange,
  fetchTableStats,
} from '../../api/reports';
import ReportTable, { ReportColumn } from '../../components/report/ReportTable';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import FavStar from '../../components/FavStar';
import { exportAoaToXlsx } from '../../utils/excel';

export default function AreaTableStats() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [area, setArea] = useState('all');
  const [query, setQuery] = useState({ from: range.from, to: range.to, area: 'all' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<TableStatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  /** 区域下拉选项：从已加载数据中提取 */
  const areaOptions = useMemo(() => {
    const set = new Set<string>();
    (data?.items ?? []).forEach((r) => {
      if (r.area && r.area !== '—') set.add(r.area);
    });
    return [...set];
  }, [data]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTableStats({
        from: query.from,
        to: query.to,
        page,
        page_size: pageSize,
        area: query.area,
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

  const columns: ReportColumn<TableStatsRow>[] = [
    { key: 'seq', title: '序号', width: 60, align: 'center', render: (_, i) => (page - 1) * pageSize + i + 1 },
    { key: 'table_name', title: '桌台', render: (r) => r.table_name },
    { key: 'area', title: '餐区', width: 100, align: 'center', render: (r) => r.area },
    { key: 'order_count', title: '订单数', width: 100, align: 'right', render: (r) => r.order_count },
    { key: 'revenue', title: '营业额(元)', width: 120, align: 'right', strong: true, render: (r) => r.revenue.toFixed(2) },
    { key: 'avg_amount', title: '桌均(元)', width: 110, align: 'right', render: (r) => r.avg_amount.toFixed(2) },
  ];

  const handleExport = async () => {
    if (!data || data.items.length === 0) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['序号', '桌台', '餐区', '订单数', '营业额(元)', '桌均(元)'];
    const body = data.items.map((r, i) => [
      String((page - 1) * pageSize + i + 1),
      r.table_name,
      r.area,
      String(r.order_count),
      r.revenue.toFixed(2),
      r.avg_amount.toFixed(2),
    ]);
    body.push(['', '合计', '', String(data.summary.order_count), data.summary.revenue.toFixed(2)]);
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `餐区桌台营业统计_${query.from}_${query.to}.xlsx`,
        sheetName: '餐区桌台统计',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">餐区/桌台营业统计</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:area-table-stats" />
          <span className="hint-text">统计已结账桌台订单，按桌台聚合营业额（实收口径）</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="营业桌台数" value={String(data?.total ?? 0)} />
        <StatCard label="有效订单数" value={String(data?.summary.order_count ?? 0)} />
        <StatCard label="营业额(元)" value={(data?.summary.revenue ?? 0).toFixed(2)} />
        <StatCard
          label="桌均(元)"
          value={data && data.summary.order_count ? (data.summary.revenue / data.summary.order_count).toFixed(2) : '0.00'}
        />
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
              className="ant-input search-input report-select"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              style={{ width: 140 }}
            >
              <option value="all">全部餐区</option>
              {areaOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          }
          onQuery={() => {
            setQuery({ from, to, area });
            setPage(1);
          }}
          onReset={() => {
            const r = defaultRange();
            setFrom(r.from);
            setTo(r.to);
            setArea('all');
            setQuery({ from: r.from, to: r.to, area: 'all' });
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
          rowKey={(r) => r.table_id}
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
            data?.summary.order_count ?? 0,
            (data?.summary.revenue ?? 0).toFixed(2),
            data && data.summary.order_count ? (data.summary.revenue / data.summary.order_count).toFixed(2) : '0.00',
          ]}
          empty={{ title: '暂无桌台营业数据', desc: '当前查询区间内没有已结账的桌台订单' }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
