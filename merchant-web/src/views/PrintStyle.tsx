import { useEffect, useState } from 'react';
import Toast, { type ToastData } from '../components/Toast';
import { getStoredUser } from '../api/http';
import type { MerchantUser } from '../api/types';
import { getBucket, putBucket } from '../api/buckets';

/** 票据样式配置桶 key */
const BUCKET_KEY = 'print-style';

/** 纸张宽度 */
type PaperWidth = '58' | '80';
/** 字体大小 */
type FontSize = 'small' | 'medium' | 'large';

/** 小票分组 */
type TicketGroup = 'cashier' | 'kitchen';

/** 收银小票类型 */
type CashierTicket =
  | '客单'
  | '预结单'
  | '结账单'
  | '交班单'
  | '退单';

/** 后厨小票类型 */
type KitchenTicket =
  | '制作单'
  | '退菜单'
  | '催菜单'
  | '起菜单'
  | '转菜单'
  | '转台单'
  | '传菜单'
  | '整桌通知单'
  | '菜品备注单';

/** 所有小票类型 */
type TicketType = CashierTicket | KitchenTicket;

/** 小票分组定义 */
const TICKET_GROUPS: { group: TicketGroup; title: string; types: TicketType[] }[] = [
  {
    group: 'cashier',
    title: '收银小票',
    types: ['客单', '预结单', '结账单', '交班单', '退单'],
  },
  {
    group: 'kitchen',
    title: '后厨小票',
    types: [
      '制作单', '退菜单', '催菜单', '起菜单', '转菜单',
      '转台单', '传菜单', '整桌通知单', '菜品备注单',
    ],
  },
];

/** 所有小票类型扁平列表 */
const ALL_TICKETS: TicketType[] = TICKET_GROUPS.flatMap((g) => g.types);

/** 判断小票属于哪个分组 */
const groupOf = (t: TicketType): TicketGroup =>
  TICKET_GROUPS.find((g) => g.types.includes(t))?.group ?? 'cashier';

/** 票据可显示区块开关 key */
type SectionKey =
  | 'storeName' | 'storePhone' | 'storeAddress'
  | 'cashierName' | 'orderNumber' | 'tableNumber' | 'orderTime'
  | 'itemsDetail' | 'subtotal' | 'discountAmount' | 'totalAmount'
  | 'paymentMethod' | 'changeAmount' | 'qrcode'
  | 'stallName' | 'dishMethods' | 'qty' | 'itemMerge';

/** 区块定义（顺序即展示顺序，applicable 指定适用于哪些分组） */
const SECTION_DEFS: { key: SectionKey; label: string; applicable: TicketGroup[] }[] = [
  { key: 'storeName', label: '门店名称', applicable: ['cashier', 'kitchen'] },
  { key: 'storePhone', label: '门店电话', applicable: ['cashier'] },
  { key: 'storeAddress', label: '门店地址', applicable: ['cashier'] },
  { key: 'stallName', label: '档口名称', applicable: ['kitchen'] },
  { key: 'cashierName', label: '收银员姓名', applicable: ['cashier'] },
  { key: 'orderNumber', label: '订单号', applicable: ['cashier', 'kitchen'] },
  { key: 'tableNumber', label: '桌位号', applicable: ['cashier', 'kitchen'] },
  { key: 'orderTime', label: '下单时间', applicable: ['cashier', 'kitchen'] },
  { key: 'itemsDetail', label: '菜品明细', applicable: ['cashier', 'kitchen'] },
  { key: 'dishMethods', label: '做法/备注', applicable: ['kitchen'] },
  { key: 'qty', label: '份数', applicable: ['kitchen'] },
  { key: 'itemMerge', label: '合并相同菜', applicable: ['kitchen'] },
  { key: 'subtotal', label: '小计金额', applicable: ['cashier'] },
  { key: 'discountAmount', label: '优惠金额', applicable: ['cashier'] },
  { key: 'totalAmount', label: '应付金额', applicable: ['cashier'] },
  { key: 'paymentMethod', label: '支付方式', applicable: ['cashier'] },
  { key: 'changeAmount', label: '找零金额', applicable: ['cashier'] },
  { key: 'qrcode', label: '二维码', applicable: ['cashier'] },
];

/** 票据样式配置 */
interface PrintStyleConfig {
  paperWidth: PaperWidth;
  fontSize: FontSize;
  headerText: string;
  footerText: string;
  sections: Record<SectionKey, boolean>;
  updatedAt?: string;
  operator?: string;
}

