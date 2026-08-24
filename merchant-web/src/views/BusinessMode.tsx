import { useEffect, useMemo, useState } from 'react';
import Toast, { type ToastData } from '../components/Toast';
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

const MODULES = ['全部', '菜品设置', '收银基础设置', '手机点餐设置', '财务设置', '系统设置'];

const DEFAULT_SETTINGS: SettingItem[] = [
  { id: '1', module: '菜品设置', name: '加料支持单独销售', type: 'switch', desc: '开启后，加料可在收银端、手机点餐端单独售卖', value: true },
  { id: '2', module: '菜品设置', name: '餐盒支持单独售卖', type: 'switch', desc: '开启后，餐盒可在收银端单独售卖', value: false },
  { id: '3', module: '收银基础设置', name: '点餐形式', type: 'select', desc: '仅在快餐/茶饮生效', options: ['既可以桌台开台点餐又可以直接点餐', '仅桌台开台点餐', '仅直接点餐'], value: '既可以桌台开台点餐又可以直接点餐' },
  { id: '4', module: '收银基础设置', name: '开台必点固定菜品数量随人数自动增加', type: 'switch', desc: '开启后，如设置每人1份的固定菜品在开台后自动加入购物车，增加桌台人数后，菜品数量将随人数增加', value: true },
  { id: '5', module: '收银基础设置', name: '按默认人数直接开台', type: 'switch', desc: '开启后，开台将按默认人数直接开台，不包含联台操作开台', value: false },
  { id: '6', module: '收银基础设置', name: '显示打印消费单', type: 'switch', desc: '开启后，下单前可打印消费单', value: false },
  { id: '7', module: '收银基础设置', name: '支持整单催菜/整单起菜/整单等叫', type: 'switch', desc: '开启后，POS、点餐助手、平板均展示整单催菜、整单起菜、整单等叫的入口', value: true },
  { id: '8', module: '收银基础设置', name: '称重菜改重提示', type: 'switch', desc: '开启后，称重菜如果下单后没修改过重量，购物车和桌台会显示改重提醒', value: true },
  { id: '9', module: '收银基础设置', name: '宴会套餐子菜支持退菜', type: 'switch', desc: '开启后，宴会开台后，宴会套餐子菜支持操作退菜，仅 POS 端生效', value: false },
  { id: '10', module: '收银基础设置', name: '普通套餐子菜支持退菜', type: 'switch', desc: '开启后，套餐子菜也支持退菜，退菜后套餐价格不会发生变化', value: false },
  { id: '11', module: '收银基础设置', name: '桌台修改人数不可超过标准用餐人数上限', type: 'switch', desc: '开启后，正餐桌台编辑人数时，不可超过桌台设置的标准用餐人数上限', value: true },
  { id: '12', module: '收银基础设置', name: '菜品超时预警提示', type: 'switch', desc: '开启后，针对桌台内已下单未划菜菜品会有变色，桌台也有明显预警', value: false },
  { id: '13', module: '收银基础设置', name: '结账后自动清台', type: 'switch', desc: '开启后，结账完成自动清台', value: false },
  { id: '14', module: '收银基础设置', name: '锁台设置', type: 'select', desc: '锁台后，其他账号无法操作锁定的桌台', options: ['无需锁台', '手动锁台', '结账后自动锁台'], value: '无需锁台' },
  { id: '15', module: '收银基础设置', name: '餐牌号规则', type: 'select', desc: '该取餐号配置仅对收银 POS 生效', options: ['手动输入餐牌号', '按取餐号自动生成'], value: '手动输入餐牌号' },
  { id: '16', module: '收银基础设置', name: '流水号重置时间', type: 'select', desc: '', options: ['每日零点', '每次营业开始时'], value: '每日零点' },
  { id: '17', module: '收银基础设置', name: '起始流水号', type: 'number', desc: '', value: 1 },
  { id: '18', module: '收银基础设置', name: '点餐助手结账后直接返回首页', type: 'switch', desc: '打开开关后，助手订单结账后直接返回首页，而不是继续点餐', value: false },
  { id: '19', module: '手机点餐设置', name: '开启手机点餐', type: 'switch', desc: '开启后，顾客可通过扫描桌上二维码进行点餐', value: true },
  { id: '20', module: '手机点餐设置', name: '扫码点餐免密支付', type: 'switch', desc: '开启后，顾客扫码点餐结账时无需输入支付密码', value: false },
  { id: '21', module: '手机点餐设置', name: '手机点餐支持预点餐', type: 'switch', desc: '开启后，顾客可在到店前提前下单', value: true },
  { id: '22', module: '财务设置', name: '结账后打印小票', type: 'switch', desc: '开启后，结账成功后自动打印结账小票', value: true },
  { id: '23', module: '财务设置', name: '整单折扣上限', type: 'number', desc: '单笔订单允许的最大折扣比例（百分比）', value: 100 },
  { id: '24', module: '财务设置', name: '允许负向结账', type: 'switch', desc: '开启后，允许订单实收金额为负数', value: false },
  { id: '25', module: '系统设置', name: '自动更新收银机时间', type: 'switch', desc: '开启后，收银机自动与服务器同步时间', value: true },
  { id: '26', module: '系统设置', name: '营业数据日报推送', type: 'switch', desc: '开启后，每日营业结束后推送营业日报到商户后台', value: true },
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
        if (active && Array.isArray(data) && data.length) setSettings(data);
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
      <select
        className="ant-input"
        style={{ width: 220, marginTop: 6 }}
        value={String(s.value)}
        onChange={(e) => onChange(s.id, e.target.value)}
      >
        {(s.options ?? []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
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
