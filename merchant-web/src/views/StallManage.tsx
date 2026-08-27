import { useEffect, useState } from 'react';
import Toast, { type ToastData } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import SelectDishesModal from '../components/SelectDishesModal';
import { getBucket, putBucket } from '../api/buckets';
import { listDishesApi, type DishItem } from '../api/dishes';

/** 档口配置桶 key */
const BUCKET_KEY = 'stall';

/** 收银档口 / 后厨档口 */
type StallKind = 'cashier' | 'kitchen';

/** 打印票据配置：类型 + 打印份数 */
interface ReceiptConfig {
  type: string;
  copies: number;
}

/** 后厨档口：打印菜品选择（按渠道） */
interface DishSelector {
  /** 店内菜品 */
  inStore: string[];
}

interface Stall {
  id: string;
  kind: StallKind;
  /** 档口名称 */
  name: string;
  /** 打印区域（多选） */
  areaIds: string[];
  /** 订单来源（多选，收银档口） */
  orderSources: string[];
  /** 订单类型（多选，必填） */
  orderTypes: string[];
  /** 生效时间段 */
  timeStart: string;
  timeEnd: string;
  /** 菜品展示顺序 */
  sortOrder: 'category' | 'asc' | 'desc';
  /** 合并相同菜 */
  itemMerge: 'merge' | 'cart' | 'split';
  /** 已关联设备数 */
  deviceCount: number;
  /** 票据类型（分组 + 份数） */
  receipts: ReceiptConfig[];
  /** 后厨档口：设为默认兜底档口 */
  defaultFallback?: boolean;
  /** 后厨档口：选择做法（多选） */
  methods?: string[];
  /** 后厨档口：套餐打印方式 */
  comboPrinting?: 'head' | 'detail';
  /** 后厨档口：打印任务收银机来源（多选） */
  cashierSources?: string[];
  /** 后厨档口：生效时间段模式 */
  timeSlotMode?: 'all' | 'partial';
  /** 后厨档口：打印菜品选择 */
  dishSelectors?: DishSelector;
  /** 后厨档口：打印方式（多选） */
  printMethods?: string[];
}

/** 打印区域 */
const AREA_OPTIONS = ['全部', '前厅', '后厨', '吧台'];
/** 订单来源 */
const ORDER_SOURCE_OPTIONS = ['收银台', '扫码点餐'];
/** 订单类型 */
const ORDER_TYPE_OPTIONS = ['堂食'];
/** 后厨档口：选择做法 */
const METHOD_OPTIONS = ['全部', '不辣', '微辣', '中辣', '特辣', '少油', '少盐'];
/** 后厨档口：打印任务收银机来源 */
const CASHIER_SOURCE_OPTIONS = ['全部', '收银台', '扫码点餐'];
/** 后厨档口：打印方式 */
const KITCHEN_PRINT_OPTIONS = ['整单打印', '分单打印'];

interface TicketGroup {
  key: string;
  title: string;
  types: string[];
}

const SECTIONS: {
  kind: StallKind;
  title: string;
  tickets: TicketGroup;
}[] = [
  {
    kind: 'cashier',
    title: '收银档口',
    tickets: {
      key: 'cashier-receipt',
      title: '收银小票',
      types: ['客单', '预结单', '结账单', '交班单', '退单'],
    },
  },
  {
    kind: 'kitchen',
    title: '后厨档口',
    tickets: {
      key: 'kitchen-receipt',
      title: '后厨小票',
      types: [
        '制作单', '退菜单', '催菜单', '起菜单', '转菜单', '转台单', '传菜单',
        '整桌通知单', '菜品备注单',
      ],
    },
  },
];

const EMPTY_RECEIPTS = (group: TicketGroup): ReceiptConfig[] =>
  group.types.map((t) => ({ type: t, copies: 0 }));

/** 后厨档口默认票据：13 种后厨小票，默认各打印 1 份 */
const KITCHEN_RECEIPTS = (): ReceiptConfig[] => {
  const section = SECTIONS.find((s) => s.kind === 'kitchen')!;
  return section.tickets.types.map((t) => ({ type: t, copies: 1 }));
};

