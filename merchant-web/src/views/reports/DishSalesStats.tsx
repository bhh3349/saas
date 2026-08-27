import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DishSalesResult,
  DishSalesRow,
  defaultRange,
  fetchDishSales,
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

export default function DishSalesStats() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [dishName, setDishName] = useState('');
  const [query, setQuery] = useState({ from: range.from, to: range.to, dish_name: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<DishSalesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDishSales({
        from: query.from,
        to: query.to,
        page,
        page_size: pageSize,
        dish_name: query.dish_name || undefined,
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

  const columns: ReportColumn<DishSalesRow>[] = [
    { key: 'seq', title: '序号', width: 70, align: 'center', render: (_, i) => (page - 1) * pageSize + i + 1 },
    { key: 'name', title: '菜品名称', render: (r) => r.name },
    { key: 'spec_name', title: '规格', render: (r) => r.spec_name ?? '—' },
    { key: 'unit_price', title: '单价(元)', align: 'right', render: (r) => r.unit_price.toFixed(2) },
    { key: 'qty', title: '销售数量', align: 'right', render: (r) => formatQty(r.qty) },
    { key: 'amount', title: '销售金额(元)', align: 'right', strong: true, render: (r) => r.amount.toFixed(2) },
    { key: 'qty_ratio', title: '数量占比', align: 'right', render: (r) => `${r.qty_ratio}%` },
    { key: 'amount_ratio', title: '金额占比', align: 'right', render: (r) => `${r.amount_ratio}%` },
    { key: 'order_count', title: '出现订单数', align: 'center', render: (r) => r.order_count },
  ];

  const handleExport = async () => {
    if (!data || data.items.length === 0) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['序号', '菜品名称', '规格', '单价(元)', '销售数量', '销售金额(元)', '数量占比', '金额占比', '出现订单数'];
    const body = data.items.map((r, i) => [
      String((page - 1) * pageSize + i + 1),
      r.name,
      r.spec_name ?? '',
      r.unit_price.toFixed(2),
      formatQty(r.qty),
      r.amount.toFixed(2),
      `${r.qty_ratio}%`,
      `${r.amount_ratio}%`,
      String(r.order_count),
    ]);
    const summary = data.summary;
    body.push(['', '合计', '', '', formatQty(summary.total_qty), summary.total_amount.toFixed(2), '', '', `共${summary.order_count}单`]);
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `菜品销售统计_${query.from}_${query.to}.xlsx`,
        sheetName: '菜品销售统计',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">菜品销售统计</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:dish-sales" />
          <span className="hint-text">统计已结账 + 挂账订单的品项销售数据，按菜品与规格聚合</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <StatCard label="销售菜品数" value={String(data?.total ?? 0)} />
        <StatCard label="销售总数量" value={formatQty(data?.summary.total_qty ?? 0)} />
        <StatCard label="销售总额(元)" value={(data?.summary.total_amount ?? 0).toFixed(2)} />
        <StatCard label="有效订单数" value={String(data?.summary.order_count ?? 0)} />
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
            <input
              className="ant-input search-input"
              placeholder="按菜品名称筛选"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setQuery({ from, to, dish_name: dishName });
                  setPage(1);
                }
              }}
            />
          }
          onQuery={() => {
            setQuery({ from, to, dish_name: dishName });
            setPage(1);
          }}
          onReset={() => {
            const r = defaultRange();
            setFrom(r.from);
            setTo(r.to);
            setDishName('');
            setQuery({ from: r.from, to: r.to, dish_name: '' });
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
          rowKey={(r) => r.dish_id}
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
          empty={{ title: '暂无销售数据', desc: '当前查询区间内没有已结账或挂账的菜品销售记录' }}
        />
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
