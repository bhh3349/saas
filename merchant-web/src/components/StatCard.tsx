export interface StatCardProps {
  label: string;
  value?: string;
  trend?: string; // e.g. "+12.5%"
  sub?: string;
  /** 加载中：显示骨架占位 + 透明度降低 */
  loading?: boolean;
}

export default function StatCard({ label, value = '—', trend, sub, loading }: StatCardProps) {
  const trendClass = trend
    ? trend.startsWith('+')
      ? 'up'
      : trend.startsWith('-')
        ? 'down'
        : ''
    : '';

  return (
    <div className={`panel stat-card ${loading ? 'loading' : ''}`}>
      <div className="stat-row">
        <span className="stat-label">{label}</span>
        {trend && <span className={`stat-trend ${trendClass}`}>{trend}</span>}
      </div>
      {loading ? (
        <div className="stat-value skeleton" />
      ) : (
        <div className="stat-value">{value}</div>
      )}
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
