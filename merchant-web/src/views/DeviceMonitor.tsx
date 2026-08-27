import { useEffect, useMemo, useState } from 'react';
import Toast, { type ToastData } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { getBucket, putBucket } from '../api/buckets';

/** 设备配置桶 key */
const BUCKET_KEY = 'devices';

/** 设备类型 */
type DeviceType = 'POS' | 'Printer' | 'Tablet' | 'Scanner';

/** 设备状态 */
type DeviceStatus = 'online' | 'offline';

/** 设备档案 */
interface Device {
  id: string;
  name: string;
  type: DeviceType;
  location: string;
  ip: string;
  mac: string;
  status: DeviceStatus;
  lastSeen: string;
}

/** 新增 / 编辑表单 */
interface DeviceForm {
  id: string | null;
  name: string;
  type: DeviceType;
  location: string;
  ip: string;
  mac: string;
  status: DeviceStatus;
}

const DEVICE_TYPES: DeviceType[] = ['POS', 'Printer', 'Tablet', 'Scanner'];

const TYPE_LABEL: Record<DeviceType, string> = {
  POS: '收银机',
  Printer: '打印机',
  Tablet: '平板',
  Scanner: '扫码枪',
};

const emptyForm: DeviceForm = {
  id: null,
  name: '',
  type: 'POS',
  location: '',
  ip: '',
  mac: '',
  status: 'online',
};

/** 当前时间字符串：YYYY-MM-DD HH:mm:ss */
function now(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/** 简易 IPv4 校验 */
const isIPv4 = (s: string) =>
  /^((\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])\.){3}(\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])$/.test(s);

