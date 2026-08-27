import type { ReactNode } from 'react';

interface ReportToolbarProps {
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;
  /** 附加筛选字段（可选） */
  extra?: ReactNode;
  onQuery: () => void;
  onReset: () => void;
  /** 右侧操作区（导出按钮等） */
  actions?: ReactNode;
}

/** 报表筛选工具条：日期范围 + 附加字段 + 查询/重置，右侧操作区 */
export default function ReportToolbar({
  from,
  to,
  onRangeChange,
  extra,
  onQuery,
  onReset,
  actions,
}: ReportToolbarProps) {
  return (
    <div className="table-toolbar report-toolbar">
      <div className="filter-group">
        <input
          type="date"
          className="date-input"
          value={from}
          max={to}
          onChange={(e) => onRangeChange(e.target.value, to)}
        />
        <span className="range-sep">至</span>
        <input
          type="date"
          className="date-input"
          value={to}
          min={from}
          onChange={(e) => onRangeChange(from, e.target.value)}
        />
        {extra}
        <button className="tm-btn tm-btn-primary" type="button" onClick={onQuery}>
          查询
        </button>
        <button className="tm-btn tm-btn-default" type="button" onClick={onReset}>
          重置
        </button>
      </div>
      {actions && <div className="filter-group">{actions}</div>}
    </div>
  );
}
