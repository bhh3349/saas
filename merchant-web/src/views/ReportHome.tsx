import { useState } from 'react';
import EmptyState from '../components/EmptyState';
import StatCard from '../components/StatCard';

const TABS = ['日', '周', '月'] as const;

export default function ReportHome() {
  const [activeTab, setActiveTab] = useState<string>('日');

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">营业概览</h1>
      </div>

      <div className="report-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`pill-tab ${tab === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="stats-row">
        <StatCard label="营业额" />
        <StatCard label="订单数" />
        <StatCard label="客单价" />
        <StatCard label="桌台使用率" />
      </div>

      <section className="panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel-head">
          <div className="panel-title">收入构成</div>
        </div>
        <div className="panel-body report-chart">
          <EmptyState title="暂无数据" />
        </div>
      </section>
    </div>
  );
}