export default function DeviceMonitor() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState<DeviceForm>(emptyForm);
  const [delId, setDelId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  /** 从云端加载设备列表 */
  useEffect(() => {
    let active = true;
    getBucket<Device[]>(BUCKET_KEY)
      .then((data) => {
        if (active && Array.isArray(data)) setDevices(data);
      })
      .catch(() => {
        /* 忽略加载失败 */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /** 保存设备列表到云端 */
  const persist = async (next: Device[]) => {
    setDevices(next);
    try {
      await putBucket(BUCKET_KEY, next);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  const summary = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.status === 'online').length;
    return { total, online, offline: total - online };
  }, [devices]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({
      id: d.id,
      name: d.name,
      type: d.type,
      location: d.location,
      ip: d.ip,
      mac: d.mac,
      status: d.status,
    });
    setModalOpen(true);
  };

  const updateForm = <K extends keyof DeviceForm>(key: K, value: DeviceForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitForm = async () => {
    const name = form.name.trim();
    const location = form.location.trim();
    const ip = form.ip.trim();
    const mac = form.mac.trim();

    if (!name) {
      setToast({ type: 'warning', text: '请输入设备名称' });
      return;
    }
    if (!location) {
      setToast({ type: 'warning', text: '请输入设备位置' });
      return;
    }
    if (!ip) {
      setToast({ type: 'warning', text: '请输入 IP 地址' });
      return;
    }
    if (!isIPv4(ip)) {
      setToast({ type: 'warning', text: '请输入正确的 IP 地址' });
      return;
    }
    if (mac && !/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(mac)) {
      setToast({ type: 'warning', text: '请输入正确的 MAC 地址' });
      return;
    }

    if (editing) {
      const lastSeen = form.status === 'online' ? now() : editing.lastSeen;
      await persist(
        devices.map((d) =>
          d.id === editing.id
            ? { ...d, name, type: form.type, location, ip, mac, status: form.status, lastSeen }
            : d,
        ),
      );
      setToast({ type: 'success', text: '修改成功' });
    } else {
      await persist([
        ...devices,
        {
          id: `dev_${Date.now()}`,
          name,
          type: form.type,
          location,
          ip,
          mac,
          status: form.status,
          lastSeen: now(),
        },
      ]);
      setToast({ type: 'success', text: '新增成功' });
    }
    setModalOpen(false);
  };

  const confirmDelete = async () => {
    if (!delId) return;
    await persist(devices.filter((d) => d.id !== delId));
    setToast({ type: 'success', text: '删除成功' });
    setDelId(null);
  };

  const renderStatus = (s: DeviceStatus) => (
    <span className={`checkout-status ${s === 'online' ? 'on' : 'off'}`}>
      <i className="checkout-status-dot" />
      {s === 'online' ? '在线' : '离线'}
    </span>
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">设备监控</h1>
        <div className="page-head-actions">
          <button className="tm-btn tm-btn-primary" type="button" onClick={openAdd}>
            + 新增设备
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
          <div className="stat-sub">全部已注册设备</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-row">
            <span className="stat-label">在线设备</span>
          </div>
          <div className="stat-value">{summary.online}</div>
          <div className="stat-sub">状态为在线的设备</div>
        </div>
        <div className="panel stat-card">
          <div className="stat-row">
            <span className="stat-label">离线设备</span>
          </div>
          <div className="stat-value">{summary.offline}</div>
          <div className="stat-sub">状态为离线的设备</div>
        </div>
      </div>

      {/* 设备列表 */}
      <section className="panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel-head">
          <div className="panel-title">设备列表</div>
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
                  <col style={{ width: 90 }} />
                  <col style={{ width: 180 }} />
                  <col style={{ width: 130 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="th-center">序号</th>
                    <th>设备名称</th>
                    <th className="th-center">设备类型</th>
                    <th>位置</th>
                    <th>IP地址</th>
                    <th>MAC地址</th>
                    <th className="th-center">状态</th>
                    <th className="th-center">最后在线时间</th>
                    <th className="th-sticky">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 ? (
                    <tr>
                      <td className="checkout-empty-cell" colSpan={9}>
                        {loading ? '加载中…' : '暂无设备，点击右上角「新增设备」开始录入'}
                      </td>
                    </tr>
                  ) : (
                    devices.map((d, i) => (
                      <tr key={d.id}>
                        <td className="td-center">{i + 1}</td>
                        <td>{d.name}</td>
                        <td className="td-center">{TYPE_LABEL[d.type]}</td>
                        <td>{d.location}</td>
                        <td>{d.ip}</td>
                        <td>{d.mac || '—'}</td>
                        <td className="td-center">{renderStatus(d.status)}</td>
                        <td className="td-center">{d.lastSeen || '—'}</td>
                        <td className="td-sticky">
                          <div className="row-actions">
                            <button className="action-link" type="button" onClick={() => openEdit(d)}>
                              编辑
                            </button>
                            <button
                              className="action-link danger"
                              type="button"
                              onClick={() => setDelId(d.id)}
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 新增 / 编辑弹窗 */}
      {modalOpen && (
        <div className="modal-mask" onClick={() => setModalOpen(false)}>
          <div className="modal-card" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{editing ? '编辑设备' : '新增设备'}</div>
              <button className="modal-close" aria-label="关闭" type="button" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="dish-form-item">
                <label className="dish-form-item-label">
                  <span className="required-mark">*</span>设备名称
                </label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    placeholder="如：前台收银机"
                    maxLength={20}
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                  />
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label">
                  <span className="required-mark">*</span>设备类型
                </label>
                <div className="dish-form-item-control">
                  <select
                    className="category-select"
                    value={form.type}
                    onChange={(e) => updateForm('type', e.target.value as DeviceType)}
                  >
                    {DEVICE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label">
                  <span className="required-mark">*</span>位置
                </label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    placeholder="如：前台、后厨、包间1"
                    maxLength={20}
                    value={form.location}
                    onChange={(e) => updateForm('location', e.target.value)}
                  />
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label">
                  <span className="required-mark">*</span>IP地址
                </label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    placeholder="如：192.168.1.100"
                    value={form.ip}
                    onChange={(e) => updateForm('ip', e.target.value)}
                  />
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label">MAC地址</label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    placeholder="选填，如：AA:BB:CC:DD:EE:FF"
                    value={form.mac}
                    onChange={(e) => updateForm('mac', e.target.value)}
                  />
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label">状态</label>
                <div className="dish-form-item-control">
                  <div className="area-form-radios">
                    {(['online', 'offline'] as const).map((st) => (
                      <label key={st} className="radio-item">
                        <input
                          type="radio"
                          name="deviceStatus"
                          checked={form.status === st}
                          onChange={() => updateForm('status', st)}
                        />
                        <span className="radio-dot" />
                        <span>{st === 'online' ? '在线' : '离线'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setModalOpen(false)}>
                取消
              </button>
              <button className="tm-btn tm-btn-primary" type="button" onClick={submitForm}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      <ConfirmModal
        open={!!delId}
        title="确认删除"
        message="确定要删除该设备吗？删除后不可恢复。"
        confirmText="删除"
        cancelText="取消"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDelId(null)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