/** 默认 sections（全开） */
const ALL_SECTIONS_ON = (): Record<SectionKey, boolean> =>
  SECTION_DEFS.reduce<Record<SectionKey, boolean>>((acc, d) => {
    acc[d.key] = true;
    return acc;
  }, {} as Record<SectionKey, boolean>);

/** 按分组生成默认配置 */
const defaultConfig = (group: TicketGroup): PrintStyleConfig => ({
  paperWidth: '80',
  fontSize: 'medium',
  headerText: '',
  footerText: group === 'cashier' ? '欢迎光临' : '',
  sections: (() => {
    const base = {} as Record<SectionKey, boolean>;
    SECTION_DEFS.forEach((d) => {
      base[d.key] = d.applicable.includes(group);
    });
    return base;
  })(),
});

/** 全类型默认配置 */
const DEFAULT_CONFIGS = (): Record<TicketType, PrintStyleConfig> => {
  const map = {} as Record<TicketType, PrintStyleConfig>;
  ALL_TICKETS.forEach((t) => {
    map[t] = defaultConfig(groupOf(t));
  });
  return map;
};

/** 兼容旧版/缺字段数据 */
const normalize = (raw: Partial<PrintStyleConfig> | null, group: TicketGroup): PrintStyleConfig => {
  if (!raw) return defaultConfig(group);
  const baseSections = defaultConfig(group).sections;
  const incoming: Partial<Record<SectionKey, boolean>> = (raw.sections ?? {}) as Partial<Record<SectionKey, boolean>>;
  (Object.keys(baseSections) as SectionKey[]).forEach((k) => {
    if (typeof incoming[k] === 'boolean') baseSections[k] = incoming[k]!;
  });
  return {
    paperWidth: raw.paperWidth === '58' || raw.paperWidth === '80' ? raw.paperWidth : '80',
    fontSize:
      raw.fontSize === 'small' || raw.fontSize === 'medium' || raw.fontSize === 'large'
        ? raw.fontSize
        : 'medium',
    headerText: typeof raw.headerText === 'string' ? raw.headerText : '',
    footerText: typeof raw.footerText === 'string' ? raw.footerText : (group === 'cashier' ? '欢迎光临' : ''),
    sections: baseSections,
    updatedAt: raw.updatedAt,
    operator: raw.operator,
  };
};

/** 当前登录账号（操作人） */
const currentOperator = (): string => {
  const u = getStoredUser<MerchantUser>();
  if (!u) return '-';
  return u.name?.trim() || u.phone || '-';
};

/** 纸张宽度映射为预览像素宽度 */
const paperPx = (w: PaperWidth): number => (w === '58' ? 220 : 300);
/** 字体大小映射为预览字号 */
const fontPx = (s: FontSize): number => (s === 'small' ? 11 : s === 'large' ? 15 : 13);

