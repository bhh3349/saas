import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import StatCard from '../components/StatCard';

const QUICK_ENTRIES = [
  { label: '开台点餐', tile: 'open' },
  { label: '桌台管理', tile: 'table' },
  { label: '菜品管理', tile: 'dish' },
  { label: '会员营销', tile: 'member' },
  { label: '结账收银', tile: 'checkout' },
  { label: '打印管理', tile: 'print' },
  { label: '营业报表', tile: 'report' },
  { label: '经营设置', tile: 'settings' },
] as const;

function formatToday(): string {
  const now = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d} ${weekdays[now.getDay()]}`;
}

/** 模拟拉取首页数据耗时，后续接真实接口时替换此处 */
function fetchHomeData(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1100));
}

export default function OpsHome() {
  const [loading, setLoading] = useState(true);

  /** 刷新首页数据（进入页面、手动点刷新按钮） */
  const refresh = () => {
    setLoading(true);
    fetchHomeData().finally(() => setLoading(false));
  };

  // 每次进入首页（组件 mount）自动刷新
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`page ${loading ? 'is-refreshing' : ''}`}>
      <div className="page-head">
        <h1 className="page-title">首页</h1>
        <div className="page-head-right">
          <button
            className="refresh-btn"
            onClick={refresh}
            disabled={loading}
            aria-label="刷新首页数据"
            title="刷新首页数据"
          >
            <Icon name="refresh" className={`refresh-icon ${loading ? 'spin' : ''}`} />
            <span>{loading ? '刷新中…' : '刷新'}</span>
          </button>
          <div className="date-badge">{formatToday()}</div>
        </div>
      </div>

      <div className="stats-row">
        <StatCard label="今日营业额" loading={loading} />
        <StatCard label="今日订单" loading={loading} />
        <StatCard label="客单价" loading={loading} />
        <StatCard label="桌台使用率" loading={loading} />
        <StatCard label="今日退款" loading={loading} />
      </div>

      <div className="home-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        <section className="panel" style={{ flex: 1, minWidth: 0 }}>
          <div className="panel-head">
            <div className="panel-title">当日订单</div>
            <div className="panel-more">查看全部</div>
          </div>
          <div className="panel-body">
            <div className="data-table">
              <div className="area-table-scroll checkout-scroll">
                <table className="checkout-real-table">
                  <colgroup>
                    <col style={{ width: 100 }} />
                    <col />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 120 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="th-center">时间</th>
                      <th>订单号</th>
                      <th>桌台</th>
                      <th className="th-center">金额</th>
                      <th className="th-center">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={5} style={{ height: 160, textAlign: 'center', padding: 0 }}>
                        <EmptyState title="暂无订单" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="panel quick-panel">
          <div className="panel-head">
            <div className="panel-title">快捷入口</div>
            <div className="panel-more">自定义</div>
          </div>
          <div className="panel-body">
            <div className="quick-grid">
              {QUICK_ENTRIES.map((entry) => (
                <div key={entry.label} className="quick-item" title={entry.label}>
                  <div className={`quick-tile ${entry.tile}`} />
                  <span className="quick-label">{entry.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}