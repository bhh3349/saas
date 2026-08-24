import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { DatePicker, TimePicker } from 'antd';
import ConfirmModal from '../components/ConfirmModal';
import SearchForm from '../components/SearchForm';
import Toast, { type ToastData } from '../components/Toast';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/Pagination';
import { getBucket, putBucket } from '../api/buckets';
import { listAllDishesApi } from '../api/dishes';

/** 券配置桶 key */
const BUCKET_KEY = 'voucher';

/** 抵用券分类：仅两种 */
type VoucherType = '代金券' | '菜品抵用券';

/** 抵用券分类选项 */
const VOUCHER_CATS: VoucherType[] = ['代金券', '菜品抵用券'];

/** 券 */
interface Voucher {
  id: string;
  type: VoucherType;
  name: string;
  /** 图标样式索引（ICON_STYLES） */
  icon: number;
  /** 券面值 */
  faceValue: number;
  /** 券收入 */
  income: number;
  /** 手续费率% */
  feeRate: number;
  /** 适用菜品范围 */
  itemScope: '全部菜品' | '部分可用' | '部分不可用';
  /** 适用菜品名称列表 */
  items: string[];
  /** 抵用券分类名称 */
  category: string;
  /** 永久有效（优先于起止日期） */
  forever: boolean;
  /** 有效期开始 */
  startDate: string;
  /** 有效期结束 */
  endDate: string;
  /** 不可用日期段 */
  unavailableDates: { start: string; end: string }[];
  /** 活动星期 1-7 */
  weekdays: number[];
  /** 活动时间段 */
  timeRanges: { start: string; end: string }[];
  /** 使用门槛 */
  conditionType: '无门槛' | '满额可用' | '每满额可用';
  /** 门槛金额 */
  conditionAmount: number;
  /** 单笔订单最多可用张数 */
  maxPerOrder: number;
  /** 是否可与其他优惠活动同享 */
  shareWithOthers: '是' | '否';
  /** 券来源 */
  sourceNote: string;
  status: '启用' | '停用';
  createdAt: string;
  updatedAt: string;
}

/** 图标样式预设（与结账方式管理一致） */
const ICON_STYLES = [
  { name: '青绿', bg: 'linear-gradient(135deg,#2bd9bf,#12b39a)', border: 'rgba(8,166,140,0.6)' },
  { name: '橙红', bg: 'linear-gradient(135deg,#ff9641,#ff5d0d)', border: 'rgba(242,105,36,0.6)' },
  { name: '海蓝', bg: 'linear-gradient(135deg,#4d8dff,#2f5bff)', border: 'rgba(47,91,255,0.6)' },
  { name: '绛紫', bg: 'linear-gradient(135deg,#9a7bff,#6b4dff)', border: 'rgba(107,77,255,0.6)' },
];
const VOUCHER_ICON_CHAR: Record<VoucherType, string> = { 代金券: '代', 菜品抵用券: '菜' };

const WEEKDAYS = [
  { n: 1, label: '星期一' },
  { n: 2, label: '星期二' },
  { n: 3, label: '星期三' },
  { n: 4, label: '星期四' },
  { n: 5, label: '星期五' },
  { n: 6, label: '星期六' },
  { n: 7, label: '星期日' },
];

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/** 有效期状态：未开始 / 进行中 / 已过期 */
type VoucherLifeStatus = '未开始' | '进行中' | '已过期';

const pad2 = (n: number) => String(n).padStart(2, '0');
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** 计算券的有效期状态（永久有效恒为进行中） */
const lifeStatus = (v: Voucher): VoucherLifeStatus => {
  if (v.forever) return '进行中';
  const today = todayKey();
  if (v.startDate && v.startDate > today) return '未开始';
  if (v.endDate && v.endDate < today) return '已过期';
  return '进行中';
};