const DEFAULT_STALLS: Stall[] = [
  // 收银档口
  {
    id: 'c1',
    kind: 'cashier',
    name: '收银台',
    areaIds: ['全部'],
    orderSources: ['收银台', '扫码点餐'],
    orderTypes: ['堂食'],
    timeStart: '00:00',
    timeEnd: '23:59',
    sortOrder: 'category',
    itemMerge: 'merge',
    deviceCount: 1,
    receipts: [
      { type: '客单', copies: 0 },
      { type: '预结单', copies: 1 },
      { type: '结账单', copies: 1 },
      { type: '交班单', copies: 0 },
      { type: '退单', copies: 0 },
    ],
  },
  // 后厨档口
  {
    id: 'k1',
    kind: 'kitchen',
    name: '荤菜档',
    areaIds: ['后厨'],
    orderSources: ['收银台', '扫码点餐'],
    orderTypes: ['堂食'],
    timeStart: '00:00',
    timeEnd: '23:59',
    sortOrder: 'category',
    itemMerge: 'merge',
    deviceCount: 1,
    receipts: KITCHEN_RECEIPTS(),
    defaultFallback: true,
    methods: ['全部'],
    comboPrinting: 'detail',
    cashierSources: ['全部'],
    timeSlotMode: 'all',
    dishSelectors: { inStore: [] },
    printMethods: ['整单打印'],
  },
  {
    id: 'k2',
    kind: 'kitchen',
    name: '素菜档',
    areaIds: ['后厨'],
    orderSources: ['收银台', '扫码点餐'],
    orderTypes: ['堂食'],
    timeStart: '00:00',
    timeEnd: '23:59',
    sortOrder: 'category',
    itemMerge: 'merge',
    deviceCount: 1,
    receipts: KITCHEN_RECEIPTS(),
    defaultFallback: false,
    methods: ['全部'],
    comboPrinting: 'detail',
    cashierSources: ['全部'],
    timeSlotMode: 'all',
    dishSelectors: { inStore: [] },
    printMethods: ['整单打印'],
  },
  {
    id: 'k3',
    kind: 'kitchen',
    name: '小吃档',
    areaIds: ['吧台'],
    orderSources: ['收银台', '扫码点餐'],
    orderTypes: ['堂食'],
    timeStart: '00:00',
    timeEnd: '23:59',
    sortOrder: 'category',
    itemMerge: 'merge',
    deviceCount: 1,
    receipts: KITCHEN_RECEIPTS(),
    defaultFallback: false,
    methods: ['全部'],
    comboPrinting: 'detail',
    cashierSources: ['全部'],
    timeSlotMode: 'all',
    dishSelectors: { inStore: [] },
    printMethods: ['整单打印'],
  },
  {
    id: 'k4',
    kind: 'kitchen',
    name: '酒水档',
    areaIds: ['吧台'],
    orderSources: ['收银台'],
    orderTypes: ['堂食'],
    timeStart: '00:00',
    timeEnd: '23:59',
    sortOrder: 'category',
    itemMerge: 'merge',
    deviceCount: 1,
    receipts: KITCHEN_RECEIPTS(),
    defaultFallback: false,
    methods: ['全部'],
    comboPrinting: 'detail',
    cashierSources: ['全部'],
    timeSlotMode: 'all',
    dishSelectors: { inStore: [] },
    printMethods: ['整单打印'],
  },
  {
    id: 'k5',
    kind: 'kitchen',
    name: '锅底档',
    areaIds: ['后厨'],
    orderSources: ['收银台', '扫码点餐'],
    orderTypes: ['堂食'],
    timeStart: '00:00',
    timeEnd: '23:59',
    sortOrder: 'category',
    itemMerge: 'merge',
    deviceCount: 1,
    receipts: KITCHEN_RECEIPTS(),
    defaultFallback: false,
    methods: ['全部'],
    comboPrinting: 'detail',
    cashierSources: ['全部'],
    timeSlotMode: 'all',
    dishSelectors: { inStore: [] },
    printMethods: ['整单打印'],
  },
];

