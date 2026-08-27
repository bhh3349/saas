import { useEffect, useState } from 'react';
import Toast, { type ToastData } from '../components/Toast';
import { getBucket, putBucket } from '../api/buckets';
import { getStoredUser } from '../api/http';
import type { MerchantUser } from '../api/types';

/** 打印业务设置桶 key */
const BUCKET_KEY = 'print-business';

/** 加料出单方式 */
type AddonMode = 'main' | 'self';
/** 页码计算逻辑 */
type PageCalcMode = 'stall' | 'global';

interface PrintBusinessConfig {
  // ===== 业务基础设置 =====
  /** 打印任务失败后多久之内自动重试（分钟） */
  retryMinutes: number;
  /** 新增菜品时后厨打印默认设置为：打印 / 不打印 */
  newDishPrint: boolean;
  /** 新增菜品时自动关联的档口设置为：默认推荐 / 智能推荐 */
  autoStallMode: 'default' | 'smart';
  /** 并台时是否打印转菜单 */
  printTransferOnMerge: boolean;
  /** 转台时是否打印转菜单 */
  printTransferOnMove: boolean;
  /** 扫码划菜 */
  scanMarkDish: boolean;
  /** 打印默认字体设置 */
  defaultFont: string;
  /** 打印机简化模式 */
  simplifiedMode: boolean;
  /** 加料出单方式：按主菜的档口出单 / 按自身的档口出单 */
  addonMode: AddonMode;

  // ===== 票据样式显示 =====
  /** 后厨制作单特定打印机红色字体打印 */
  kitchenRedFont: boolean;
  /** 显示菜品序号 */
  showDishIndex: boolean;
  /** 后厨类单据数量是否显示单位 */
  kitchenShowUnit: boolean;
  /** 前台类单据菜品优惠标签展示 */
  showDiscountTag: boolean;
  /** 收银类票据是否显示桌台区域 */
  showTableAreaCashier: boolean;
  /** 后厨类票据是否显示桌台区域 */
  showTableAreaKitchen: boolean;
  /** 收银类票据是否打印套餐子菜 */
  printComboSubCashier: boolean;
  /** 后厨类票据是否打印套餐子菜 */
  printComboSubKitchen: boolean;
  /** 是否不打印套餐头 */
  noPrintComboHeader: boolean;
  /** 打印机语音播报 */
  voiceBroadcast: boolean;
  /** 单据页码计算逻辑 */
  pageCalcMode: PageCalcMode;
  /** 热敏打印逻辑变色 */
  thermalColorChange: boolean;
  /** 显示菜品别名 */
  showDishAlias: boolean;

  // ===== 元数据 =====
  updatedAt?: string;
  operator?: string;
}

/** 默认配置 */
const DEFAULT_CONFIG: PrintBusinessConfig = {
  retryMinutes: 10,
  newDishPrint: true,
  autoStallMode: 'default',
  printTransferOnMerge: true,
  printTransferOnMove: false,
  scanMarkDish: false,
  defaultFont: '宋体',
  simplifiedMode: false,
  addonMode: 'main',

  kitchenRedFont: false,
  showDishIndex: false,
  kitchenShowUnit: true,
  showDiscountTag: true,
  showTableAreaCashier: true,
  showTableAreaKitchen: false,
  printComboSubCashier: true,
  printComboSubKitchen: true,
  noPrintComboHeader: false,
  voiceBroadcast: true,
  pageCalcMode: 'stall',
  thermalColorChange: false,
  showDishAlias: false,
};

/** 兼容缺字段数据 */
const normalize = (raw: Partial<PrintBusinessConfig> | null): PrintBusinessConfig => ({
  ...DEFAULT_CONFIG,
  ...(raw ?? {}),
});

const FONT_OPTIONS = ['宋体', '黑体', '微软雅黑', '楷体'];

/** 当前登录账号 */
const currentOperator = (): string => {
  const u = getStoredUser<MerchantUser>();
  return u?.name?.trim() || u?.phone || '-';
};

/** 设置行组件：标签 + 控件 + 说明 */
function SettingRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-setting-row">
      <div className="pb-setting-label">
        <span className="pb-setting-name">{label}</span>
        {desc && <span className="pb-setting-desc">{desc}</span>}
      </div>
      <div className="pb-setting-control">{children}</div>
    </div>
  );
}

/** 开关组件 */
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="checkout-switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="checkout-switch-slider" />
    </label>
  );
}