/** 兼容旧版本数据（无收入/适用菜品等字段） */
const normalizeVoucher = (v: Partial<Voucher>): Voucher => {
  const type: VoucherType =
    v.type === '菜品抵用券' || (v.type as string) === '菜品券' ? '菜品抵用券' : '代金券';
  return {
    id: v.id ?? `v-${Date.now()}`,
    type,
    name: v.name ?? '',
    icon: v.icon ?? 0,
    faceValue: v.faceValue ?? 0,
    income: v.income ?? v.faceValue ?? 0,
    feeRate: v.feeRate ?? 0,
    itemScope: v.itemScope ?? '全部菜品',
    items: v.items ?? [],
    category: v.category || type,
  forever: v.forever ?? true,
  startDate: v.startDate ?? '',
  endDate: v.endDate ?? '',
  unavailableDates: v.unavailableDates ?? [],
  weekdays: v.weekdays ?? [1, 2, 3, 4, 5, 6, 7],
  timeRanges: v.timeRanges ?? [{ start: '00:00', end: '23:59' }],
  conditionType: v.conditionType ?? '无门槛',
  conditionAmount: v.conditionAmount ?? 0,
  maxPerOrder: v.maxPerOrder ?? 1,
  shareWithOthers: v.shareWithOthers ?? '是',
  sourceNote: v.sourceNote ?? '',
  status: v.status === '停用' ? '停用' : '启用',
    createdAt: v.createdAt ?? now(),
    updatedAt: v.updatedAt ?? now(),
  };
};

/** 新增/编辑表单 */
interface VoucherForm {
  type: VoucherType;
  name: string;
  icon: number;
  faceValue: string;
  income: string;
  feeRate: string;
  itemScope: '全部菜品' | '部分可用' | '部分不可用';
  items: string[];
  forever: boolean;
  startDate: string;
  endDate: string;
  unavailableDates: { start: string; end: string }[];
  weekdays: number[];
  timeRanges: { start: string; end: string }[];
  conditionType: '无门槛' | '满额可用' | '每满额可用';
  conditionAmount: string;
  maxPerOrder: string;
  shareWithOthers: '是' | '否';
  sourceNote: string;
  status: '启用' | '停用';
}

const emptyForm = (): VoucherForm => ({
  type: '代金券',
  name: '',
  icon: 0,
  faceValue: '',
  income: '',
  feeRate: '0',
  itemScope: '全部菜品',
  items: [],
  forever: true,
  startDate: '',
  endDate: '',
  unavailableDates: [],
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  timeRanges: [{ start: '00:00', end: '23:59' }],
  conditionType: '无门槛',
  conditionAmount: '',
  maxPerOrder: '1',
  shareWithOthers: '是',
  sourceNote: '',
  status: '启用',
});

const formFromVoucher = (v: Voucher): VoucherForm => ({
  type: v.type,
  name: v.name,
  icon: v.icon,
  faceValue: String(v.faceValue),
  income: String(v.income),
  feeRate: String(v.feeRate),
  itemScope: v.itemScope,
  items: v.items,
  forever: v.forever,
  startDate: v.startDate,
  endDate: v.endDate,
  unavailableDates: v.unavailableDates.map((x) => ({ ...x })),
  weekdays: [...v.weekdays],
  timeRanges: v.timeRanges.map((x) => ({ ...x })),
  conditionType: v.conditionType,
  conditionAmount: String(v.conditionAmount),
  maxPerOrder: String(v.maxPerOrder),
  shareWithOthers: v.shareWithOthers,
  sourceNote: v.sourceNote,
  status: v.status,
});

type VModal = { type: 'add' } | { type: 'edit'; voucher: Voucher } | null;

