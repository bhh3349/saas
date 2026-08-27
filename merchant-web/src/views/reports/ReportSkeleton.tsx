import { useMemo, useState } from 'react';
import { defaultRange } from '../../api/reports';
import EmptyState from '../../components/EmptyState';
import ReportToolbar from '../../components/report/ReportToolbar';
import { useToast } from '../../components/report/useToast';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';

interface ReportSkeletonProps {
  title: string;
  desc: string;
  /** KPI 卡片标签 */
  kpis: string[];
  /** 表格列头预览 */
  columns: string[];
  emptyTitle: string;
  emptyDesc: string;
}

/**
 * 报表骨架页：数据模型扩展前的完整 UI 占位
 * （筛选区 + KPI + 表格列头 + 空态说明），待后端补齐后替换为真实数据页。
 */
export default function ReportSkeleton({
  title,
  desc,
  kpis,
  columns,
  emptyTitle,
  emptyDesc,
}: ReportSkeletonProps) {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const { toast, notify, close } = useToast();

  return (
    <div className="page-content">
      <div className="page-head">
        <h1 className="page-title">{title}</h1>
        <div className="page-head-right">
          <span className="hint-text">{desc}</span>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <StatCard key={k} label={k} value="—" />
        ))}
      </div>

      <div className="panel">
        <ReportToolbar
          from={from}
          to={to}
          onRangeChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
          onQuery={() => notify({ type: 'info', text: '该报表数据暂未开放：等待订单数据模型扩展后填充' })}
          onReset={() => {
            const r = defaultRange();
            setFrom(r.from);
            setTo(r.to);
          }}
        />
        <div className="data-table table-list report-list">
          <div className="area-table-scroll checkout-scroll">
            <table className="checkout-real-table report-real-table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c} style={{ textAlign: 'left' }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={columns.length} style={{ height: 220, textAlign: 'center', padding: 0 }}>
                    <EmptyState title={emptyTitle} desc={emptyDesc} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Toast toast={toast} onClose={close} />
    </div>
  );
}
