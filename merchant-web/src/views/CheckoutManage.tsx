import { useEffect, useMemo, useState } from 'react';
import CommonSelect from '../components/CommonSelect';
import ConfirmModal from '../components/ConfirmModal';
import SearchForm from '../components/SearchForm';
import Toast, { type ToastData } from '../components/Toast';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/Pagination';
import { getBucket, putBucket } from '../api/buckets';

/** 结账方式配置桶 key（methods + cats + quick 整包） */
const PAYMENTS_BUCKET = 'payments';
/** 当前 Tab 为本地 UI 偏好 */
const TAB_KEY = 'merchant_checkout_tab';

/** 结账方式：本系统仅支持 现金 / 自定义 / 优惠券 / 抵用券 */
interface CheckoutMethod {
  id: string;
  name: string;
  type: '现金' | '自定义' | '优惠' | '抵用券';
  source: '系统默认' | '自定义';
  incomeRule: '计入收入' | '计入优惠';
  /** 手续费率（%） */
  feeRate: number;
  /** 收入部分是否可以开发票 */
  invoice: '可以' | '不可以';
  /** 收银端显示 */
  cashierShow: boolean;
  /** 点餐助手和平板点餐端显示 */
  assistantShow: boolean;
  /** 会员消费赠积分 */
  points: boolean;
  /** 图标样式索引（ICON_STYLES） */
  icon: number;
  /** 优惠方案（仅 type='优惠'） */
  discountType: '折扣' | '满减' | '每满减';
  /** 折扣率%（优惠方案=折扣） */
  discountRate: number;
  /** 满额（优惠方案=满减/每满减） */
  fullAmount: number;
  /** 减额（优惠方案=满减/每满减） */
  reduceAmount: number;
  status: '启用' | '停用';
  createdAt: string;
  updatedAt: string;
}

/** 图标样式预设 */
const ICON_STYLES = [
  { name: '青绿', bg: 'linear-gradient(135deg,#2bd9bf,#12b39a)', border: 'rgba(8,166,140,0.6)' },
  { name: '橙红', bg: 'linear-gradient(135deg,#ff9641,#ff5d0d)', border: 'rgba(242,105,36,0.6)' },
  { name: '海蓝', bg: 'linear-gradient(135deg,#4d8dff,#2f5bff)', border: 'rgba(47,91,255,0.6)' },
  { name: '绛紫', bg: 'linear-gradient(135deg,#9a7bff,#6b4dff)', border: 'rgba(107,77,255,0.6)' },
];

/** 图标字符 */
const ICON_CHAR: Record<CheckoutMethod['type'], string> = {
  现金: '现',
  自定义: '自',
  优惠: '优',
  抵用券: '抵',
};

interface CheckoutCategory {
  id: string;
  name: string;
  desc: string;
  /** 系统默认分类绑定的结账方式类型；用户自定义分类无此字段，数量固定为 0 */
  typeKey?: CheckoutMethod['type'];
  count: number;
}

const now = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const DEFAULT_METHODS: CheckoutMethod[] = [
  {
    id: 'cash',
    name: '现金',
    type: '现金',
    source: '系统默认',
    incomeRule: '计入收入',
    feeRate: 0,
    invoice: '不可以',
    cashierShow: true,
    assistantShow: false,
    points: true,
    icon: 0,
    discountType: '折扣',
    discountRate: 90,
    fullAmount: 0,
    reduceAmount: 0,
    status: '启用',
    createdAt: '2025-01-01 00:00:00',
    updatedAt: '2025-01-01 00:00:00',
  },
  {
    id: 'custom',
    name: '自定义',
    type: '自定义',
    source: '自定义',
    incomeRule: '计入收入',
    feeRate: 0,
    invoice: '不可以',
    cashierShow: true,
    assistantShow: false,
    points: true,
    icon: 0,
    discountType: '折扣',
    discountRate: 90,
    fullAmount: 0,
    reduceAmount: 0,
    status: '启用',
    createdAt: '2025-01-01 00:00:00',
    updatedAt: '2025-01-01 00:00:00',
  },
  {
    id: 'coupon',
    name: '优惠券',
    type: '优惠',
    source: '系统默认',
    incomeRule: '计入优惠',
    feeRate: 0,
    invoice: '不可以',
    cashierShow: true,
    assistantShow: false,
    points: true,
    icon: 1,
    discountType: '折扣',
    discountRate: 90,
    fullAmount: 0,
    reduceAmount: 0,
    status: '启用',
    createdAt: '2025-01-01 00:00:00',
    updatedAt: '2025-01-01 00:00:00',
  },
  {
    id: 'voucher',
    name: '抵用券',
    type: '抵用券',
    source: '系统默认',
    incomeRule: '计入优惠',
    feeRate: 0,
    invoice: '不可以',
    cashierShow: true,
    assistantShow: false,
    points: false,
    icon: 1,
    discountType: '折扣',
    discountRate: 90,
    fullAmount: 0,
    reduceAmount: 0,
    status: '启用',
    createdAt: '2025-01-01 00:00:00',
    updatedAt: '2025-01-01 00:00:00',
  },
];

