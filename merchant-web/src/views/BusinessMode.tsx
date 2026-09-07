import { useEffect, useMemo, useState } from 'react';
import Toast, { type ToastData } from '../components/Toast';
import CommonSelect from '../components/CommonSelect';
import { getBucket, putBucket } from '../api/buckets';

/** 营业设置配置桶 key */
const BUCKET_KEY = 'business_settings';

/** 设置项控件类型 */
type SettingType = 'switch' | 'select' | 'number';

interface SettingItem {
  id: string;
  module: string;
  name: string;
  type: SettingType;
  desc: string;
  options?: string[];
  value: string | number | boolean;
}

const MODULES = ['全部', '菜品设置', '手机点餐设置', '收银基础设置', '财务设置'];

const DEFAULT_SETTINGS: SettingItem[] = [
  { id: '1', module: '菜品设置', name: '加料支持单独销售', type: 'switch', desc: '开启后，加料可在收银端、手机点餐端单独售卖', value: true },
  { id: '2', module: '菜品设置', name: '餐盒支持单独售卖', type: 'switch', desc: '开启后，餐盒可在收银端单独售卖', value: false },
  { id: '3', module: '手机点餐设置', name: '开启手机点餐', type: 'switch', desc: '开启后，顾客可通过扫描桌上二维码进行点餐', value: true },
  { id: '4', module: '手机点餐设置', name: '手机点餐支持预点餐', type: 'switch', desc: '开启后，顾客可在到店前提前下单', value: true },
  { id: '5', module: '手机点餐设置', name: '自营外卖', type: 'switch', desc: '开启后，手机点餐端展示自营外卖入口', value: false },
  { id: '6', module: '收银基础设置', name: '菜品超时预警提示', type: 'switch', desc: '开启后，已下单未划菜菜品在桌台展示预警', value: false },
  { id: '7', module: '收银基础设置', name: '结账后自动清台', type: 'switch', desc: '开启后，结账完成自动清台', value: false },
  { id: '8', module: '财务设置', name: '结账后打印小票', type: 'switch', desc: '开启后，结账成功后自动打印结账小票', value: true },
];

export default function BusinessMode() {
  const [settings, setSettings] = useState<SettingItem[]>(DEFAULT_SETTINGS);
  const [activeModule, setActiveModule] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);

  /** 从云端加载营业设置 */
  useEffect(() => {
    let active = true;
    getBucket<SettingItem[]>(BUCKET_KEY)
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        setSettings(DEFAULT_SETTINGS.map((item) => {
          const saved = data.find((s) => s.id === item.id);
          return saved ? { ...item, value: saved.value } : item;
        }));
      })
      .catch(() => {
        /* 忽略加载失败 */
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return settings.filter((s) => {
      if (activeModule !== '全部' && s.module !== activeModule) return false;
      if (keyword && !s.name.includes(keyword)) return false;
      return true;
    });
  }, [settings, activeModule, keyword]);

  const moduleCounts = useMemo(() => {
    const map: Record<string, number> = {};
    MODULES.forEach((m) => (map[m] = 0));
    settings.forEach((s) => {
      map['全部']++;
      if (map[s.module] !== undefined) map[s.module]++;
    });
    return map;
  }, [settings]);

  const updateValue = (id: string, value: string | number | boolean) => {
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, value } : s)));
  };

  const saveAll = async () => {
    try {
      await putBucket(BUCKET_KEY, settings);
      setToast({ type: 'success', text: '保存成功' });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">营业模式设置</h1>
        <div className="page-actions">
          <button className="saas-btn saas-btn-primary" onClick={saveAll}>保存</button>
        </div>
      </div>

      <div className="print-assign-body">
        {/* 左侧模块 Tab */}
        <div className="category-sidebar">
          <div className="category-tree">
            {MODULES.map((m) => (
              <div
                key={m}
                className={`category-item ${activeModule === m ? 'active' : ''}`}
                onClick={() => setActiveModule(m)}
              >
                <span className="category-name">{m}</span>
                <span className="category-count">{moduleCounts[m] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧设置项列表 */}
        <div className="checkout-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12 }}>
            <input
              className="ant-input"
              style={{ width: 200 }}
              placeholder="请输入设置名称"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="data-table checkout-table" style={{ flex: 1 }}>
            <div className="area-table-scroll checkout-scroll">
              <table className="checkout-real-table">
                <colgroup>
                  <col style={{ width: 120 }} />
                  <col style={{ width: 260 }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th>业务模块</th>
                    <th>设置名称</th>
                    <th>参数与说明</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td className="checkout-empty-cell" colSpan={3}>暂无数据</td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr key={s.id} style={{ height: 64 }}>
                        <td>{s.module}</td>
                        <td>
                          <div className="setting-name">{s.name}</div>
                          {renderControl(s, updateValue)}
                        </td>
                        <td className="setting-desc">{s.desc}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function renderControl(
  s: SettingItem,
  onChange: (id: string, value: string | number | boolean) => void,
) {
  if (s.type === 'switch') {
    return (
      <label className="setting-switch-row" style={{ marginTop: 6 }}>
        <input
          type="checkbox"
          className="setting-switch"
          checked={Boolean(s.value)}
          onChange={(e) => onChange(s.id, e.target.checked)}
        />
        <span className="setting-switch-track"><span className="setting-switch-thumb" /></span>
      </label>
    );
  }
  if (s.type === 'select') {
    return (
      <CommonSelect
        width={220}
        value={String(s.value)}
        options={(s.options ?? []).map((opt) => ({ value: opt, label: opt }))}
        onChange={(value) => onChange(s.id, value)}
      />
    );
  }
  return (
    <input
      className="ant-input"
      style={{ width: 120, marginTop: 6 }}
      type="number"
      value={Number(s.value)}
      onChange={(e) => onChange(s.id, Number(e.target.value))}
    />
  );
}