export default function PrintSettings() {
  const [config, setConfig] = useState<PrintBusinessConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getBucket<Partial<PrintBusinessConfig>>(BUCKET_KEY);
        if (active && data) setConfig(normalize(data));
      } catch {
        /* 加载失败保持默认配置 */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const patch = <K extends keyof PrintBusinessConfig>(key: K, value: PrintBusinessConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const payload: PrintBusinessConfig = { ...config, updatedAt: now, operator: currentOperator() };
      setConfig(payload);
      await putBucket(BUCKET_KEY, payload);
      setToast({ type: 'success', text: '打印设置保存成功' });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setToast({ type: 'info', text: '已恢复默认设置（需点击保存生效）' });
  };

  return (
    <div className="page print-business-page">
      <div className="page-head">
        <h1 className="page-title">打印设置</h1>
        {config.updatedAt && (
          <span className="pb-last-saved">上次保存：{config.updatedAt}</span>
        )}
      </div>

      {/* ===== 一、业务基础设置 ===== */}
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">业务基础设置</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {/* 设置名称 | 参数设置及说明 */}
          <div className="pb-setting-header">
            <span>设置名称</span>
            <span>参数设置及说明</span>
          </div>

          <SettingRow
            label="打印任务失败后多久之内自动重试"
            desc="自动重试超时后仍失败将发送失败通知"
          >
            <div className="pb-input-group">
              <input
                type="number"
                min={1}
                max={120}
                value={config.retryMinutes}
                disabled={loading}
                onChange={(e) => patch('retryMinutes', Math.max(1, Number(e.target.value) || 1))}
                className="pb-num-input"
              />
              <span className="pb-unit">分钟</span>
            </div>
          </SettingRow>

          <SettingRow
            label="新增菜品时后厨打印默认设置为"
          >
            <div className="pb-radio-group">
              <label className="radio-item">
                <input
                  type="radio"
                  name="new-dish-print"
                  checked={config.newDishPrint}
                  onChange={() => patch('newDishPrint', true)}
                />
                <span className="radio-dot" />
                打印
              </label>
              <label className="radio-item">
                <input
                  type="radio"
                  name="new-dish-print"
                  checked={!config.newDishPrint}
                  onChange={() => patch('newDishPrint', false)}
                />
                <span className="radio-dot" />
                不打印
              </label>
            </div>
          </SettingRow>

          <SettingRow
            label="新增菜品时自动关联的档口设置为"
            desc="默认推荐档口优先绑定已关联打印机的档口；智能推荐档口由 AI 智能推荐"
          >
            <div className="pb-radio-group">
              <label className="radio-item">
                <input
                  type="radio"
                  name="auto-stall-mode"
                  checked={config.autoStallMode === 'default'}
                  onChange={() => patch('autoStallMode', 'default')}
                />
                <span className="radio-dot" />
                默认推荐档口
              </label>
              <label className="radio-item">
                <input
                  type="radio"
                  name="auto-stall-mode"
                  checked={config.autoStallMode === 'smart'}
                  onChange={() => patch('autoStallMode', 'smart')}
                />
                <span className="radio-dot" />
                智能推荐档口
              </label>
            </div>
          </SettingRow>

          <SettingRow
            label="并台时是否打印转菜单"
          >
            <Toggle
              checked={config.printTransferOnMerge}
              onChange={(v) => patch('printTransferOnMerge', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="转台时是否打印转菜单"
          >
            <Toggle
              checked={config.printTransferOnMove}
              onChange={(v) => patch('printTransferOnMove', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="扫码划菜"
            desc="开启后可通过扫码快速划菜"
          >
            <Toggle
              checked={config.scanMarkDish}
              onChange={(v) => patch('scanMarkDish', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="打印默认字体设置"
          >
            <select
              className="pb-select"
              value={config.defaultFont}
              disabled={loading}
              onChange={(e) => patch('defaultFont', e.target.value)}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </SettingRow>

          <SettingRow
            label="打印机简化模式"
            desc="开启后菜品可直接关联出票打印机，简化菜品打印配置流程"
          >
            <Toggle
              checked={config.simplifiedMode}
              onChange={(v) => patch('simplifiedMode', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="加料出单方式"
          >
            <div className="pb-radio-group">
              <label className="radio-item">
                <input
                  type="radio"
                  name="addon-mode"
                  checked={config.addonMode === 'main'}
                  onChange={() => patch('addonMode', 'main')}
                />
                <span className="radio-dot" />
                按主菜的档口出单
              </label>
              <label className="radio-item">
                <input
                  type="radio"
                  name="addon-mode"
                  checked={config.addonMode === 'self'}
                  onChange={() => patch('addonMode', 'self')}
                />
                <span className="radio-dot" />
                按自身的档口出单
              </label>
            </div>
          </SettingRow>
        </div>
      </section>

      {/* ===== 二、票据样式显示 ===== */}
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">票据样式显示</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="pb-setting-header">
            <span>设置名称</span>
            <span>参数设置及说明</span>
          </div>

          <SettingRow
            label="后厨制作单特定打印机红色字体打印"
            desc="需特定型号热敏打印机支持"
          >
            <Toggle
              checked={config.kitchenRedFont}
              onChange={(v) => patch('kitchenRedFont', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="显示菜品序号"
          >
            <Toggle
              checked={config.showDishIndex}
              onChange={(v) => patch('showDishIndex', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="后厨类单据数量是否显示单位"
          >
            <Toggle
              checked={config.kitchenShowUnit}
              onChange={(v) => patch('kitchenShowUnit', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="前台类单据菜品优惠标签展示"
            desc="赠（赠品类）· 会（会员价）· X%（打折类）· 减（减免类）· 特（特价类）"
          >
            <Toggle
              checked={config.showDiscountTag}
              onChange={(v) => patch('showDiscountTag', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="是否显示桌台区域"
            desc="收银类票据（结账单、客单、预结单）和后厨类票据分别控制"
          >
            <div className="pb-sub-toggles">
              <label className="pb-sub-toggle">
                <span>收银类票据</span>
                <Toggle
                  checked={config.showTableAreaCashier}
                  onChange={(v) => patch('showTableAreaCashier', v)}
                  disabled={loading}
                />
              </label>
              <label className="pb-sub-toggle">
                <span>后厨类票据</span>
                <Toggle
                  checked={config.showTableAreaKitchen}
                  onChange={(v) => patch('showTableAreaKitchen', v)}
                  disabled={loading}
                />
              </label>
            </div>
          </SettingRow>

          <SettingRow
            label="是否打印套餐子菜"
            desc="收银类票据和后厨类票据分别控制"
          >
            <div className="pb-sub-toggles">
              <label className="pb-sub-toggle">
                <span>收银类票据</span>
                <Toggle
                  checked={config.printComboSubCashier}
                  onChange={(v) => patch('printComboSubCashier', v)}
                  disabled={loading}
                />
              </label>
              <label className="pb-sub-toggle">
                <span>后厨类票据</span>
                <Toggle
                  checked={config.printComboSubKitchen}
                  onChange={(v) => patch('printComboSubKitchen', v)}
                  disabled={loading}
                />
              </label>
            </div>
          </SettingRow>

          <SettingRow
            label="是否不打印套餐头"
          >
            <Toggle
              checked={config.noPrintComboHeader}
              onChange={(v) => patch('noPrintComboHeader', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="打印机语音播报"
            desc="在有退菜、催菜、补打时进行语音提示（需特定型号打印机支持）"
          >
            <Toggle
              checked={config.voiceBroadcast}
              onChange={(v) => patch('voiceBroadcast', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="单据页码计算逻辑"
          >
            <div className="pb-radio-group">
              <label className="radio-item">
                <input
                  type="radio"
                  name="page-calc"
                  checked={config.pageCalcMode === 'stall'}
                  onChange={() => patch('pageCalcMode', 'stall')}
                />
                <span className="radio-dot" />
                按档口计算
              </label>
              <label className="radio-item">
                <input
                  type="radio"
                  name="page-calc"
                  checked={config.pageCalcMode === 'global'}
                  onChange={() => patch('pageCalcMode', 'global')}
                />
                <span className="radio-dot" />
                全局计算
              </label>
            </div>
          </SettingRow>

          <SettingRow
            label="热敏打印逻辑变色"
            desc="当数量大于等于设定值时，数量字段将变色或反转底色（需特定型号打印机和打印纸）"
          >
            <Toggle
              checked={config.thermalColorChange}
              onChange={(v) => patch('thermalColorChange', v)}
              disabled={loading}
            />
          </SettingRow>

          <SettingRow
            label="显示菜品别名"
          >
            <Toggle
              checked={config.showDishAlias}
              onChange={(v) => patch('showDishAlias', v)}
              disabled={loading}
            />
          </SettingRow>
        </div>
      </section>

      {/* ===== 底部操作栏 ===== */}
      <div className="pb-action-bar">
        <button
          type="button"
          className="tm-btn tm-btn-default"
          onClick={handleReset}
          disabled={loading || saving}
        >
          恢复默认
        </button>
        <button
          type="button"
          className="tm-btn tm-btn-primary"
          onClick={handleSave}
          disabled={loading || saving}
        >
          {saving ? '保存中…' : '保存设置'}
        </button>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