/** 兼容旧数据：补默认字段、迁移旧的「按实际设置」 */
const normalizeMethod = (m: CheckoutMethod): CheckoutMethod => ({
  ...m,
  incomeRule: (m.incomeRule as string) === '按实际设置' ? '计入优惠' : m.incomeRule,
  feeRate: typeof m.feeRate === 'number' ? m.feeRate : 0,
  invoice: m.invoice ?? '不可以',
  cashierShow: m.cashierShow ?? true,
  assistantShow: m.assistantShow ?? false,
  points: m.points ?? true,
  icon: typeof m.icon === 'number' ? m.icon : 0,
  discountType: m.discountType ?? '折扣',
  discountRate: typeof m.discountRate === 'number' ? m.discountRate : 90,
  fullAmount: typeof m.fullAmount === 'number' ? m.fullAmount : 0,
  reduceAmount: typeof m.reduceAmount === 'number' ? m.reduceAmount : 0,
});

const DEFAULT_CATS: CheckoutCategory[] = [
  { id: 'cat-cash', name: '现金类', desc: '现金结算方式', typeKey: '现金', count: 1 },
  { id: 'cat-coupon', name: '优惠类', desc: '优惠券结算方式', typeKey: '优惠', count: 1 },
  { id: 'cat-voucher', name: '抵用券类', desc: '抵用券结算方式', typeKey: '抵用券', count: 1 },
  { id: 'cat-custom', name: '自定义类', desc: '商家自定义结账方式', typeKey: '自定义', count: 1 },
];

/** 结账方式配置桶数据结构 */
interface PaymentsBucketData {
  methods: CheckoutMethod[];
  cats: CheckoutCategory[];
  quick: Record<string, boolean>;
}

const TABS = ['结账方式', '结账方式分类', '快捷结账方式'] as const;
type TabKey = (typeof TABS)[number];

