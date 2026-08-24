import EmptyState from '../components/EmptyState';

export default function BizStats() {
  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">综合营业统计</h1>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="date-input">开始日期</div>
          <span className="range-sep">至</span>
          <div className="date-input">结束日期</div>
          <button className="btn btn-primary">查询</button>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-secondary">导出</button>
        </div>
      </div>

      <section className="panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel-head">
          <div className="panel-title">营业明细</div>
        </div>
        <div className="panel-body">
          <div className="data-table biz-cols-table">
            <div className="area-table-scroll checkout-scroll">
              <table className="checkout-real-table biz-cols-table">
                <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '24%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="th-center">日期</th>
                    <th className="th-center">营业额</th>
                    <th className="th-center">订单数</th>
                    <th className="th-center">客单价</th>
                    <th className="th-center">桌台使用率</th>
                    <th className="th-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6} style={{ height: 180, textAlign: 'center', padding: 0 }}>
                      <EmptyState
                        title="暂无数据"
                        desc="选择时间范围后查看营业明细"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