interface StallForm {
  kind: StallKind;
  name: string;
  areaIds: string[];
  orderSources: string[];
  orderTypes: string[];
  timeStart: string;
  timeEnd: string;
  sortOrder: Stall['sortOrder'];
  itemMerge: Stall['itemMerge'];
  deviceCount: string;
  receipts: ReceiptConfig[];
  /** 后厨：设为默认兜底档口 */
  defaultFallback: boolean;
  /** 后厨：选择做法 */
  methods: string[];
  /** 后厨：套餐打印方式 */
  comboPrinting: 'head' | 'detail';
  /** 后厨：打印任务收银机来源 */
  cashierSources: string[];
  /** 后厨：生效时间段模式 */
  timeSlotMode: 'all' | 'partial';
  /** 后厨：打印菜品选择 */
  dishSelectors: DishSelector;
  /** 后厨：打印方式 */
  printMethods: string[];
}

const EMPTY_FORM = (kind: StallKind): StallForm => {
  const section = SECTIONS.find((s) => s.kind === kind) ?? SECTIONS[0];
  return {
    kind,
    name: '',
    areaIds: ['全部'],
    orderSources: ['收银台'],
    orderTypes: ['堂食'],
    timeStart: '00:00',
    timeEnd: '23:59',
    sortOrder: 'category',
    itemMerge: 'merge',
    deviceCount: '1',
    receipts: EMPTY_RECEIPTS(section.tickets),
    defaultFallback: false,
    methods: ['全部'],
    comboPrinting: 'detail',
    cashierSources: ['全部'],
    timeSlotMode: 'all',
    dishSelectors: { inStore: [] },
    printMethods: ['整单打印'],
  };
};

const toForm = (s: Stall): StallForm => ({
  kind: s.kind,
  name: s.name,
  areaIds: [...s.areaIds],
  orderSources: [...s.orderSources],
  orderTypes: [...s.orderTypes],
  timeStart: s.timeStart,
  timeEnd: s.timeEnd,
  sortOrder: s.sortOrder,
  itemMerge: s.itemMerge,
  deviceCount: String(s.deviceCount),
  receipts: s.receipts.map((r) => ({ ...r })),
  defaultFallback: s.defaultFallback ?? false,
  methods: s.methods ? [...s.methods] : ['全部'],
  comboPrinting: s.comboPrinting ?? 'detail',
  cashierSources: s.cashierSources ? [...s.cashierSources] : ['全部'],
  timeSlotMode: s.timeSlotMode ?? 'all',
  dishSelectors: {
    inStore: [...(s.dishSelectors?.inStore ?? [])],
  },
  printMethods: s.printMethods ? [...s.printMethods] : ['整单打印'],
});

