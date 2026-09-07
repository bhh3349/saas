import { useCallback, useEffect, useMemo, useState } from 'react';
import Toast, { type ToastData } from '../components/Toast';
import { fetchDevices, type DeviceItem } from '../api/devices';
import CommonSelect from '../components/CommonSelect';
import { exportAoaToXlsx } from '../utils/excel';

const TYPE_LABEL: Record<string, string> = {
  POS: '收银机',
  Printer: '打印机',
  Tablet: '平板',
  Scanner: '扫码枪',
};

/** 在线状态筛选下拉 */
const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'online', label: '仅在线' },
  { value: 'offline', label: '仅离线' },
];

/** ISO 时间 → YYYY-MM-DD HH:mm:ss */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function DeviceMonitor() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDevices(await fetchDevices());
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '设备列表加载失败' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.is_online).length;
    return { total, online, offline: total - online };
  }, [devices]);

  /** 状态筛选后的设备列表 */
  const filteredDevices = useMemo(() => {
    if (statusFilter === 'online') return devices.filter((d) => d.is_online);
    if (statusFilter === 'offline') return devices.filter((d) => !d.is_online);
    return devices;
  }, [devices, statusFilter]);

  /** 导出设备列表（xlsx） */
  const handleExport = async () => {
    if (filteredDevices.length === 0) {
      setToast({ type: 'info', text: '当前没有可导出的设备' });
      return;
    }
    const header = ['序号', '设备名称', '设备ID', '设备类型', '位置', 'IP地址', 'MAC地址', '系统', '版本', '状态', '最后在线时间'];
    const body = filteredDevices.map((d, i) => [
      String(i + 1),
      d.name || d.device_id,
      d.device_id,
      TYPE_LABEL[d.type] ?? d.type,
      d.location || '—',
      d.ip || '—',
      d.mac || '—',
      d.os || '—',
      d.app_version || '—',
      d.is_online ? '在线' : '离线',
      fmtTime(d.last_seen_at),
    ]);
    try {
      await exportAoaToXlsx([header, ...body], {
        sheetName: '设备列表',
        filename: `设备监控_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      setToast({ type: 'success', text: '导出成功' });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '导出失败，请重试' });
    }
  };

  const renderStatus = (online: boolean) => (
    <span className={`status-tag ${online ? 'status-on' : 'status-off'}`}>
      
      {online ? '在线' : '离线'}
    </span>
  );

  return (
    <div className="page">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="page-head">
        <h1 className="page-title">设备监控</h1>
        <div className="page-head-actions">
          <CommonSelect
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
            placeholder="全部状态"
            width={130}
            ariaLabel="设备状态筛选"
          />
          <button className="tm-btn tm-btn-default" type="button" onClick={handleExport}>
            导出
          </button>
          <button className="tm-btn tm-btn-primary" type="button" onClick={load} disabled={loading}>
            {loading ? '刷新中…' : '刷新'}
          </button>
        </div>
      </div>

      {/* 汇总卡片 */}
      <div className="stats-row">
        <div className="panel stat-card">
          <div className="stat-row">
            <span className="stat-label">设备总数</span>
          </div>
          <div className="stat-value">{summary.total}</div>
          <div className="stat-sub">收银端心跳自动登记</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-row">
            <span className="stat-label">在线设备</span>
          </div>
          <div className="stat-value">{summary.online}</div>
          <div className="stat-sub">5 分钟内有心跳</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-row">
            <span className="stat-label">离线设备</span>
          </div>
          <div className="stat-value">{summary.offline}</div>
          <div className="stat-sub">超过 5 分钟无心跳</div>
        </div>
      </div>

      {/* 设备列表 */}
      <section className="panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel-head">
          <div className="panel-title">设备列表</div>
          <div className="panel-more">收银端启动后自动上报，无需手动录入</div>
        </div>
        <div className="panel-body">
          <div className="data-table table-list">
            <div className="area-table-scroll checkout-scroll">
              <table className="checkout-real-table">
                <colgroup>
                  <col style={{ width: 60 }} />
                  <col />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 170 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 180 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="th-center">序号</th>
                    <th>设备名称</th>
                    <th className="th-center">设备类型</th>
                    <th>位置</th>
                    <th>IP地址</th>
                    <th>MAC地址</th>
                    <th>系统 / 版本</th>
                    <th className="th-center">状态</th>
                    <th className="th-center">最后在线时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.length === 0 ? (
                    <tr>
                      <td className="checkout-empty-cell" colSpan={9}>
                        {loading ? '加载中…' : '暂无收银端设备，收银端启动后会自动上报并显示在此'}
                      </td>
                    </tr>
                  ) : (
                    filteredDevices.map((d, i) => (
                      <tr key={d.id}>
                        <td className="td-center">{i + 1}</td>
                        <td>{d.name || d.device_id}</td>
                        <td className="td-center">{TYPE_LABEL[d.type] ?? d.type}</td>
                        <td>{d.location || '—'}</td>
                        <td>{d.ip || '—'}</td>
                        <td>{d.mac || '—'}</td>
                        <td>{[d.os, d.app_version].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="td-center">{renderStatus(d.is_online)}</td>
                        <td className="td-center">{fmtTime(d.last_seen_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
