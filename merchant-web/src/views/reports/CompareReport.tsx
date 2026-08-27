import { useCallback, useEffect, useMemo, useState } from 'react';
import { CompareData, defaultRange, fetchCompare } from '../../api/reports';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import Toast from '../../components/Toast';
import FavStar from '../../components/FavStar';
import { exportAoaToXlsx } from '../../utils/excel';

interface MetricCardProps {
  label: string;
  value: number;
  previous: number;
  change: number;
  precision?: number;
  unit?: string;
}

function MetricCard({ label, value, previous, change, precision = 0, unit = '' }: MetricCardProps) {
  const cls = change > 0 ? 'up' : change < 0 ? 'down' : '';
  return (
    <div className="panel compare-card">
      <div className="compare-label">{label}</div>
      <div className="compare-value">
        {value.toFixed(precision)}
        {unit && <span className="compare-unit">{unit}</span>}
      </div>
      <div className="compare-row">
        <span className={`compare-trend ${cls}`}>
          {change > 0 ? '+' : ''}
          {change.toFixed(2)}%
        </span>
        <span className="compare-prev">上期 {previous.toFixed(precision)}</span>
      </div>
    </div>
  );
}

export default function CompareReport() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [query, setQuery] = useState({ from: range.from, to: range.to });
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, notify, close } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCompare({ from: query.from, to: query.to });
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

  const handleExport = async () => {
    if (!data) {
      notify({ type: 'info', text: '当前没有可导出的数据' });
      return;
    }
    const header = ['指标', '当期', '上期', '环比变化率'];
    const body = [
      ['订单数(单)', String(data.current.order_count), String(data.previous.order_count), `${data.order_count_change}%`],
      ['营业额(元)', data.current.revenue.toFixed(2), data.previous.revenue.toFixed(2), `${data.revenue_change}%`],
      ['客单价(元)', data.current.avg_amount.toFixed(2), data.previous.avg_amount.toFixed(2), `${data.avg_amount_change}%`],
    ];
    try {
      await exportAoaToXlsx([header, ...body], {
        filename: `营业指标同环比_${query.from}_${query.to}.xlsx`,
        sheetName: '营业指标同环比',
      });
      notify({ type: 'success', text: '导出成功' });
    } catch {
      notify({ type: 'error', text: '导出失败，请重试' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">营业指标同环比</h1>
        <div className="page-head-right">
          <FavStar viewKey="rpt:compare" />
          <span className="hint-text">当期与上一同长区间对比，口径为已结账订单实收</span>
        </div>
      </div>

      <div className="panel" style={{ paddingBottom: 20 }}>
        <ReportToolbar
          from={from}
          to={to}
          onRangeChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
          onQuery={() => {
            setQuery({ from, to });
          }}
          onReset={() => {
            const r = defaultRange();
            setFrom(r.from);
            setTo(r.to);
            setQuery({ from: r.from, to: r.to });
          }}
          actions={
            <button className="tm-btn tm-btn-default" type="button" onClick={handleExport}>
              导出
            </button>
          }
        />

        {data && (
          <div className="compare-range-hint">
            对比区间：当期 <b>{data.from} ~ {data.to}</b>（{data.current.order_count} 单） vs 上期{' '}
            <b>{data.prev_from} ~ {data.prev_to}</b>（{data.previous.order_count} 单）
          </div>
        )}

        {loading ? (
          <div className="stats-row">
            <div className="panel stat-card loading"><div className="stat-value skeleton" /></div>
            <div className="panel stat-card loading"><div className="stat-value skeleton" /></div>
            <div className="panel stat-card loading"><div className="stat-value skeleton" /></div>
          </div>
        ) : (
          data && (
            <div className="stats-row">
              <MetricCard
                label="订单数(单)"
                value={data.current.order_count}
                previous={data.previous.order_count}
                change={data.order_count_change}
              />
              <MetricCard
                label="营业额(元)"
                value={data.current.revenue}
                previous={data.previous.revenue}
                change={data.revenue_change}
                precision={2}
              />
              <MetricCard
                label="客单价(元)"
                value={data.current.avg_amount}
                previous={data.previous.avg_amount}
                change={data.avg_amount_change}
                precision={2}
              />
            </div>
          )
        )}
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