export default function StallManage() {
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);
  /** 正在编辑的档口（null 表示新增模式） */
  const [editing, setEditing] = useState<Stall | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<StallForm>(() => EMPTY_FORM('cashier'));
  const [del, setDel] = useState<Stall | null>(null);
  /** 后厨票据批量设置下拉 */
  const [batchMenu, setBatchMenu] = useState(false);
  /** 店内菜品选择弹窗 */
  const [dishModalOpen, setDishModalOpen] = useState(false);
  /** 菜品 id → 名称映射（用于已选菜品摘要展示） */
  const [dishNameMap, setDishNameMap] = useState<Record<string, string>>({});

  /** 从云端加载档口配置 */
  useEffect(() => {
    let active = true;
    getBucket<Stall[]>(BUCKET_KEY)
      .then((data) => {
        if (!active) return;
        setStalls(Array.isArray(data) && data.length > 0 ? data : DEFAULT_STALLS);
      })
      .catch(() => {
        if (active) setStalls(DEFAULT_STALLS);
      });
    return () => {
      active = false;
    };
  }, []);

  /** 加载菜品名映射（用于已选菜品摘要展示） */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const all: DishItem[] = [];
        let p = 1;
        let total = Infinity;
        while (all.length < total) {
          const res = await listDishesApi({ page: p, page_size: 100 });
          all.push(...res.items);
          total = res.total;
          if (res.items.length === 0) break;
          p++;
        }
        if (active) {
          const map: Record<string, string> = {};
          all.forEach((d) => {
            map[String(d.id)] = d.name;
          });
          setDishNameMap(map);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const persist = async (next: Stall[]) => {
    setStalls(next);
    try {
      await putBucket(BUCKET_KEY, next);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  const sectionOf = (kind: StallKind) =>
    SECTIONS.find((s) => s.kind === kind) ?? SECTIONS[0];

  const openAdd = (kind: StallKind) => {
    setForm(EMPTY_FORM(kind));
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (s: Stall) => {
    setForm(toForm(s));
    setEditing(s);
    setShowForm(true);
  };

  type MultiField = 'areaIds' | 'orderSources' | 'orderTypes' | 'methods' | 'cashierSources' | 'printMethods';
  /** 多选切换 */
  const toggle = (field: MultiField, v: string) => {
    setForm((prev) => {
      const cur = prev[field];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      return { ...prev, [field]: next };
    });
  };

  const setCopies = (type: string, copies: number) => {
    setForm((prev) => ({
      ...prev,
      receipts: prev.receipts.map((r) => (r.type === type ? { ...r, copies: Math.max(0, Math.min(3, copies)) } : r)),
    }));
  };

  /** 后厨：票据批量设置份数 */
  const batchSet = (copies: number) => {
    setForm((prev) => ({
      ...prev,
      receipts: prev.receipts.map((r) => ({ ...r, copies: Math.max(0, Math.min(3, copies)) })),
    }));
    setBatchMenu(false);
  };

  const saveStall = () => {
    const name = form.name.trim();
    if (!name) {
      setToast({ type: 'warning', text: '请输入档口名称' });
      return;
    }
    if (form.orderTypes.length === 0) {
      setToast({ type: 'warning', text: '请至少选择一种订单类型' });
      return;
    }
    if (form.receipts.every((r) => r.copies === 0)) {
      setToast({ type: 'warning', text: '请至少设置一种票据的打印份数' });
      return;
    }
    if (form.kind === 'kitchen' && form.printMethods.length === 0) {
      setToast({ type: 'warning', text: '请至少选择一种打印方式' });
      return;
    }
    const deviceCount = Math.max(0, Math.floor(Number(form.deviceCount) || 0));
    const data = {
      kind: form.kind,
      name,
      areaIds: form.areaIds,
      orderSources: form.orderSources,
      orderTypes: form.orderTypes,
      timeStart: form.timeStart,
      timeEnd: form.timeEnd,
      sortOrder: form.sortOrder,
      itemMerge: form.itemMerge,
      deviceCount,
      receipts: form.receipts.map((r) => ({ ...r })),
      defaultFallback: form.defaultFallback,
      methods: form.methods,
      comboPrinting: form.comboPrinting,
      cashierSources: form.cashierSources,
      timeSlotMode: form.timeSlotMode,
      dishSelectors: {
        inStore: [...form.dishSelectors.inStore],
      },
      printMethods: form.printMethods,
    };
    if (editing) {
      persist(stalls.map((s) => (s.id === editing.id ? { ...s, ...data } : s)));
      setToast({ type: 'success', text: '保存成功' });
    } else {
      persist([...stalls, { id: `s${Date.now()}`, ...data }]);
      setToast({ type: 'success', text: '新增成功' });
    }
    setShowForm(false);
    setEditing(null);
  };

  const renderCard = (s: Stall) => {
    const enabled = s.receipts.filter((r) => r.copies > 0);
    const receiptLabels = enabled.map((r) => (r.copies > 1 ? `${r.type}×${r.copies}` : r.type));
    const receiptPreview =
      receiptLabels.length === 0
        ? '—'
        : receiptLabels.slice(0, 2).join('、') + (receiptLabels.length > 2 ? '…' : '');
    return (
      <div className="stall-card" key={s.id}>
        <div className="stall-card-head">
          <svg className="stall-icon" viewBox="0 0 1024 1024" aria-hidden="true">
            <path
              fill="currentColor"
              d="M904 288H760V96H264v192H120c-26.4 0-48 21.6-48 48v400c0 26.4 21.6 48 48 48h96v144h544v-144h96c26.4 0 48-21.6 48-48V336c0-26.4-21.6-48-48-48zM360 192h304v96H360v-96zm336 640H328v-176h368v176zm144-192h-48v-80H232v80h-48V384h656v256z"
            />
          </svg>
          <span className="stall-name">{s.name}</span>
          {s.kind === 'kitchen' && s.defaultFallback && <span className="stall-tag">默认兜底</span>}
        </div>
        <div className="stall-card-body">
          <div className="stall-info-row">
            <span className="stall-info-label">已关联设备</span>
            <span className="stall-info-value">{s.deviceCount}台</span>
          </div>
          <div className="stall-info-row">
            <span className="stall-info-label">打印区域</span>
            <span className="stall-info-value">{s.areaIds.join('、')}</span>
          </div>
          <div className="stall-info-row">
            <span className="stall-info-label">订单类型</span>
            <span className="stall-info-value">{s.orderTypes.join('、')}</span>
          </div>
          <div className="stall-info-row">
            <span className="stall-info-label">票据类型</span>
            <span className="stall-info-value" title={receiptLabels.join('、')}>
              {receiptPreview}
            </span>
          </div>
        </div>
        <div className="stall-card-foot">
          <button type="button" className="stall-card-action danger" onClick={() => setDel(s)}>
            删除
          </button>
          <span className="stall-card-divider">|</span>
          <button type="button" className="stall-card-action" onClick={() => openEdit(s)}>
            编辑
          </button>
        </div>
      </div>
    );
  };

  const renderCheckGroup = (field: MultiField, options: string[]) => (
    <div className="stall-ticket-list">
      {options.map((o) => (
        <label className="stall-ticket-item" key={o}>
          <input type="checkbox" checked={form[field].includes(o)} onChange={() => toggle(field, o)} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );

  /** 后厨：单选组 */
  const renderRadio = <T extends string>(name: string, value: T, options: { value: T; label: string }[], onChange: (v: T) => void) => (
    <div className="stall-radio-group">
      {options.map((o) => (
        <label className="stall-radio-item" key={o.value}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="page stall-page">
      <div className="page-head">
        <h1 className="page-title">档口管理</h1>
      </div>

      <div className="stall-panel">
        {SECTIONS.map((section) => {
          const list = stalls.filter((s) => s.kind === section.kind);
          return (
            <section className="stall-section" key={section.kind}>
              <h2 className="stall-section-title">{section.title}</h2>
              <div className="stall-list">
                {list.map(renderCard)}
                <button
                  type="button"
                  className="stall-card stall-card-add"
                  onClick={() => openAdd(section.kind)}
                >
                  <span className="stall-add-plus">+</span>
                  <span>新增档口</span>
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {/* 新增 / 编辑档口 */}
      {showForm && (
        <div className="modal-mask" onClick={() => setShowForm(false)}>
          <div
            className={`modal-card stall-modal${form.kind === 'kitchen' ? ' stall-modal-wide' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="modal-title">
                {editing ? `编辑${sectionOf(form.kind).title}` : `新增${sectionOf(form.kind).title}`}
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="关闭"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {form.kind === 'cashier' ? (
                <>
                  {/* 档口基础信息（收银） */}
                  <h4 className="stall-form-section-title">档口基础信息</h4>
                  <div className="stall-form-grid">
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>名称
                      </label>
                      <input
                        type="text"
                        className="ant-input"
                        placeholder="请输入档口名称"
                        maxLength={12}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="checkout-form-row">
                      <label>打印区域</label>
                      {renderCheckGroup('areaIds', AREA_OPTIONS)}
                    </div>
                    <div className="checkout-form-row">
                      <label>订单来源</label>
                      {renderCheckGroup('orderSources', ORDER_SOURCE_OPTIONS)}
                    </div>
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>订单类型
                      </label>
                      {renderCheckGroup('orderTypes', ORDER_TYPE_OPTIONS)}
                    </div>
                    <div className="checkout-form-row">
                      <label>生效时间段</label>
                      <div className="stall-time-range">
                        <input
                          type="time"
                          className="ant-input"
                          value={form.timeStart}
                          onChange={(e) => setForm({ ...form, timeStart: e.target.value })}
                        />
                        <span className="stall-time-sep">至</span>
                        <input
                          type="time"
                          className="ant-input"
                          value={form.timeEnd}
                          onChange={(e) => setForm({ ...form, timeEnd: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="checkout-form-row">
                      <label>已关联设备</label>
                      <input
                        type="number"
                        className="ant-input"
                        min={0}
                        value={form.deviceCount}
                        onChange={(e) => setForm({ ...form, deviceCount: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* 打印效果设置（收银） */}
                  <h4 className="stall-form-section-title">打印效果设置</h4>
                  <div className="stall-form-grid">
                    <div className="checkout-form-row">
                      <label>菜品展示顺序</label>
                      <div className="stall-radio-group">
                        {[
                          { value: 'category', label: '菜品分类' },
                          { value: 'asc', label: '下单时间(正序)' },
                          { value: 'desc', label: '下单时间(倒序)' },
                        ].map((o) => (
                          <label className="stall-radio-item" key={o.value}>
                            <input
                              type="radio"
                              name="sortOrder"
                              checked={form.sortOrder === o.value}
                              onChange={() => setForm({ ...form, sortOrder: o.value as Stall['sortOrder'] })}
                            />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="checkout-form-row">
                      <label>合并相同菜</label>
                      <div className="stall-radio-group">
                        {[
                          { value: 'merge', label: '合并展示' },
                          { value: 'cart', label: '与购物车一致' },
                          { value: 'split', label: '拆分展示' },
                        ].map((o) => (
                          <label className="stall-radio-item" key={o.value}>
                            <input
                              type="radio"
                              name="itemMerge"
                              checked={form.itemMerge === o.value}
                              onChange={() => setForm({ ...form, itemMerge: o.value as Stall['itemMerge'] })}
                            />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* 档口基础信息（后厨） */}
                  <h4 className="stall-form-section-title">档口基础信息</h4>
                  <div className="stall-form-grid">
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>后厨出品档口
                      </label>
                      <input
                        type="text"
                        className="ant-input"
                        placeholder="请输入档口名称"
                        maxLength={12}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="checkout-form-row">
                      <label>设为默认兜底档口</label>
                      <button
                        type="button"
                        className={`quick-switch${form.defaultFallback ? ' on' : ''}`}
                        role="switch"
                        aria-checked={form.defaultFallback}
                        onClick={() => setForm({ ...form, defaultFallback: !form.defaultFallback })}
                      >
                        <span className="quick-switch-thumb" />
                      </button>
                    </div>
                    <div className="checkout-form-row">
                      <label>打印区域</label>
                      {renderCheckGroup('areaIds', AREA_OPTIONS)}
                    </div>
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>订单类型
                      </label>
                      {renderCheckGroup('orderTypes', ORDER_TYPE_OPTIONS)}
                    </div>
                    <div className="checkout-form-row">
                      <label>选择做法</label>
                      {renderCheckGroup('methods', METHOD_OPTIONS)}
                    </div>
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>套餐打印方式
                      </label>
                      {renderRadio('comboPrinting', form.comboPrinting, [
                        { value: 'head', label: '按套餐头打印' },
                        { value: 'detail', label: '按套餐明细打印' },
                      ], (v) => setForm({ ...form, comboPrinting: v }))}
                    </div>
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>打印任务收银机来源
                      </label>
                      {renderCheckGroup('cashierSources', CASHIER_SOURCE_OPTIONS)}
                    </div>
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>选择档口生效时间段
                      </label>
                      {renderRadio('timeSlotMode', form.timeSlotMode, [
                        { value: 'all', label: '全部时间段生效' },
                        { value: 'partial', label: '部分时间段内替换为其他档口' },
                      ], (v) => setForm({ ...form, timeSlotMode: v }))}
                    </div>
                    {form.timeSlotMode === 'partial' && (
                      <div className="checkout-form-row">
                        <label>替换时间段</label>
                        <div className="stall-time-range">
                          <input
                            type="time"
                            className="ant-input"
                            value={form.timeStart}
                            onChange={(e) => setForm({ ...form, timeStart: e.target.value })}
                          />
                          <span className="stall-time-sep">至</span>
                          <input
                            type="time"
                            className="ant-input"
                            value={form.timeEnd}
                            onChange={(e) => setForm({ ...form, timeEnd: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 打印菜品选择（后厨） */}
                  <h4 className="stall-form-section-title">打印菜品选择</h4>
                  <div className="stall-form-grid">
                    <div className="checkout-form-row">
                      <label>店内菜品选择</label>
                      <button
                        type="button"
                        className="dish-selector-trigger"
                        onClick={() => setDishModalOpen(true)}
                      >
                        {(() => {
                          const ids = form.dishSelectors.inStore;
                          if (ids.length === 0) return '请选择店内菜品关联';
                          const shown = ids.slice(0, 3).map((id) => dishNameMap[id] || id);
                          const more = ids.length > 3 ? ` +${ids.length - 3}` : '';
                          return shown.join('、') + more;
                        })()}
                      </button>
                    </div>
                  </div>

                  <SelectDishesModal
                    open={dishModalOpen}
                    initialSelected={form.dishSelectors.inStore}
                    onClose={() => setDishModalOpen(false)}
                    onConfirm={(items) => {
                      const map: Record<string, string> = {};
                      items.forEach((it) => {
                        map[it.id] = it.name;
                      });
                      setDishNameMap((prev) => ({ ...prev, ...map }));
                      setForm((prev) => ({
                        ...prev,
                        dishSelectors: { ...prev.dishSelectors, inStore: items.map((it) => it.id) },
                      }));
                      setDishModalOpen(false);
                    }}
                  />

                  {/* 打印效果设置（后厨） */}
                  <h4 className="stall-form-section-title">打印效果设置</h4>
                  <div className="stall-form-grid">
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>合并相同菜
                      </label>
                      {renderRadio('kitchenItemMerge', form.itemMerge, [
                        { value: 'merge', label: '相同菜品合并展示' },
                        { value: 'split', label: '相同菜品拆分展示' },
                      ], (v) => setForm({ ...form, itemMerge: v }))}
                    </div>
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>菜品展示顺序
                      </label>
                      {renderRadio('kitchenSortOrder', form.sortOrder, [
                        { value: 'category', label: '菜品分类' },
                        { value: 'asc', label: '下单时间(正序)' },
                        { value: 'desc', label: '下单时间(倒序)' },
                      ], (v) => setForm({ ...form, sortOrder: v }))}
                    </div>
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>打印方式
                      </label>
                      {renderCheckGroup('printMethods', KITCHEN_PRINT_OPTIONS)}
                    </div>
                  </div>
                </>
              )}

              {/* 打印票据类型 */}
              <h4 className="stall-form-section-title">打印票据类型</h4>
              <div className="stall-receipt-group">
                <div className="stall-receipt-group-head">
                  <div className="stall-receipt-group-title">{sectionOf(form.kind).tickets.title}</div>
                  {form.kind === 'kitchen' && (
                    <div className="stall-batch">
                      <button
                        type="button"
                        className="stall-batch-btn"
                        onClick={() => setBatchMenu((v) => !v)}
                      >
                        批量设置<span className="stall-batch-arrow">›</span>
                      </button>
                      {batchMenu && (
                        <div className="stall-batch-menu">
                          <button type="button" onClick={() => batchSet(1)}>
                            全部打印1份
                          </button>
                          <button type="button" onClick={() => batchSet(2)}>
                            全部打印2份
                          </button>
                          <button type="button" onClick={() => batchSet(3)}>
                            全部打印3份
                          </button>
                          <button type="button" onClick={() => batchSet(0)}>
                            全部不打印
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="stall-receipt-grid">
                  {form.receipts.map((r) => (
                    <div className="stall-receipt-item" key={r.type}>
                      <span className="stall-receipt-name">{r.type}</span>
                      <div className="stall-copies">
                        <button
                          type="button"
                          className="stall-copies-btn"
                          onClick={() => setCopies(r.type, r.copies - 1)}
                          disabled={r.copies === 0}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className="stall-copies-input"
                          min={0}
                          max={3}
                          value={r.copies}
                          onChange={(e) => setCopies(r.type, Math.floor(Number(e.target.value) || 0))}
                        />
                        <button
                          type="button"
                          className="stall-copies-btn"
                          onClick={() => setCopies(r.type, r.copies + 1)}
                          disabled={r.copies >= 3}
                        >
                          +
                        </button>
                      </div>
                      <span className="stall-copies-unit">份</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="tm-btn tm-btn-default"
                onClick={() => setShowForm(false)}
              >
                取消
              </button>
              <button type="button" className="tm-btn tm-btn-primary" onClick={saveStall}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {del && (
        <ConfirmModal
          open
          title="删除档口"
          message={`确定要删除档口「${del.name}」吗？删除后不可恢复。`}
          confirmText="删除"
          cancelText="取消"
          danger
          onCancel={() => setDel(null)}
          onConfirm={() => {
            persist(stalls.filter((x) => x.id !== del.id));
            setDel(null);
            setToast({ type: 'success', text: '删除成功' });
          }}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