export default function CheckoutManage() {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    try {
      return (localStorage.getItem(TAB_KEY) as TabKey) || '结账方式';
    } catch {
      return '结账方式';
    }
  });
  const [methods, setMethods] = useState<CheckoutMethod[]>(DEFAULT_METHODS);
  const [cats, setCats] = useState<CheckoutCategory[]>(DEFAULT_CATS);
  const [quick, setQuick] = useState<Record<string, boolean>>({});
  const [, setLoading] = useState(true);

  /** 搜索 */
  const [keyword, setKeyword] = useState('');

  /** 弹窗 */
  const [modal, setModal] = useState<
    | { type: 'pick' }
    | { type: 'add' | 'edit'; method?: CheckoutMethod }
    | { type: 'view'; method: CheckoutMethod }
    | { type: 'sort' }
    | { type: 'addCat' }
    | { type: 'editCat'; cat: CheckoutCategory }
    | null
  >(null);
  /** 新增时选定的结账类型（由「选择结账方式」确定） */
  const [mType, setMType] = useState<'自定义' | '优惠'>('自定义');
  const [confirm, setConfirm] = useState<{ method: CheckoutMethod; to: '启用' | '停用' } | null>(
    null,
  );
  const [catDelete, setCatDelete] = useState<CheckoutCategory | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  /** 分页 */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  /** 从云端加载结账方式 / 分类 / 快捷配置 */
  useEffect(() => {
    let active = true;
    getBucket<PaymentsBucketData>(PAYMENTS_BUCKET)
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.methods) && data.methods.length) {
          // 版本升级：补齐新增的系统默认结账方式（如抵用券），已存在的按原顺序保留
          const ids = new Set(data.methods.map((m) => m.id));
          setMethods(
            data.methods.map(normalizeMethod).concat(DEFAULT_METHODS.filter((d) => !ids.has(d.id))),
          );
        }
        if (Array.isArray(data.cats)) {
          // 版本升级：给系统默认分类补 typeKey、补齐缺失的默认分类
          const ids = new Set(data.cats.map((c) => c.id));
          setCats(
            data.cats
              .map((c) => {
                const def = DEFAULT_CATS.find((d) => d.id === c.id);
                return def ? { ...def, name: c.name || def.name, desc: c.desc || def.desc } : c;
              })
              .concat(DEFAULT_CATS.filter((d) => !ids.has(d.id))),
          );
        }
        if (data.quick && typeof data.quick === 'object') setQuick(data.quick);
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

  const switchTab = (t: TabKey) => {
    setActiveTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
    setPage(1);
  };

  /** 持久化结账方式（整包保存到云端） */
  const persistMethods = async (next: CheckoutMethod[]) => {
    setMethods(next);
    try {
      await putBucket(PAYMENTS_BUCKET, { methods: next, cats, quick });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  const filtered = useMemo(
    () =>
      keyword.trim()
        ? methods.filter((m) => m.name.includes(keyword.trim()))
        : methods,
    [methods, keyword],
  );

  /** 分页切片 */
  const pagedMethods = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  /** 页码越界保护 */
  useEffect(() => {
    const total = activeTab === '结账方式分类' ? cats.length : methods.length;
    const max = Math.max(1, Math.ceil(total / pageSize));
    if (page > max) setPage(max);
  }, [page, pageSize, activeTab, cats.length, methods.length]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const handleToggleStatus = async (method: CheckoutMethod, to: '启用' | '停用') => {
    await persistMethods(
      methods.map((m) =>
        m.id === method.id ? { ...m, status: to, updatedAt: now() } : m,
      ),
    );
    setConfirm(null);
    setToast({ type: 'success', text: `「${method.name}」已${to}` });
  };

  /** 保存分类（新增 / 编辑） */
  const saveCat = async (name: string, desc: string) => {
    const next =
      modal?.type === 'editCat'
        ? cats.map((c) => (c.id === modal.cat.id ? { ...c, name, desc } : c))
        : [...cats, { id: `cat-${Date.now()}`, name, desc, count: 0 }];
    setCats(next);
    try {
      await putBucket(PAYMENTS_BUCKET, { methods, cats: next, quick });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
    setModal(null);
    setToast({ type: 'success', text: '保存成功' });
  };

  /** ================= 结账方式表格列 ================= */
  const COLS = useMemo(
    () => [
      { key: 'no', title: '序号', width: 60, center: true },
      { key: 'name', title: '结账方式名称', width: 160 },
      { key: 'type', title: '类型', width: 100 },
      { key: 'source', title: '来源', width: 110 },
      { key: 'incomeRule', title: '计收入规则', width: 120 },
      { key: 'status', title: '状态', width: 90, center: true },
      { key: 'createdAt', title: '创建时间', width: 160, center: true },
      { key: 'updatedAt', title: '修改时间', width: 160, center: true },
      { key: 'ops', title: '操作', width: 150, sticky: true },
    ],
    [],
  );

  const renderStatus = (s: CheckoutMethod['status']) => (
    <span className={`checkout-status ${s === '启用' ? 'on' : 'off'}`}>
      <i className="checkout-status-dot" />
      {s}
    </span>
  );

  const renderMethodsTab = () => (
    <div className="checkout-panel">
      <div className="checkout-toolbar">
        <div className="checkout-actions">
          <button className="tm-btn tm-btn-primary" type="button" onClick={() => setModal({ type: 'pick' })}>
            新增结账方式
          </button>
          <button className="tm-btn tm-btn-default" type="button" onClick={() => setModal({ type: 'sort' })}>
            结账方式排序
          </button>
        </div>
        <SearchForm
          className="checkout-search"
          fields={[
            { key: 'name', label: '结账方式名称', placeholder: '请输入结账方式名称', width: 180 },
          ]}
          values={{ name: keyword }}
          onChange={(_, v) => setKeyword(v)}
          onSearch={() => {}}
          onReset={() => setKeyword('')}
        />
      </div>

      <div className="data-table checkout-table">
        <div className="area-table-scroll checkout-scroll">
          <table className="checkout-real-table">
            <colgroup>
              {COLS.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} className={`${c.center ? 'th-center' : ''} ${c.sticky ? 'th-sticky' : ''}`}>
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td className="checkout-empty-cell" colSpan={9}>没有找到相关结账方式</td>
                </tr>
              )}
              {pagedMethods.map((m, i) => (
                <tr key={m.id}>
                  <td className="td-center">{(page - 1) * pageSize + i + 1}</td>
                  <td>{m.name}</td>
                  <td>{m.type}</td>
                  <td>{m.source}</td>
                  <td>{m.incomeRule}</td>
                  <td className="td-center">{renderStatus(m.status)}</td>
                  <td className="td-center">{m.createdAt}</td>
                  <td className="td-center">{m.updatedAt}</td>
                  <td className="td-sticky">
                    <div className="row-actions">
                      <button className="action-link" onClick={() => setModal({ type: 'view', method: m })}>查看</button>
                      <button className="action-link" onClick={() => setModal({ type: 'edit', method: m })}>编辑</button>
                      <button
                        className={`action-link ${m.status === '启用' ? 'danger' : ''}`}
                        onClick={() => setConfirm({ method: m, to: m.status === '启用' ? '停用' : '启用' })}
                      >
                        {m.status === '启用' ? '停用' : '启用'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </div>
  );

  /** ================= 结账方式分类 ================= */
  const renderCatsTab = () => {
    // 系统默认分类的数量按「结账方式管理」中的类型字段动态统计
    const displayCats = cats.map((c) => ({
      ...c,
      count: c.typeKey ? methods.filter((m) => m.type === c.typeKey).length : c.count,
    }));
    const start = (page - 1) * pageSize;
    const pagedCats = displayCats.slice(start, start + pageSize);
    return (
      <div className="checkout-panel">
        <div className="checkout-tip">
          <span className="checkout-tip-icon" aria-hidden>i</span>
          结账方式数按「结账方式管理」中的类型自动统计：现金、优惠、抵用券、自定义。
        </div>
        <div className="checkout-toolbar">
          <div className="checkout-actions">
            <button className="tm-btn tm-btn-primary" type="button" onClick={() => setModal({ type: 'addCat' })}>
              + 新增分类
            </button>
          </div>
        </div>
        <div className="data-table checkout-table">
          <div className="area-table-scroll checkout-scroll">
            <table className="checkout-real-table">
              <colgroup>
                <col style={{ width: 80 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 260 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 160 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="th-center">序号</th>
                  <th>分类名称</th>
                  <th>描述</th>
                  <th className="th-center">结账方式数</th>
                  <th className="th-sticky">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedCats.map((c, i) => (
                  <tr key={c.id}>
                    <td className="td-center">{start + i + 1}</td>
                    <td>{c.name}</td>
                    <td>{c.desc}</td>
                    <td className="td-center">{c.count}</td>
                    <td className="td-sticky">
                      <div className="row-actions">
                        <button className="action-link" onClick={() => setModal({ type: 'editCat', cat: c })}>编辑</button>
                        <button className="action-link danger" onClick={() => setCatDelete(c)}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination
          total={displayCats.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
    );
  };

  /** ================= 快捷结账方式 ================= */
  const renderQuickTab = () => {
    const quickItems = methods.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      shown: quick[m.id] ?? true,
    }));
    const toggle = async (id: string, shown: boolean) => {
      const next = { ...quick, [id]: shown };
      setQuick(next);
      try {
        await putBucket(PAYMENTS_BUCKET, { methods, cats, quick: next });
      } catch (e) {
        setToast({ type: 'error', text: (e as Error).message || '保存失败' });
      }
      setToast({ type: 'success', text: `已${shown ? '开启' : '关闭'}「${methods.find((m) => m.id === id)?.name}」快捷结账` });
    };
    const start = (page - 1) * pageSize;
    const pagedQuick = quickItems.slice(start, start + pageSize);
    return (
      <div className="checkout-panel">
        <div className="checkout-tip">
          <span className="checkout-tip-icon" aria-hidden>i</span>
          开启后，结账弹窗中会显示对应的快捷结账方式，点击即可快速完成结账。
        </div>
        <div className="data-table checkout-table">
          <div className="area-table-scroll checkout-scroll">
            <table className="checkout-real-table">
              <colgroup>
                <col style={{ width: 80 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 160 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="th-center">序号</th>
                  <th>结账方式名称</th>
                  <th>类型</th>
                  <th>收银端显示</th>
                </tr>
              </thead>
              <tbody>
                {pagedQuick.map((q, i) => (
                  <tr key={q.id}>
                    <td className="td-center">{start + i + 1}</td>
                    <td>{q.name}</td>
                    <td>{q.type}</td>
                    <td>
                      <button
                        type="button"
                        className={`quick-switch ${q.shown ? 'on' : ''}`}
                        role="switch"
                        aria-checked={q.shown}
                        onClick={() => toggle(q.id, !q.shown)}
                      >
                        <span className="quick-switch-thumb" />
                      </button>
                      <span className="quick-switch-text">{q.shown ? '显示' : '隐藏'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination
          total={quickItems.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
    );
  };

  /** ================= 新增 / 编辑结账方式 ================= */
  const methodModal =
    modal && (modal.type === 'add' || modal.type === 'edit') ? modal : null;
  const [mName, setMName] = useState('');
  const [mIncome, setMIncome] = useState<'计入收入' | '计入优惠'>('计入收入');
  const [mFee, setMFee] = useState('0');
  const [mInvoice, setMInvoice] = useState<'可以' | '不可以'>('不可以');
  const [mCashier, setMCashier] = useState(true);
  const [mAssistant, setMAssistant] = useState(false);
  const [mIcon, setMIcon] = useState(0);
  const [mStatus, setMStatus] = useState<'启用' | '停用'>('启用');
  const [mDiscountType, setMDiscountType] = useState<'折扣' | '满减' | '每满减'>('折扣');
  const [mDiscountRate, setMDiscountRate] = useState('90');
  const [mFullAmount, setMFullAmount] = useState('');
  const [mReduceAmount, setMReduceAmount] = useState('');
  const [iconOpen, setIconOpen] = useState(false);
  const [mError, setMError] = useState(false);
  const [fieldError, setFieldError] = useState<{
    discountRate?: string;
    full?: string;
    reduce?: string;
  }>({});
  useEffect(() => {
    if (!methodModal) return;
    const m = methodModal.method;
    const isCoupon = m ? m.type === '优惠' : mType === '优惠';
    setMName(m?.name ?? '');
    setMIncome(m?.incomeRule ?? '计入收入');
    setMFee(String(m?.feeRate ?? 0));
    setMInvoice(m?.invoice ?? (isCoupon ? '可以' : '不可以'));
    setMCashier(m?.cashierShow ?? true);
    setMAssistant(m?.assistantShow ?? isCoupon);
    setMIcon(m?.icon ?? 0);
    setMStatus(m?.status ?? '启用');
    setMDiscountType(m?.discountType ?? '折扣');
    setMDiscountRate(String(m?.discountRate ?? 90));
    setMFullAmount(m?.fullAmount ? String(m.fullAmount) : '');
    setMReduceAmount(m?.reduceAmount ? String(m.reduceAmount) : '');
    setIconOpen(false);
    setMError(false);
    setFieldError({});
  }, [methodModal]);
  const submitMethod = async () => {
    if (!methodModal) return;
    if (!mName.trim()) {
      setMError(true);
      return;
    }
    const fee = Number(mFee);
    const curType: CheckoutMethod['type'] =
      methodModal.type === 'add' ? mType : (methodModal.method?.type ?? '自定义');
    const discountRate = Number(mDiscountRate);
    const fullAmount = Number(mFullAmount);
    const reduceAmount = Number(mReduceAmount);
    // 必填项校验：优惠类型下的折扣率 / 满减金额
    const errors: { discountRate?: string; full?: string; reduce?: string } = {};
    if (curType === '优惠') {
      if (mDiscountType === '折扣') {
        if (!(discountRate > 0 && discountRate <= 100)) {
          errors.discountRate = '请输入 1-100 之间的折扣率';
        }
      } else {
        if (!(fullAmount > 0)) {
          errors.full = mDiscountType === '满减' ? '请输入满额金额' : '请输入每满金额';
        }
        if (!(reduceAmount > 0)) {
          errors.reduce = '请输入减额金额';
        }
        if (!errors.full && !errors.reduce && reduceAmount >= fullAmount) {
          errors.reduce = '减额金额需小于满额金额';
        }
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldError(errors);
      return;
    }
    const base = {
      incomeRule: mIncome,
      feeRate: Number.isFinite(fee) && fee >= 0 ? fee : 0,
      invoice: mInvoice,
      cashierShow: mCashier,
      assistantShow: mAssistant,
      icon: mIcon,
      status: mStatus,
      discountType: curType === '优惠' ? mDiscountType : ('折扣' as const),
      discountRate: curType === '优惠' && Number.isFinite(discountRate) && discountRate > 0 ? discountRate : 0,
      fullAmount: curType === '优惠' && Number.isFinite(fullAmount) && fullAmount >= 0 ? fullAmount : 0,
      reduceAmount: curType === '优惠' && Number.isFinite(reduceAmount) && reduceAmount >= 0 ? reduceAmount : 0,
      updatedAt: now(),
    };
    if (methodModal.type === 'add') {
      const next: CheckoutMethod[] = [
        ...methods,
        {
          id: `c-${Date.now()}`,
          name: mName.trim(),
          type: mType,
          source: '自定义',
          points: true,
          createdAt: now(),
          ...base,
        },
      ];
      await persistMethods(next);
      setToast({ type: 'success', text: '新增结账方式成功' });
    } else {
      await persistMethods(
        methods.map((m) =>
          m.id === methodModal.method!.id
            ? { ...m, name: mName.trim(), ...base }
            : m,
        ),
      );
      setToast({ type: 'success', text: '保存成功' });
    }
    setModal(null);
  };

  /** 排序弹窗 */
  const sortModal = modal?.type === 'sort' ? modal : null;
  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= methods.length) return;
    const next = [...methods];
    [next[idx], next[target]] = [next[target], next[idx]];
    await persistMethods(next);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">结账方式管理</h1>
      </div>

      <div className="table-manage-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`pill-tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => switchTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === '结账方式' && renderMethodsTab()}
      {activeTab === '结账方式分类' && renderCatsTab()}
      {activeTab === '快捷结账方式' && renderQuickTab()}

      {/* ===== 选择结账方式类型 ===== */}
      {modal?.type === 'pick' && (
        <div className="modal-mask" onClick={() => setModal(null)}>
          <div className="modal-card checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">选择结账方式</div>
              <button className="modal-close" aria-label="关闭" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="checkout-pick-list">
                <button
                  type="button"
                  className="checkout-pick-item"
                  onClick={() => {
                    setMType('自定义');
                    setModal({ type: 'add' });
                  }}
                >
                  <span className="checkout-pick-iconbox">
                    <span className="checkout-pick-icon pick-icon-custom">自</span>
                    <span className="checkout-pick-name">自定义结账</span>
                  </span>
                  <span className="checkout-pick-desc">
                    适用于系统中全部支付场景的结账方式，可以支持计入收入或者计入优惠
                  </span>
                </button>
                <button
                  type="button"
                  className="checkout-pick-item"
                  onClick={() => {
                    setMType('优惠');
                    setModal({ type: 'add' });
                  }}
                >
                  <span className="checkout-pick-iconbox">
                    <span className="checkout-pick-icon pick-icon-coupon">优</span>
                    <span className="checkout-pick-name">优惠买单结账</span>
                  </span>
                  <span className="checkout-pick-desc">
                    适用于结账场景的结账方式，支持金额按配置规则计算部分计入收入或优惠
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 新增 / 编辑结账方式 ===== */}
      {methodModal && (() => {
        const curType: CheckoutMethod['type'] =
          methodModal.type === 'add' ? mType : (methodModal.method?.type ?? '自定义');
        const iconStyle = ICON_STYLES[mIcon] ?? ICON_STYLES[0];
        const iconChar = ICON_CHAR[curType];
        return (
          <div className="modal-mask" onClick={() => setModal(null)}>
            <div className="modal-card checkout-modal checkout-modal-lg" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">
                  {methodModal.type === 'add' ? '新增结账方式' : '编辑结账方式'}
                </div>
                <button className="modal-close" aria-label="关闭" onClick={() => setModal(null)}>
                  ×
                </button>
              </div>
              <div className="modal-body checkout-form checkout-form-lg">
                {/* ===== 基本信息 ===== */}
                <div className="checkout-form-section-title">基本信息</div>
                <div className="checkout-form-row">
                  <label>
                    <span className="required-mark">*</span>结账方式名称：
                  </label>
                  <div className="checkout-form-control">
                    <input
                      type="text"
                      placeholder="请输入结账方式名称，最多20个字符"
                      maxLength={20}
                      value={mName}
                      readOnly={methodModal.method?.source === '系统默认'}
                      onChange={(e) => {
                        setMName(e.target.value);
                        if (e.target.value.trim()) setMError(false);
                      }}
                      className={[
                        mError ? 'input-error' : '',
                        methodModal.method?.source === '系统默认' ? 'checkout-input-readonly' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                    <div className="checkout-form-desc">
                      {methodModal.method?.id === 'voucher'
                        ? '启用后，POS 端收银结账页面将展示「券类管理」中创建的抵用券；停用后不再展示。'
                        : methodModal.method?.id === 'coupon'
                          ? '启用后，POS 端收银结账页面的优惠活动中将展示「优惠折扣」中创建的折扣（如整单8折、菜品98折）；停用后不再展示。'
                          : methodModal.method?.source === '系统默认'
                            ? '系统内置结账方式，名称不可修改'
                            : '顾客使用其他方式买单时使用。（仅记账，不涉及与本平台结算，请注意查收款项并确认金额是否正确）'}
                    </div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>
                    <span className="required-mark">*</span>类型：
                  </label>
                  <div className="checkout-form-control">
                    <CommonSelect
                      value={curType}
                      width={200}
                      placeholder="请选择"
                      options={[
                        { value: '现金', label: '现金' },
                        { value: '自定义', label: '自定义' },
                        { value: '优惠', label: '优惠' },
                        { value: '抵用券', label: '抵用券' },
                      ]}
                      onChange={() => {}}
                    />
                    <div className="checkout-form-desc">
                      {methodModal.type === 'add'
                        ? '类型在「选择结账方式」中确定，不可修改'
                        : '系统内置结账方式的类型不可修改'}
                    </div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>结账方式状态：</label>
                  <div className="checkout-form-control checkout-form-inline">
                    <button
                      type="button"
                      className={`quick-switch ${mStatus === '启用' ? 'on' : ''}`}
                      role="switch"
                      aria-checked={mStatus === '启用'}
                      onClick={() => setMStatus(mStatus === '启用' ? '停用' : '启用')}
                    >
                      <span className="quick-switch-thumb" />
                    </button>
                    <span className="quick-switch-text">{mStatus === '启用' ? '启用' : '停用'}</span>
                  </div>
                </div>
                {curType === '自定义' && (
                  <div className="checkout-form-row">
                    <label>计收入规则：</label>
                    <div className="checkout-form-control">
                      <div className="checkout-form-radios">
                        {(['计入收入', '计入优惠'] as const).map((r) => (
                          <label className="radio-item" key={r}>
                            <input
                              type="radio"
                              name="income-rule"
                              checked={mIncome === r}
                              onChange={() => setMIncome(r)}
                            />
                            <span className="radio-dot" />
                            {r}
                          </label>
                        ))}
                      </div>
                      <div className="checkout-form-desc">
                        请选择该结账方式产生的支付金额，是计入收入还是计入优惠
                      </div>
                    </div>
                  </div>
                )}
                {curType === '优惠' && (
                  <>
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>优惠方案：
                      </label>
                      <div className="checkout-form-control">
                        <div className="checkout-form-radios">
                          {(['折扣', '满减', '每满减'] as const).map((r) => (
                            <label className="radio-item" key={r}>
                              <input
                                type="radio"
                                name="discount-type"
                                checked={mDiscountType === r}
                                onChange={() => setMDiscountType(r)}
                              />
                              <span className="radio-dot" />
                              {r}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    {mDiscountType === '折扣' ? (
                      <div className="checkout-form-row">
                        <label>
                          <span className="required-mark">*</span>折扣率：
                        </label>
                        <div className="checkout-form-control">
                          <div className="checkout-fee">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={mDiscountRate}
                              className={fieldError.discountRate ? 'input-error' : ''}
                              onChange={(e) => {
                                setMDiscountRate(e.target.value);
                                if (fieldError.discountRate) {
                                  setFieldError((f) => ({ ...f, discountRate: undefined }));
                                }
                              }}
                            />
                            <span className="checkout-fee-suffix">%</span>
                          </div>
                          {fieldError.discountRate && (
                            <div className="checkout-form-error">{fieldError.discountRate}</div>
                          )}
                          <div className="checkout-form-desc">
                            优惠计算规则：优惠金额=实际抵扣金额×(100%-折扣率)；例如：折扣率设置为90%，实际抵扣100元，则优惠金额为10元，实际收入金额为90元
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="checkout-form-row">
                        <label>
                          <span className="required-mark">*</span>
                          {mDiscountType === '满减' ? '满额减额：' : '每满额减额：'}
                        </label>
                        <div className="checkout-form-control">
                          <div className="checkout-fee-amounts">
                            <div className="checkout-fee">
                              <span className="checkout-fee-prefix">
                                {mDiscountType === '满减' ? '满' : '每满'}
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={mFullAmount}
                                className={fieldError.full ? 'input-error' : ''}
                                onChange={(e) => {
                                  setMFullAmount(e.target.value);
                                  if (fieldError.full) {
                                    setFieldError((f) => ({ ...f, full: undefined }));
                                  }
                                }}
                              />
                              <span className="checkout-fee-suffix">元</span>
                            </div>
                            <div className="checkout-fee">
                              <span className="checkout-fee-prefix">减</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={mReduceAmount}
                                className={fieldError.reduce ? 'input-error' : ''}
                                onChange={(e) => {
                                  setMReduceAmount(e.target.value);
                                  if (fieldError.reduce) {
                                    setFieldError((f) => ({ ...f, reduce: undefined }));
                                  }
                                }}
                              />
                              <span className="checkout-fee-suffix">元</span>
                            </div>
                          </div>
                          {(fieldError.full || fieldError.reduce) && (
                            <div className="checkout-form-error">
                              {fieldError.full || fieldError.reduce}
                            </div>
                          )}
                          <div className="checkout-form-desc">
                            {mDiscountType === '满减'
                              ? '优惠计算规则：订单实付金额达到满额后立减对应金额；例如：满100元减10元，则优惠金额为10元。'
                              : '优惠计算规则：订单实付金额每达到满额即减对应金额，可多次参与；例如：每满100元减10元，满200元则优惠金额为20元。'}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="checkout-form-row">
                  <label>手续费率：</label>
                  <div className="checkout-form-control">
                    <div className="checkout-fee">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={mFee}
                        onChange={(e) => setMFee(e.target.value)}
                      />
                      <span className="checkout-fee-suffix">%</span>
                    </div>
                    <div className="checkout-form-desc">
                      手续费=支付金额×手续费率，手续费可以在报表中心：营业收入与收款统计中查看
                    </div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>收入部分是否可以开发票：</label>
                  <div className="checkout-form-control">
                    <div className="checkout-form-radios">
                      {(['可以', '不可以'] as const).map((r) => (
                        <label className="radio-item" key={r}>
                          <input
                            type="radio"
                            name="invoice-flag"
                            checked={mInvoice === r}
                            onChange={() => setMInvoice(r)}
                          />
                          <span className="radio-dot" />
                          {r}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>图标样式：</label>
                  <div className="checkout-form-control">
                    <div className="checkout-icon-row">
                      <div
                        className="checkout-icon-preview"
                        style={{ backgroundImage: iconStyle.bg, borderColor: iconStyle.border }}
                      >
                        {iconChar}
                      </div>
                      <button
                        type="button"
                        className="tm-btn tm-btn-default"
                        onClick={() => setIconOpen(!iconOpen)}
                      >
                        编辑图标样式
                      </button>
                      <button
                        type="button"
                        className="checkout-icon-link"
                        onClick={() => setMIcon(curType === '优惠' ? 1 : 0)}
                      >
                        使用默认图标
                      </button>
                    </div>
                    {iconOpen && (
                      <div className="checkout-icon-list">
                        {ICON_STYLES.map((s, i) => (
                          <button
                            key={s.name}
                            type="button"
                            title={s.name}
                            className={`checkout-icon-opt ${mIcon === i ? 'active' : ''}`}
                            style={{ backgroundImage: s.bg, borderColor: s.border }}
                            onClick={() => setMIcon(i)}
                          >
                            {iconChar}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ===== 收银结账场景 ===== */}
                <div className="checkout-form-section-title">收银结账场景</div>
                <div className="checkout-form-card">
                  <div className="checkout-form-row">
                    <label>收银端显示/隐藏：</label>
                    <div className="checkout-form-control">
                      <div className="checkout-form-radios">
                        {(['显示', '隐藏'] as const).map((r) => (
                          <label className="radio-item" key={r}>
                            <input
                              type="radio"
                              name="cashier-show"
                              checked={mCashier === (r === '显示')}
                              onChange={() => setMCashier(r === '显示')}
                            />
                            <span className="radio-dot" />
                            {r}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="checkout-form-row">
                    <label>点餐助手和平板点餐端显示/隐藏：</label>
                    <div className="checkout-form-control">
                      <div className="checkout-form-radios">
                        {(['显示', '隐藏'] as const).map((r) => (
                          <label className="radio-item" key={r}>
                            <input
                              type="radio"
                              name="assistant-show"
                              checked={mAssistant === (r === '显示')}
                              onChange={() => setMAssistant(r === '显示')}
                            />
                            <span className="radio-dot" />
                            {r}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-foot">
                <button className="tm-btn tm-btn-default" type="button" onClick={() => setModal(null)}>
                  取消
                </button>
                <button className="tm-btn tm-btn-primary" type="button" onClick={submitMethod}>
                  确定
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== 查看结账方式 ===== */}
      {modal?.type === 'view' && (
        <div className="modal-mask" onClick={() => setModal(null)}>
          <div className="modal-card checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">查看结账方式</div>
              <button className="modal-close" aria-label="关闭" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body checkout-view">
              {[
                ['结账方式名称', modal.method.name],
                ['类型', modal.method.type],
                ['来源', modal.method.source],
                ...(modal.method.type === '自定义'
                  ? [['计收入规则', modal.method.incomeRule]]
                  : []),
                ...(modal.method.type === '优惠'
                  ? [
                      ['优惠方案', modal.method.discountType],
                      modal.method.discountType === '折扣'
                        ? ['折扣率', `${modal.method.discountRate}%`]
                        : [
                            modal.method.discountType === '满减' ? '满额减额' : '每满额减额',
                            `满${modal.method.fullAmount}元减${modal.method.reduceAmount}元`,
                          ],
                    ]
                  : []),
                ['手续费率', `${modal.method.feeRate}%`],
                ['收入部分是否可以开发票', modal.method.invoice],
                ['收银端显示', modal.method.cashierShow ? '显示' : '隐藏'],
                ['点餐助手和平板点餐端显示', modal.method.assistantShow ? '显示' : '隐藏'],
                ['状态', modal.method.status],
                ['创建时间', modal.method.createdAt],
                ['修改时间', modal.method.updatedAt],
              ].map(([label, value]) => (
                <div className="checkout-view-row" key={label}>
                  <span className="checkout-view-label">{label}</span>
                  <span className="checkout-view-value">{value}</span>
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setModal(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 结账方式排序 ===== */}
      {sortModal && (
        <div className="modal-mask" onClick={() => setModal(null)}>
          <div className="modal-card checkout-modal checkout-sort-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">结账方式排序</div>
              <button className="modal-close" aria-label="关闭" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="checkout-sort-tip">拖动或点击上下箭头调整结账方式在收银端的显示顺序</div>
              {methods.map((m, i) => (
                <div className="checkout-sort-item" key={m.id}>
                  <span className="checkout-sort-idx">{i + 1}</span>
                  <span className="checkout-sort-name">{m.name}</span>
                  <span className="checkout-sort-type">{m.type}</span>
                  <div className="checkout-sort-ops">
                    <button type="button" className="checkout-sort-btn" disabled={i === 0} aria-label="上移" onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className="checkout-sort-btn" disabled={i === methods.length - 1} aria-label="下移" onClick={() => move(i, 1)}>↓</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setModal(null)}>
                取消
              </button>
              <button className="tm-btn tm-btn-primary" type="button" onClick={() => setModal(null)}>
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 新增 / 编辑分类 ===== */}
      {modal?.type === 'addCat' && <CatFormModal cat={null} onClose={() => setModal(null)} onSave={saveCat} />}
      {modal?.type === 'editCat' && <CatFormModal cat={modal.cat} onClose={() => setModal(null)} onSave={saveCat} />}

      {/* 停用 / 启用确认 */}
      {confirm && (
        <ConfirmModal
          open
          title={confirm.to === '停用' ? '停用结账方式' : '启用结账方式'}
          message={`确定要${confirm.to}结账方式「${confirm.method.name}」吗？${confirm.to === '停用' ? '停用后收银端将无法使用该方式结账。' : ''}`}
          confirmText={confirm.to}
          cancelText="取消"
          onCancel={() => setConfirm(null)}
          onConfirm={() => handleToggleStatus(confirm.method, confirm.to)}
        />
      )}

      {/* 删除分类确认 */}
      {catDelete && (
        <ConfirmModal
          open
          title="删除分类"
          message={`确定要删除分类「${catDelete.name}」吗？删除后该分类下的结账方式将移动到「自定义类」。`}
          confirmText="删除"
          cancelText="取消"
          danger
          onCancel={() => setCatDelete(null)}
          onConfirm={async () => {
            const next = cats.filter((c) => c.id !== catDelete.id);
            setCats(next);
            try {
              await putBucket(PAYMENTS_BUCKET, { methods, cats: next, quick });
            } catch (e) {
              setToast({ type: 'error', text: (e as Error).message || '保存失败' });
            }
            setCatDelete(null);
            setToast({ type: 'success', text: '分类已删除' });
          }}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/** 分类表单弹窗 */
function CatFormModal({
  cat,
  onClose,
  onSave,
}: {
  cat: CheckoutCategory | null;
  onClose: () => void;
  onSave: (name: string, desc: string) => void;
}) {
  const [name, setName] = useState(cat?.name ?? '');
  const [desc, setDesc] = useState(cat?.desc ?? '');
  const [error, setError] = useState(false);
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card checkout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{cat ? '编辑分类' : '新增分类'}</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body checkout-form">
          <div className="checkout-form-row">
            <label>
              <span className="required-mark">*</span>分类名称：
            </label>
            <input
              type="text"
              placeholder="请输入，最多支持10个字符"
              maxLength={10}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setError(false);
              }}
              className={error ? 'input-error' : ''}
            />
          </div>
          <div className="checkout-form-row">
            <label>描述：</label>
            <input
              type="text"
              placeholder="请输入分类描述（选填）"
              maxLength={50}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="tm-btn tm-btn-default" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="tm-btn tm-btn-primary"
            type="button"
            onClick={() => {
              if (!name.trim()) {
                setError(true);
                return;
              }
              onSave(name.trim(), desc.trim());
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