export default function PrintStyle() {
  const [configs, setConfigs] = useState<Record<TicketType, PrintStyleConfig>>(DEFAULT_CONFIGS);
  const [selected, setSelected] = useState<TicketType>('客单');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  /** Toast 自动消失 */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /** 从 bucket 加载全类型配置 */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getBucket<Partial<Record<TicketType, Partial<PrintStyleConfig>>>>(BUCKET_KEY);
        if (!active || !data) return;
        const next = DEFAULT_CONFIGS();
        ALL_TICKETS.forEach((t) => {
          if (data[t]) next[t] = normalize(data[t]!, groupOf(t));
        });
        if (active) setConfigs(next);
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

  const group = groupOf(selected);
  const config = configs[selected];

  const patch = (p: Partial<PrintStyleConfig>) =>
    setConfigs((prev) => ({ ...prev, [selected]: { ...prev[selected], ...p } }));

  const patchSection = (key: SectionKey, on: boolean) =>
    setConfigs((prev) => ({
      ...prev,
      [selected]: { ...prev[selected], sections: { ...prev[selected].sections, [key]: on } },
    }));

  /** 保存当前类型配置到 bucket */
  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const payload: PrintStyleConfig = {
        ...config,
        updatedAt: now,
        operator: currentOperator(),
      };
      const next = { ...configs, [selected]: payload };
      setConfigs(next);
      await putBucket(BUCKET_KEY, next);
      setToast({ type: 'success', text: `${selected} 样式保存成功` });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  /** 一键全开 / 全关（仅当前分组适用的字段） */
  const toggleAll = (on: boolean) => {
    const applicableKeys = SECTION_DEFS.filter((d) => d.applicable.includes(group)).map((d) => d.key);
    setConfigs((prev) => ({
      ...prev,
      [selected]: {
        ...prev[selected],
        sections: applicableKeys.reduce<Record<SectionKey, boolean>>((acc, k) => {
          acc[k] = on;
          return acc;
        }, { ...prev[selected].sections }),
      },
    }));
  };

  /** 当前分组适用的字段 */
  const applicableSections = SECTION_DEFS.filter((d) => d.applicable.includes(group));
  const allOn = applicableSections.every((d) => config.sections[d.key]);

  const { sections } = config;
  const previewWidth = paperPx(config.paperWidth);
  const previewFont = fontPx(config.fontSize);

  /** 预览：示例数据 */
  const sampleItems =
    group === 'cashier'
      ? [
          { name: '招牌牛肉面', qty: 2, price: 28, method: '' },
          { name: '凉拌黄瓜', qty: 1, price: 8, method: '' },
          { name: '酸梅汤', qty: 2, price: 6, method: '' },
        ]
      : [
          { name: '宫保鸡丁', qty: 1, price: 32, method: '微辣' },
          { name: '水煮鱼', qty: 1, price: 68, method: '中辣' },
          { name: '白米饭', qty: 3, price: 2, method: '' },
        ];
  const sampleSubtotal = sampleItems.reduce((s, i) => s + i.qty * i.price, 0);
  const sampleDiscount = group === 'cashier' ? 5 : 0;
  const sampleTotal = sampleSubtotal - sampleDiscount;

  return (
    <div className="page print-style-page">
      <div className="page-head">
        <h1 className="page-title">票据样式</h1>
      </div>

      <div className="print-style-body">
        {/* ===== 左侧：小票类型列表 ===== */}
        <div className="print-style-ticket-nav">
          {TICKET_GROUPS.map((g) => (
            <div className="print-style-ticket-group" key={g.group}>
              <div className="print-style-ticket-group-title">{g.title}</div>
              <div className="print-style-ticket-list">
                {g.types.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`print-style-ticket-item${selected === t ? ' active' : ''}`}
                    onClick={() => setSelected(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ===== 中间：配置表单 ===== */}
        <div className="panel print-style-form-panel" style={{ flex: 1, minWidth: 0 }}>
          <div className="panel-head">
            <span className="panel-title">
              {group === 'cashier' ? '收银小票' : '后厨小票'} - {selected}
            </span>
            {loading ? (
              <span className="print-style-hint">加载中…</span>
            ) : (
              <span className="print-style-hint">
                {config.updatedAt ? `上次保存：${config.updatedAt}` : '尚未保存'}
              </span>
            )}
          </div>

          <div className="checkout-form" style={{ padding: '4px 4px 8px' }}>
            {/* 纸张宽度 */}
            <div className="checkout-form-row">
              <label>纸张宽度：</label>
              <div className="checkout-form-control">
                <div className="checkout-form-radios">
                  {(['58', '80'] as PaperWidth[]).map((w) => (
                    <label className="radio-item" key={w}>
                      <input
                        type="radio"
                        name="paper-width"
                        checked={config.paperWidth === w}
                        onChange={() => patch({ paperWidth: w })}
                      />
                      <span className="radio-dot" />
                      {w}mm
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 字体大小 */}
            <div className="checkout-form-row">
              <label>字体大小：</label>
              <div className="checkout-form-control">
                <div className="checkout-form-radios">
                  {([
                    ['small', '小'],
                    ['medium', '中'],
                    ['large', '大'],
                  ] as [FontSize, string][]).map(([v, l]) => (
                    <label className="radio-item" key={v}>
                      <input
                        type="radio"
                        name="font-size"
                        checked={config.fontSize === v}
                        onChange={() => patch({ fontSize: v })}
                      />
                      <span className="radio-dot" />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 页眉文字 */}
            <div className="checkout-form-row">
              <label>页眉文字：</label>
              <div className="checkout-form-control">
                <input
                  type="text"
                  placeholder="如：门店名称（留空则不显示）"
                  maxLength={40}
                  value={config.headerText}
                  onChange={(e) => patch({ headerText: e.target.value })}
                />
              </div>
            </div>

            {/* 页脚文字 */}
            <div className="checkout-form-row">
              <label>页脚文字：</label>
              <div className="checkout-form-control">
                <input
                  type="text"
                  placeholder={group === 'cashier' ? '如：欢迎光临' : '如：请尽快制作'}
                  maxLength={40}
                  value={config.footerText}
                  onChange={(e) => patch({ footerText: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="panel-head" style={{ borderTop: '1px solid var(--color-hairline)' }}>
            <span className="panel-title">显示区块</span>
            <button
              type="button"
              className="tm-btn tm-btn-default"
              onClick={() => toggleAll(!allOn)}
              disabled={loading}
            >
              {allOn ? '全部关闭' : '全部开启'}
            </button>
          </div>

          <div className="print-style-switch-grid">
            {applicableSections.map((d) => (
              <div className="print-style-switch-item" key={d.key}>
                <span className="print-style-switch-label">{d.label}</span>
                <label className="checkout-switch">
                  <input
                    type="checkbox"
                    checked={sections[d.key]}
                    onChange={(e) => patchSection(d.key, e.target.checked)}
                    disabled={loading}
                  />
                  <span className="checkout-switch-slider" />
                </label>
              </div>
            ))}
          </div>

          <div className="panel-foot" style={{ padding: 16 }}>
            <button
              type="button"
              className="tm-btn tm-btn-primary"
              onClick={handleSave}
              disabled={loading || saving}
            >
              {saving ? '保存中…' : '保存配置'}
            </button>
          </div>
        </div>

        {/* ===== 右侧：票据预览 ===== */}
        <div className="panel print-style-preview-panel">
          <div className="panel-head">
            <span className="panel-title">{selected} 预览</span>
            <span className="print-style-hint">
              {config.paperWidth}mm · {config.fontSize === 'small' ? '小' : config.fontSize === 'large' ? '大' : '中'}字号
            </span>
          </div>

          <div className="print-style-preview-wrap">
            <div
              className="print-style-receipt"
              style={{ width: previewWidth, fontSize: previewFont }}
            >
              {/* 页眉 */}
              {config.headerText.trim() && (
                <div className="ps-receipt-header">{config.headerText}</div>
              )}

              {/* 门店信息 */}
              {sections.storeName && <div className="ps-receipt-line ps-bold">示例门店</div>}
              {group === 'kitchen' && sections.stallName && (
                <div className="ps-receipt-line ps-bold">荤菜档</div>
              )}
              {sections.storePhone && <div className="ps-receipt-line">电话：138-0000-0000</div>}
              {sections.storeAddress && (
                <div className="ps-receipt-line">地址：示例路 88 号</div>
              )}

              <div className="ps-receipt-divider" />

              {/* 订单信息 */}
              {sections.cashierName && (
                <div className="ps-receipt-line">收银员：张三</div>
              )}
              {sections.orderNumber && (
                <div className="ps-receipt-line">单号：20260827001</div>
              )}
              {sections.tableNumber && <div className="ps-receipt-line">桌号：A01</div>}
              {sections.orderTime && (
                <div className="ps-receipt-line">时间：2026-08-27 12:30</div>
              )}

              {sections.itemsDetail && (
                <>
                  <div className="ps-receipt-divider" />
                  {sampleItems.map((it, i) => (
                    <div className="ps-receipt-item" key={i}>
                      <span className="ps-receipt-item-name">
                        {it.name}
                        {sections.qty && group === 'kitchen' && ` ×${it.qty}`}
                        {sections.dishMethods && group === 'kitchen' && it.method && (
                          <span className="ps-receipt-method">（{it.method}）</span>
                        )}
                      </span>
                      {group === 'cashier' && (
                        <span className="ps-receipt-item-price">¥{(it.qty * it.price).toFixed(2)}</span>
                      )}
                    </div>
                  ))}
                </>
              )}

              <div className="ps-receipt-divider" />

              {group === 'cashier' && (
                <>
                  {sections.subtotal && (
                    <div className="ps-receipt-line ps-between">
                      <span>小计</span>
                      <span>¥{sampleSubtotal.toFixed(2)}</span>
                    </div>
                  )}
                  {sections.discountAmount && (
                    <div className="ps-receipt-line ps-between">
                      <span>优惠</span>
                      <span>-¥{sampleDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {sections.totalAmount && (
                    <div className="ps-receipt-line ps-between ps-bold">
                      <span>应付</span>
                      <span>¥{sampleTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {sections.paymentMethod && (
                    <div className="ps-receipt-line">支付方式：微信支付</div>
                  )}
                  {sections.changeAmount && (
                    <div className="ps-receipt-line">找零：¥0.00</div>
                  )}
                </>
              )}

              {sections.qrcode && group === 'cashier' && (
                <>
                  <div className="ps-receipt-divider" />
                  <div className="ps-receipt-qrcode" aria-hidden="true" />
                  <div className="ps-receipt-line ps-center">扫码查看订单</div>
                </>
              )}

              <div className="ps-receipt-divider" />

              {/* 页脚 */}
              {config.footerText.trim() && (
                <div className="ps-receipt-footer">{config.footerText}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