export default function VoucherManage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  /** 后端菜品名称（适用菜品选择用） */
  const [dishNames, setDishNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  /** 查询 */
  const [q, setQ] = useState({ name: '', category: '', status: '', life: '' });

  /** 弹窗 / 确认 */
  const [modal, setModal] = useState<VModal>(null);
  const [del, setDel] = useState<Voucher | null>(null);
  const [toggle, setToggle] = useState<{ v: Voucher; to: '启用' | '停用' } | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  /** 分页 */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  /** 表单 */
  const [form, setForm] = useState<VoucherForm>(() => emptyForm());
  const patch = (p: Partial<VoucherForm>) => setForm((f) => ({ ...f, ...p }));
  /** 适用菜品选择弹窗 */
  const [dishOpen, setDishOpen] = useState(false);
  const [tempItems, setTempItems] = useState<string[]>([]);
  const [errors, setErrors] = useState<{
    name?: string;
    faceValue?: string;
    income?: string;
    items?: string;
    date?: string;
    conditionAmount?: string;
    maxPerOrder?: string;
  }>({});

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /** 从云端加载券列表与菜品名 */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getBucket<Voucher[]>(BUCKET_KEY);
        if (active && Array.isArray(data)) setVouchers(data.map(normalizeVoucher));
      } catch {
        /* 忽略加载失败 */
      }
      try {
        const dishes = await listAllDishesApi();
        if (active) setDishNames(dishes.map((d) => d.name));
      } catch {
        /* 忽略加载失败 */
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const k = q.name.trim();
    return vouchers.filter((v) => {
      if (k && !v.name.includes(k)) return false;
      if (q.category && v.category !== q.category) return false;
      if (q.status && v.status !== q.status) return false;
      if (q.life && lifeStatus(v) !== q.life) return false;
      return true;
    });
  }, [vouchers, q]);

  /** 分页切片 */
  const pagedVouchers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  /** 页码越界保护 */
  useEffect(() => {
    const max = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (page > max) setPage(max);
  }, [page, pageSize, filtered.length]);

  const persist = async (next: Voucher[]) => {
    setVouchers(next);
    try {
      await putBucket(BUCKET_KEY, next);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  /** 打开新增弹窗 */
  const openAdd = () => {
    setForm(emptyForm());
    setErrors({});
    setModal({ type: 'add' });
  };

  /** 打开编辑弹窗 */
  const openEdit = (v: Voucher) => {
    setForm(formFromVoucher(v));
    setErrors({});
    setModal({ type: 'edit', voucher: v });
  };

  const clearErr = (k: keyof typeof errors) =>
    setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x));

  /** 提交新增 / 编辑 */
  const submit = async () => {
    if (!modal) return;
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = '请输入券名称';
    const face = Number(form.faceValue);
    if (!(face > 0)) errs.faceValue = '请输入大于 0 的券面值';
    const income = Number(form.income);
    if (!(income > 0)) errs.income = '请输入大于 0 的券收入';
    if (form.itemScope !== '全部菜品' && form.items.length === 0) {
      errs.items = form.itemScope === '部分可用' ? '请至少选择 1 个适用菜品' : '请至少选择 1 个不适用菜品';
    }
    if (!form.forever) {
      if (!form.startDate || !form.endDate) {
        errs.date = '请选择有效期起止日期';
      } else if (form.startDate > form.endDate) {
        errs.date = '开始日期不能晚于结束日期';
      }
    }
    if (form.conditionType !== '无门槛') {
      const ca = Number(form.conditionAmount);
      if (!(ca > 0)) errs.conditionAmount = '请输入大于 0 的门槛金额';
    }
    const max = Number(form.maxPerOrder);
    if (!Number.isInteger(max) || max < 1 || max > 999) {
      errs.maxPerOrder = '请输入 1-999 之间的整数';
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const data: Omit<Voucher, 'id' | 'createdAt' | 'updatedAt'> = {
      type: form.type,
      name: form.name.trim(),
      icon: form.icon,
      faceValue: face,
      income,
      feeRate: Number.isFinite(Number(form.feeRate)) && Number(form.feeRate) >= 0 ? Number(form.feeRate) : 0,
      itemScope: form.itemScope,
      items: form.items,
      category: form.type,
      forever: form.forever,
      startDate: form.startDate,
      endDate: form.endDate,
      unavailableDates: form.unavailableDates.map((x) => ({ ...x })),
      weekdays: [...form.weekdays],
      timeRanges: form.timeRanges.map((x) => ({ ...x })),
      conditionType: form.conditionType,
      conditionAmount: Number(form.conditionAmount) || 0,
      maxPerOrder: max,
      shareWithOthers: form.shareWithOthers,
      sourceNote: form.sourceNote.trim(),
      status: form.status,
    };
    if (modal.type === 'add') {
      await persist([
        ...vouchers,
        { ...data, id: `v-${Date.now()}`, createdAt: now(), updatedAt: now() },
      ]);
      setToast({ type: 'success', text: '新增成功' });
    } else {
      await persist(
        vouchers.map((v) =>
          v.id === modal.voucher.id ? { ...v, ...data, updatedAt: now() } : v,
        ),
      );
      setToast({ type: 'success', text: '保存成功' });
    }
    setModal(null);
  };

  const handleToggle = async (v: Voucher, to: '启用' | '停用') => {
    await persist(vouchers.map((x) => (x.id === v.id ? { ...x, status: to, updatedAt: now() } : x)));
    setToggle(null);
    setToast({ type: 'success', text: `「${v.name}」已${to}` });
  };

  const openDishPicker = () => {
    setTempItems(form.items);
    setDishOpen(true);
  };

  const renderStatus = (s: Voucher['status']) => (
    <span className={`checkout-status ${s === '启用' ? 'on' : 'off'}`}>
      <i className="checkout-status-dot" />
      {s}
    </span>
  );

  const renderExpire = (v: Voucher) =>
    v.forever ? '永久有效' : `${v.startDate} ~ ${v.endDate}`;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">券类管理</h1>
      </div>

      <div className="checkout-panel">
        <div className="checkout-toolbar">
          <div className="checkout-actions">
            <button className="tm-btn tm-btn-primary" type="button" onClick={openAdd}>
              + 新增抵用券
            </button>
          </div>
          <SearchForm
            className="checkout-search"
            fields={[
              { key: 'name', label: '券名称', placeholder: '请输入券名称', width: 160 },
              {
                key: 'category',
                label: '抵用券分类',
                type: 'select',
                placeholder: '请选择',
                width: 130,
                options: VOUCHER_CATS.map((c) => ({ value: c, label: c })),
              },
              {
                key: 'status',
                label: '状态',
                type: 'select',
                placeholder: '请选择',
                width: 100,
                options: [
                  { value: '启用', label: '启用' },
                  { value: '停用', label: '停用' },
                ],
              },
              {
                key: 'life',
                label: '有效期状态',
                type: 'select',
                placeholder: '全部',
                width: 120,
                options: [
                  { value: '未开始', label: '未开始' },
                  { value: '进行中', label: '进行中' },
                  { value: '已过期', label: '已过期' },
                ],
              },
            ]}
            values={q}
            onChange={(k, v) => setQ((old) => ({ ...old, [k]: v }))}
            onSearch={() => {}}
            onReset={() => setQ({ name: '', category: '', status: '', life: '' })}
          />
        </div>

        <div className="data-table checkout-table">
          <div className="area-table-scroll checkout-scroll">
            <table className="checkout-real-table">
              <colgroup>
                <col style={{ width: 70 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 150 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="th-center">序号</th>
                  <th>券名称</th>
                  <th>抵用券分类名称</th>
                  <th className="th-center">券面值</th>
                  <th className="th-center">券收入</th>
                  <th>有效期</th>
                  <th className="th-center">创建来源</th>
                  <th className="th-center">状态</th>
                  <th className="th-sticky">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td className="checkout-empty-cell" colSpan={9}>
                      {loading ? '加载中…' : '暂无抵用券，点击右上角「新增抵用券」创建'}
                    </td>
                  </tr>
                )}
                {pagedVouchers.map((v, i) => (
                  <tr key={v.id}>
                    <td className="td-center">{(page - 1) * pageSize + i + 1}</td>
                    <td>{v.name}</td>
                    <td>{v.category}</td>
                    <td className="td-center">¥{v.faceValue}</td>
                    <td className="td-center">¥{v.income}</td>
                    <td>{renderExpire(v)}</td>
                    <td className="td-center">门店自建</td>
                    <td className="td-center">{renderStatus(v.status)}</td>
                    <td className="td-sticky">
                      <div className="row-actions">
                        <button className="action-link" onClick={() => openEdit(v)}>编辑</button>
                        <button
                          className={`action-link ${v.status === '启用' ? 'danger' : ''}`}
                          onClick={() => setToggle({ v, to: v.status === '启用' ? '停用' : '启用' })}
                        >
                          {v.status === '启用' ? '停用' : '启用'}
                        </button>
                        <button className="action-link danger" onClick={() => setDel(v)}>删除</button>
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

      {/* ===== 新增 / 编辑抵用券 ===== */}
      {modal && (() => {
        const iconStyle = ICON_STYLES[form.icon] ?? ICON_STYLES[0];
        const iconChar = VOUCHER_ICON_CHAR[form.type];
        return (
          <div className="modal-mask" onClick={() => setModal(null)}>
            <div className="modal-card checkout-modal checkout-modal-lg" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">{modal.type === 'add' ? '新增抵用券' : '编辑抵用券'}</div>
                <button className="modal-close" aria-label="关闭" onClick={() => setModal(null)}>
                  ×
                </button>
              </div>
              <div className="modal-body checkout-form checkout-form-lg">
                {/* ===== 基本信息 ===== */}
                <div className="checkout-form-section-title">基本信息</div>
                <div className="checkout-form-row">
                  <label>
                    <span className="required-mark">*</span>抵用券分类：
                  </label>
                  <div className="checkout-form-control">
                    <div className="checkout-form-radios">
                      {VOUCHER_CATS.map((r) => (
                        <label className="radio-item" key={r}>
                          <input
                            type="radio"
                            name="voucher-cat"
                            checked={form.type === r}
                            onChange={() => patch({ type: r })}
                          />
                          <span className="radio-dot" />
                          {r}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>
                    <span className="required-mark">*</span>券名称：
                  </label>
                  <div className="checkout-form-control">
                    <input
                      type="text"
                      placeholder="请输入券的名称，最多20个字符"
                      maxLength={20}
                      value={form.name}
                      className={errors.name ? 'input-error' : ''}
                      onChange={(e) => {
                        patch({ name: e.target.value });
                        if (errors.name) clearErr('name');
                      }}
                    />
                    {errors.name && <div className="checkout-form-error">{errors.name}</div>}
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
                        onClick={() => patch({ icon: (form.icon + 1) % ICON_STYLES.length })}
                      >
                        编辑图标样式
                      </button>
                      <button
                        type="button"
                        className="checkout-icon-link"
                        onClick={() => patch({ icon: 0 })}
                      >
                        使用默认图标
                      </button>
                    </div>
                    <div className="checkout-icon-list">
                      {ICON_STYLES.map((s, i) => (
                        <button
                          key={s.name}
                          type="button"
                          title={s.name}
                          className={`checkout-icon-opt ${form.icon === i ? 'active' : ''}`}
                          style={{ backgroundImage: s.bg, borderColor: s.border }}
                          onClick={() => patch({ icon: i })}
                        >
                          {iconChar}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>
                    <span className="required-mark">*</span>券面值：
                  </label>
                  <div className="checkout-form-control">
                    <div className="checkout-fee">
                      <span className="checkout-fee-prefix">¥</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={form.faceValue}
                        className={errors.faceValue ? 'input-error' : ''}
                        onChange={(e) => {
                          patch({ faceValue: e.target.value });
                          if (errors.faceValue) clearErr('faceValue');
                        }}
                      />
                      <span className="checkout-fee-suffix">元</span>
                    </div>
                    <div className="checkout-form-desc">代金券最多可抵扣的金额</div>
                    {errors.faceValue && <div className="checkout-form-error">{errors.faceValue}</div>}
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>
                    <span className="required-mark">*</span>券收入：
                  </label>
                  <div className="checkout-form-control">
                    <div className="checkout-fee">
                      <span className="checkout-fee-prefix">¥</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={form.income}
                        className={errors.income ? 'input-error' : ''}
                        onChange={(e) => {
                          patch({ income: e.target.value });
                          if (errors.income) clearErr('income');
                        }}
                      />
                      <span className="checkout-fee-suffix">元</span>
                    </div>
                    <div className="checkout-form-tip">
                      优惠计算规则：券优惠金额=实际抵扣金额-券收入。例：面值100，券收入85，实际抵扣98，券优惠=98-85=13元
                    </div>
                    {errors.income && <div className="checkout-form-error">{errors.income}</div>}
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>手续费率：</label>
                  <div className="checkout-form-control">
                    <div className="checkout-fee">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0"
                        value={form.feeRate}
                        onChange={(e) => patch({ feeRate: e.target.value })}
                      />
                      <span className="checkout-fee-suffix">%</span>
                    </div>
                    <div className="checkout-form-desc">
                      手续费=券收入×手续费率，手续费可以在报表中心：营业收入与收款统计中查看
                    </div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>适用菜品：</label>
                  <div className="checkout-form-control">
                    <div className="checkout-form-radios">
                      {(['全部菜品', '部分可用', '部分不可用'] as const).map((r) => (
                        <label className="radio-item" key={r}>
                          <input
                            type="radio"
                            name="item-scope"
                            checked={form.itemScope === r}
                            onChange={() => {
                              patch({ itemScope: r });
                              if (errors.items) clearErr('items');
                            }}
                          />
                          <span className="radio-dot" />
                          {r}
                        </label>
                      ))}
                    </div>
                    <div className="checkout-form-desc">
                      您可以设置该代金券不适用或仅适用部分菜品，未选择的菜品将按全部菜品处理
                    </div>
                    {form.itemScope !== '全部菜品' && (
                      <>
                        <div className="checkout-dish-row">
                          <button type="button" className="tm-btn tm-btn-default" onClick={openDishPicker}>
                            选择菜品
                          </button>
                          {form.items.length > 0 && (
                            <div className="checkout-dish-tags">
                              {form.items.map((d) => (
                                <span className="checkout-dish-tag" key={d}>
                                  {d}
                                  <i
                                    className="checkout-dish-tag-x"
                                    onClick={() => {
                                      patch({ items: form.items.filter((x) => x !== d) });
                                      if (errors.items) clearErr('items');
                                    }}
                                  >
                                    ×
                                  </i>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {errors.items && <div className="checkout-form-error">{errors.items}</div>}
                      </>
                    )}
                  </div>
                </div>
                {/* ===== 有效期与使用规则 ===== */}
                <div className="checkout-form-section-title">有效期与使用规则</div>
                <div className="checkout-form-row">
                  <label>
                    <span className="required-mark">*</span>有效期：
                  </label>
                  <div className="checkout-form-control">
                    <div className="checkout-form-radios">
                      {(['永久有效', '自定义日期'] as const).map((r) => (
                        <label className="radio-item" key={r}>
                          <input
                            type="radio"
                            name="voucher-expire"
                            checked={(r === '永久有效') === form.forever}
                            onChange={() => {
                              patch({ forever: r === '永久有效' });
                              if (errors.date) clearErr('date');
                            }}
                          />
                          <span className="radio-dot" />
                          {r}
                        </label>
                      ))}
                    </div>
                    {!form.forever && (
                      <div className="checkout-form-date">
                        <DatePicker.RangePicker
                          value={
                            form.startDate && form.endDate
                              ? [dayjs(form.startDate), dayjs(form.endDate)]
                              : null
                          }
                          onChange={(dates) => {
                            patch({
                              startDate: dates?.[0]?.format('YYYY-MM-DD') ?? '',
                              endDate: dates?.[1]?.format('YYYY-MM-DD') ?? '',
                            });
                            if (errors.date) clearErr('date');
                          }}
                          placeholder={['开始日期', '结束日期']}
                          style={{ width: 280 }}
                        />
                      </div>
                    )}
                    {errors.date && <div className="checkout-form-error">{errors.date}</div>}
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>不可用日期：</label>
                  <div className="checkout-form-control">
                    {form.unavailableDates.map((r, i) => (
                      <div className="checkout-range-row" key={i}>
                        <DatePicker.RangePicker
                          value={
                            r.start && r.end
                              ? [dayjs(r.start), dayjs(r.end)]
                              : null
                          }
                          onChange={(dates) => {
                            const list = form.unavailableDates.map((x, j) =>
                              j === i
                                ? {
                                    start: dates?.[0]?.format('YYYY-MM-DD') ?? '',
                                    end: dates?.[1]?.format('YYYY-MM-DD') ?? '',
                                  }
                                : x,
                            );
                            patch({ unavailableDates: list });
                          }}
                          placeholder={['开始日期', '结束日期']}
                          style={{ width: 260 }}
                        />
                        <button
                          type="button"
                          className="checkout-range-del"
                          onClick={() =>
                            patch({ unavailableDates: form.unavailableDates.filter((_, j) => j !== i) })
                          }
                        >
                          删除
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="checkout-add-range"
                      onClick={() =>
                        patch({ unavailableDates: [...form.unavailableDates, { start: '', end: '' }] })
                      }
                    >
                      + 添加日期段
                    </button>
                    <div className="checkout-form-desc">设置后，该券在指定日期不生效。</div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>活动星期：</label>
                  <div className="checkout-form-control">
                    <div className="checkout-weekday">
                      {WEEKDAYS.map((w) => {
                        const on = form.weekdays.includes(w.n);
                        return (
                          <button
                            type="button"
                            key={w.n}
                            className={`checkout-weekday-item ${on ? 'on' : ''}`}
                            onClick={() =>
                              patch({
                                weekdays: on
                                  ? form.weekdays.filter((x) => x !== w.n)
                                  : [...form.weekdays, w.n].sort(),
                              })
                            }
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="checkout-form-desc">
                      举例：如10.1-10.5不可用，活动星期在10.1-10.5期间可用，则最终取不可用。
                    </div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>活动时间：</label>
                  <div className="checkout-form-control">
                    {form.timeRanges.map((r, i) => (
                      <div className="checkout-range-row" key={i}>
                        <TimePicker
                          value={r.start ? dayjs(r.start, 'HH:mm') : null}
                          onChange={(t) => {
                            const list = form.timeRanges.map((x, j) =>
                              j === i
                                ? { ...x, start: t ? t.format('HH:mm') : '' }
                                : x,
                            );
                            patch({ timeRanges: list });
                          }}
                          format="HH:mm"
                          placeholder="开始时间"
                          style={{ width: 110 }}
                        />
                        <span className="checkout-date-sep">-</span>
                        <TimePicker
                          value={r.end ? dayjs(r.end, 'HH:mm') : null}
                          onChange={(t) => {
                            const list = form.timeRanges.map((x, j) =>
                              j === i
                                ? { ...x, end: t ? t.format('HH:mm') : '' }
                                : x,
                            );
                            patch({ timeRanges: list });
                          }}
                          format="HH:mm"
                          placeholder="结束时间"
                          style={{ width: 110 }}
                        />
                        <button
                          type="button"
                          className="checkout-range-del"
                          onClick={() =>
                            patch({ timeRanges: form.timeRanges.filter((_, j) => j !== i) })
                          }
                        >
                          删除
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="checkout-add-range"
                      onClick={() =>
                        patch({ timeRanges: [...form.timeRanges, { start: '00:00', end: '23:59' }] })
                      }
                    >
                      + 添加时间段
                    </button>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>使用门槛：</label>
                  <div className="checkout-form-control">
                    <div className="checkout-form-radios">
                      {(['无门槛', '满额可用', '每满额可用'] as const).map((r) => (
                        <label className="radio-item" key={r}>
                          <input
                            type="radio"
                            name="condition"
                            checked={form.conditionType === r}
                            onChange={() => {
                              patch({ conditionType: r });
                              if (errors.conditionAmount) clearErr('conditionAmount');
                            }}
                          />
                          <span className="radio-dot" />
                          {r === '满额可用' ? '适用菜品满额可用' : r === '每满额可用' ? '适用菜品每满额可用' : r}
                        </label>
                      ))}
                    </div>
                    {form.conditionType !== '无门槛' && (
                      <div className="checkout-fee checkout-fee-inline">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={form.conditionAmount}
                          className={errors.conditionAmount ? 'input-error' : ''}
                          onChange={(e) => {
                            patch({ conditionAmount: e.target.value });
                            if (errors.conditionAmount) clearErr('conditionAmount');
                          }}
                        />
                        <span className="checkout-fee-suffix">元</span>
                      </div>
                    )}
                    {errors.conditionAmount && (
                      <div className="checkout-form-error">{errors.conditionAmount}</div>
                    )}
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>单笔订单限制：</label>
                  <div className="checkout-form-control">
                    <div className="checkout-fee checkout-fee-inline">
                      <input
                        type="number"
                        min="1"
                        max="999"
                        step="1"
                        placeholder="1"
                        value={form.maxPerOrder}
                        className={errors.maxPerOrder ? 'input-error' : ''}
                        onChange={(e) => {
                          patch({ maxPerOrder: e.target.value });
                          if (errors.maxPerOrder) clearErr('maxPerOrder');
                        }}
                      />
                      <span className="checkout-fee-suffix">张</span>
                    </div>
                    <div className="checkout-form-desc">单笔订单最多可用 {form.maxPerOrder || 0} 张券</div>
                    {errors.maxPerOrder && (
                      <div className="checkout-form-error">{errors.maxPerOrder}</div>
                    )}
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>是否可与其他优惠活动同享：</label>
                  <div className="checkout-form-control">
                    <div className="checkout-form-radios">
                      {(['是', '否'] as const).map((r) => (
                        <label className="radio-item" key={r}>
                          <input
                            type="radio"
                            name="share"
                            checked={form.shareWithOthers === r}
                            onChange={() => patch({ shareWithOthers: r })}
                          />
                          <span className="radio-dot" />
                          {r}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>券来源：</label>
                  <div className="checkout-form-control">
                    <input
                      type="text"
                      placeholder="如：店内印制"
                      maxLength={20}
                      value={form.sourceNote}
                      onChange={(e) => patch({ sourceNote: e.target.value })}
                    />
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>券状态：</label>
                  <div className="checkout-form-control checkout-form-inline">
                    <button
                      type="button"
                      className={`quick-switch ${form.status === '启用' ? 'on' : ''}`}
                      role="switch"
                      aria-checked={form.status === '启用'}
                      onClick={() => patch({ status: form.status === '启用' ? '停用' : '启用' })}
                    >
                      <span className="quick-switch-thumb" />
                    </button>
                    <span className="quick-switch-text">{form.status === '启用' ? '启用' : '停用'}</span>
                  </div>
                </div>
              </div>
              <div className="modal-foot">
                <button className="tm-btn tm-btn-default" type="button" onClick={() => setModal(null)}>
                  取消
                </button>
                <button className="tm-btn tm-btn-primary" type="button" onClick={submit}>
                  保存
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== 选择菜品 ===== */}
      {dishOpen && (
        <div className="modal-mask" onClick={() => setDishOpen(false)}>
          <div className="modal-card checkout-modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">选择菜品</div>
              <button className="modal-close" aria-label="关闭" onClick={() => setDishOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="checkout-dish-grid">
                {dishNames.map((d) => (
                  <label className="checkout-dish-check" key={d}>
                    <input
                      type="checkbox"
                      checked={tempItems.includes(d)}
                      onChange={() =>
                        setTempItems((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                        )
                      }
                    />
                    <span className="checkout-dish-check-box" />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <span className="checkout-dish-count">已选 {tempItems.length} 个菜品</span>
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setDishOpen(false)}>
                取消
              </button>
              <button
                className="tm-btn tm-btn-primary"
                type="button"
                onClick={() => {
                  patch({ items: tempItems });
                  if (errors.items) clearErr('items');
                  setDishOpen(false);
                }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 停用 / 启用确认 */}
      {toggle && (
        <ConfirmModal
          open
          title={toggle.to === '停用' ? '停用抵用券' : '启用抵用券'}
          message={`确定要${toggle.to}抵用券「${toggle.v.name}」吗？${
            toggle.to === '停用' ? '停用后门店将无法使用该券。' : ''
          }`}
          confirmText={toggle.to}
          cancelText="取消"
          onCancel={() => setToggle(null)}
          onConfirm={() => handleToggle(toggle.v, toggle.to)}
        />
      )}

      {/* 删除确认 */}
      {del && (
        <ConfirmModal
          open
          title="删除抵用券"
          message={`确定要删除抵用券「${del.name}」吗？删除后不可恢复。`}
          confirmText="删除"
          cancelText="取消"
          danger
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            await persist(vouchers.filter((x) => x.id !== del.id));
            setDel(null);
            setToast({ type: 'success', text: '删除成功' });
          }}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
