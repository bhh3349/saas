import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { DatePicker, Select } from 'antd';
import ConfirmModal from '../components/ConfirmModal';
import SearchForm from '../components/SearchForm';
import Toast, { type ToastData } from '../components/Toast';
import DishPickerModal, { type PickableDish } from '../components/DishPickerModal';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/Pagination';
import { getStoredUser } from '../api/http';
import type { MerchantUser } from '../api/types';
import { getBucket, putBucket } from '../api/buckets';
import { listAllDishesApi } from '../api/dishes';

/** 优惠活动桶 key */
const BUCKET_KEY = 'discount';

/** 当前登录账号信息（创建人 / 修改人） */
const currentOperator = (): string => {
  const u = getStoredUser<MerchantUser>();
  if (!u) return '-';
  return u.name?.trim() || u.phone || '-';
};

/** 活动状态 */
type ActivityStatus = '进行中' | '未开始' | '已结束';

/** 活动类型定义（新增时可选，POS 结账优惠栏按此展示） */
interface ActivityTypeDef {
  value: string;
  icon: string;
  desc: string;
  example: string;
}

const ACTIVITY_TYPES: ActivityTypeDef[] = [
  { value: '整单折扣', icon: '折', desc: '全场统一折扣', example: '全场 8 折' },
  { value: '满减', icon: '减', desc: '消费满额立减', example: '满 100 减 20' },
  { value: '特价菜', icon: '菜', desc: '指定菜品特价销售', example: '毛肚特价 39 元' },
  { value: '方案折扣', icon: '方', desc: '按方案分组设置折扣', example: '素菜 5 折、海鲜 8 折' },
];

const ACTIVITY_TYPE_VALUES = ACTIVITY_TYPES.map((t) => t.value);

/** 旧版本遗留类型（仅兼容展示与编辑，不再用于新增） */
const LEGACY_TYPES = ['菜品折扣', '菜品满减', '整单满减', '折扣券'] as const;

/** 收银机点餐自动参与 */
const AUTO_JOIN_OPTS = ['不自动参与活动', '自动参与活动'] as const;

/** 特价菜行 */
interface SpecialItem {
  dish: string;
  price: number;
}
/** 方案折扣行 */
interface PlanItem {
  label: string;
  discount: number;
}

/** 满减规则行 */
interface ReduceRule {
  /** 满减门槛 */
  threshold: number;
  /** 立减金额 */
  reduce: number;
}

/** 活动 */
interface Activity {
  /** 活动ID */
  id: string;
  /** 活动名称 */
  name: string;
  /** 活动类型 */
  type: string;
  /** 折扣（7.8 = 7.8 折，整单折扣 / 菜品折扣生效） */
  discount: number;
  /** 满减门槛（满减 / 菜品满减 / 整单满减生效，兼容旧数据；新数据请使用 reduceRules） */
  threshold: number;
  /** 满减立减金额（兼容旧数据） */
  reduce: number;
  /** 满减规则多档（新版本，满减 / 菜品满减 / 整单满减生效） */
  reduceRules: ReduceRule[];
  /** 扫码点餐是否生效（满减类型生效） */
  scanOrderEffective: boolean;
  /** 特价菜明细 */
  items: SpecialItem[];
  /** 方案折扣明细 */
  plans: PlanItem[];
  /** 不参与活动的菜品（整单折扣生效，结账时不参与打折） */
  excludeDishes: { id: string; name: string }[];
  /** 永久有效 */
  forever: boolean;
  /** 有效期开始 */
  startDate: string;
  /** 有效期结束 */
  endDate: string;
  /** 活动状态 */
  status: ActivityStatus;
  /** 是否被手动停止（停止后状态固定为「已结束」，与时间推导无关） */
  stopped: boolean;
  /** 活动来源 */
  source: string;
  /** 收银机点餐自动参与 */
  autoJoin: string;
  /** 活动备注 */
  remark: string;
  /** 活动编码 */
  code: string;
  /** 创建人 */
  creator: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后修改人 */
  updater: string;
  /** 最后修改时间 */
  updatedAt: string;
  /** 活动分组 */
  group: string;
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
/** 展示时间格式 */
const fmt = (s: string) => (s ? s.replace(/-/g, '/') : '');

/** 兼容旧版本抵用券数据（迁移为活动） */
const normalizeActivity = (v: Partial<Activity>): Activity => ({
  id: v.id ?? `2000${String(Date.now()).slice(0, 9)}`,
  name: v.name ?? '',
  type: v.type ?? '整单折扣',
  discount: v.discount ?? 0,
  threshold: v.threshold ?? 0,
  reduce: v.reduce ?? 0,
  reduceRules: Array.isArray(v.reduceRules) && v.reduceRules.length > 0
    ? v.reduceRules.map((r) => ({ threshold: Number(r.threshold) || 0, reduce: Number(r.reduce) || 0 }))
    : (v.threshold || v.reduce)
      ? [{ threshold: Number(v.threshold) || 0, reduce: Number(v.reduce) || 0 }]
      : [],
  scanOrderEffective: v.scanOrderEffective ?? false,
  items: v.items ?? [],
  plans: v.plans ?? [],
  excludeDishes: v.excludeDishes ?? [],
  forever: v.forever ?? true,
  startDate: v.startDate ?? '',
  endDate: v.endDate ?? '',
  status: v.status ?? '进行中',
  stopped: v.stopped ?? false,
  source: v.source ?? '门店',
  autoJoin: v.autoJoin ?? '不自动参与活动',
  remark: v.remark ?? '',
  code: v.code ?? '',
  creator: v.creator ?? currentOperator(),
  createdAt: v.createdAt ?? now(),
  updater: v.updater ?? currentOperator(),
  updatedAt: v.updatedAt ?? now(),
  group: v.group ?? '',
});

/** 类型判断（兼容旧类型） */
const isDiscountType = (t: string) => t === '整单折扣' || t === '菜品折扣';
const isReduceType = (t: string) => t === '满减' || t === '菜品满减' || t === '整单满减';
const isSpecialType = (t: string) => t === '特价菜';
const isPlanType = (t: string) => t === '方案折扣';

/** 新增/编辑表单 */
interface ActivityForm {
  name: string;
  type: string;
  discount: string;
  threshold: string;
  reduce: string;
  reduceRules: { threshold: string; reduce: string }[];
  scanOrderEffective: boolean;
  items: { dish: string; price: string }[];
  plans: { label: string; discount: string }[];
  excludeDishes: { id: string; name: string }[];
  forever: boolean;
  startDate: string;
  endDate: string;
  autoJoin: string;
  remark: string;
}

const emptyForm = (): ActivityForm => ({
  name: '',
  type: '整单折扣',
  discount: '',
  threshold: '',
  reduce: '',
  reduceRules: [{ threshold: '', reduce: '' }],
  scanOrderEffective: false,
  items: [{ dish: '', price: '' }],
  plans: [{ label: '', discount: '' }],
  excludeDishes: [],
  forever: true,
  startDate: '',
  endDate: '',
  autoJoin: '不自动参与活动',
  remark: '',
});

const formFromActivity = (a: Activity): ActivityForm => ({
  name: a.name,
  type: a.type,
  discount: a.discount > 0 ? String(a.discount) : '',
  threshold: a.threshold > 0 ? String(a.threshold) : '',
  reduce: a.reduce > 0 ? String(a.reduce) : '',
  reduceRules: (a.reduceRules ?? []).length
    ? a.reduceRules.map((r) => ({
        threshold: r.threshold > 0 ? String(r.threshold) : '',
        reduce: r.reduce > 0 ? String(r.reduce) : '',
      }))
    : [{ threshold: a.threshold > 0 ? String(a.threshold) : '', reduce: a.reduce > 0 ? String(a.reduce) : '' }],
  scanOrderEffective: a.scanOrderEffective,
  items: (a.items ?? []).length
    ? a.items.map((i) => ({ dish: i.dish, price: String(i.price) }))
    : [{ dish: '', price: '' }],
  plans: (a.plans ?? []).length
    ? a.plans.map((p) => ({ label: p.label, discount: String(p.discount) }))
    : [{ label: '', discount: '' }],
  excludeDishes: (a.excludeDishes ?? []).map((x) => ({ ...x })),
  forever: a.forever,
  startDate: a.startDate,
  endDate: a.endDate,
  autoJoin: a.autoJoin,
  remark: a.remark,
});

/** 按活动时间推导活动状态（永久有效 = 进行中） */
const deriveStatus = (
  forever: boolean,
  startDate: string,
  endDate: string,
  stopped = false,
): ActivityStatus => {
  if (stopped) return '已结束';
  if (forever) return '进行中';
  const today = dayjs().format('YYYY-MM-DD');
  if (endDate && endDate < today) return '已结束';
  if (startDate && startDate > today) return '未开始';
  return '进行中';
};

/** 规则摘要（表格 / 详情共用） */
const renderRuleSummary = (a: Activity) => {
  if (isDiscountType(a.type)) {
    const exclude = a.excludeDishes ?? [];
    return `全场统一 ${a.discount} 折${exclude.length ? `（${exclude.length} 道菜品不参与）` : ''}`;
  }
  if (isReduceType(a.type)) {
    const rules = a.reduceRules ?? [];
    if (rules.length === 0) {
      return a.threshold || a.reduce ? `满 ${a.threshold} 元减 ${a.reduce} 元` : '-';
    }
    return rules.map((r) => `满 ${r.threshold} 元减 ${r.reduce} 元`).join('、');
  }
  if (isSpecialType(a.type))
    return (a.items ?? []).map((i) => `${i.dish} ${i.price} 元`).join('、') || '-';
  if (isPlanType(a.type))
    return (a.plans ?? []).map((p) => `${p.label} ${p.discount} 折`).join('、') || '-';
  return '-';
};

type AModal =
  | { type: 'add'; copyFrom?: Activity }
  | { type: 'edit'; activity: Activity }
  | null;

/** 详情弹窗 */
type ViewTarget = Activity | null;

export default function DiscountManage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  /** 查询条件 */
  const [q, setQ] = useState({
    name: '',
    type: '',
    status: '',
    id: '',
    code: '',
    autoJoin: '',
    timeStart: '',
    timeEnd: '',
  });
  /** 更多筛选是否展开 */
  const [showMore, setShowMore] = useState(false);

  /** 弹窗 / 确认 */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modal, setModal] = useState<AModal>(null);
  const [view, setView] = useState<ViewTarget>(null);
  const [stop, setStop] = useState<Activity | null>(null);
  const [remove, setRemove] = useState<Activity | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  /** 分页 */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  /** 表单 */
  const [form, setForm] = useState<ActivityForm>(() => emptyForm());
  const patch = (p: Partial<ActivityForm>) => setForm((f) => ({ ...f, ...p }));
  const [errors, setErrors] = useState<{
    name?: string;
    date?: string;
    discount?: string;
    threshold?: string;
    reduce?: string;
    reduceRules?: string;
    items?: string;
    plans?: string;
  }>({});

  /** 店铺菜品（用于整单折扣选择「不参与活动的菜品」） */
  const [allDishes, setAllDishes] = useState<PickableDish[]>([]);
  const [dishPickOpen, setDishPickOpen] = useState(false);

  /** 从云端加载活动列表与菜品（不参与活动菜品选择用） */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getBucket<Activity[]>(BUCKET_KEY);
        if (active && Array.isArray(data)) setActivities(data.map(normalizeActivity));
      } catch {
        /* 忽略加载失败 */
      }
      try {
        const dishes = await listAllDishesApi();
        if (active) {
          setAllDishes(
            dishes.map((d) => ({ id: String(d.id), name: d.name, category: d.category, status: d.status ?? '在售' })),
          );
        }
      } catch {
        /* 忽略加载失败 */
      }
      if (active) setLoading(false);
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

  const runningCount = useMemo(() => activities.filter((a) => a.status === '进行中').length, [activities]);

  const filtered = useMemo(() => {
    const k = q.name.trim();
    const idK = q.id.trim();
    const codeK = q.code.trim();
    return activities.filter((a) => {
      if (k && !a.name.includes(k)) return false;
      if (idK && !a.id.includes(idK)) return false;
      if (codeK && !a.code.includes(codeK)) return false;
      if (q.type && a.type !== q.type) return false;
      if (q.status && a.status !== q.status) return false;
      if (q.autoJoin && a.autoJoin !== q.autoJoin) return false;
      if (q.timeStart || q.timeEnd) {
        if (a.forever) return false;
        const s = a.startDate.replace(/\//g, '-');
        const e = a.endDate.replace(/\//g, '-');
        if (q.timeStart && q.timeStart > e) return false;
        if (q.timeEnd && q.timeEnd < s) return false;
      }
      return true;
    });
  }, [activities, q]);

  /** 分页切片 */
  const pagedActivities = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  /** 页码越界保护 */
  useEffect(() => {
    const max = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (page > max) setPage(max);
  }, [page, pageSize, filtered.length]);

  const persist = async (next: Activity[]) => {
    setActivities(next);
    try {
      await putBucket(BUCKET_KEY, next);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  /** 新增：先选择类型 */
  const openAdd = () => {
    setErrors({});
    setPickerOpen(true);
  };

  const pickType = (t: string) => {
    setPickerOpen(false);
    setForm({ ...emptyForm(), type: t });
    setErrors({});
    setModal({ type: 'add' });
  };

  const openCopy = (a: Activity) => {
    setForm({ ...formFromActivity(a), name: `${a.name}副本` });
    setErrors({});
    setModal({ type: 'add', copyFrom: a });
  };

  const openEdit = (a: Activity) => {
    setForm(formFromActivity(a));
    setErrors({});
    setModal({ type: 'edit', activity: a });
  };

  const clearErr = (key: keyof typeof errors) =>
    setErrors((x) => (x[key] ? { ...x, [key]: undefined } : x));

  /** 提交新增 / 编辑 */
  const submit = async () => {
    if (!modal) return;
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = '请输入活动名称';
    if (!form.forever) {
      if (!form.startDate || !form.endDate) {
        errs.date = '请选择有效期起止日期';
      } else if (form.startDate > form.endDate) {
        errs.date = '开始日期不能晚于结束日期';
      }
    }
    if (isDiscountType(form.type)) {
      const disc = Number(form.discount);
      if (!(disc > 0 && disc <= 10)) errs.discount = '请输入 0.1 - 10 之间的折扣';
    }
    if (isReduceType(form.type)) {
      const filled = form.reduceRules.filter((r) => r.threshold !== '' || r.reduce !== '');
      if (filled.length === 0) {
        errs.reduceRules = '请至少添加一条满减规则';
      } else {
        const nums: { threshold: number; reduce: number; idx: number }[] = [];
        for (let i = 0; i < filled.length; i += 1) {
          const r = filled[i];
          const th = Number(r.threshold);
          const rd = Number(r.reduce);
          if (!(th > 0) || !(rd > 0)) {
            errs.reduceRules = '每行请输入有效的满减金额与立减金额';
            break;
          }
          if (rd >= th) {
            errs.reduceRules = '立减金额需小于满减门槛';
            break;
          }
          nums.push({ threshold: th, reduce: rd, idx: i });
        }
        if (!errs.reduceRules) {
          for (let i = 1; i < nums.length; i += 1) {
            if (nums[i].threshold <= nums[i - 1].threshold) {
              errs.reduceRules = '满减门槛需逐级递增';
              break;
            }
          }
        }
      }
    }
    if (isSpecialType(form.type)) {
      const filled = form.items.filter((i) => i.dish.trim());
      if (filled.length === 0) {
        errs.items = '请至少添加一道特价菜';
      } else if (form.items.some((i) => i.dish.trim() && !(Number(i.price) > 0))) {
        errs.items = '特价金额需大于 0';
      }
    }
    if (isPlanType(form.type)) {
      const filled = form.plans.filter((p) => p.label.trim());
      if (filled.length === 0) {
        errs.plans = '请至少添加一个折扣方案';
      } else if (form.plans.some((p) => p.label.trim() && !(Number(p.discount) > 0 && Number(p.discount) <= 10))) {
        errs.plans = '折扣需在 0.1 - 10 之间';
      }
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const timeStamp = now();
    const reduceRules: ReduceRule[] = isReduceType(form.type)
      ? form.reduceRules
          .filter((r) => r.threshold !== '' || r.reduce !== '')
          .map((r) => ({ threshold: Number(r.threshold), reduce: Number(r.reduce) }))
      : [];
    const base = {
      name: form.name.trim(),
      type: form.type,
      discount: isDiscountType(form.type) ? Number(form.discount) : 0,
      threshold: reduceRules[0]?.threshold ?? 0,
      reduce: reduceRules[0]?.reduce ?? 0,
      reduceRules,
      scanOrderEffective: isReduceType(form.type) ? form.scanOrderEffective : false,
      items: isSpecialType(form.type)
        ? form.items.filter((i) => i.dish.trim()).map((i) => ({ dish: i.dish.trim(), price: Number(i.price) }))
        : [],
      plans: isPlanType(form.type)
        ? form.plans
            .filter((p) => p.label.trim())
            .map((p) => ({ label: p.label.trim(), discount: Number(p.discount) }))
        : [],
      excludeDishes: isDiscountType(form.type) ? form.excludeDishes.map((x) => ({ ...x })) : [],
      forever: form.forever,
      startDate: form.forever ? '' : form.startDate,
      endDate: form.forever ? '' : form.endDate,
      autoJoin: form.autoJoin,
      remark: form.remark.trim(),
      status: deriveStatus(form.forever, form.startDate, form.endDate),
      stopped: false,
    };
    if (modal.type === 'add') {
      await persist([
        {
          ...base,
          id: `2000${String(Date.now()).slice(0, 9)}`,
          source: '门店',
          code: '',
          creator: currentOperator(),
          createdAt: timeStamp,
          updater: currentOperator(),
          updatedAt: timeStamp,
          group: modal.copyFrom?.group ?? '',
        },
        ...activities,
      ]);
      setToast({ type: 'success', text: '新增成功' });
    } else {
      await persist(
        activities.map((a) =>
          a.id === modal.activity.id
            ? { ...a, ...base, updater: currentOperator(), updatedAt: timeStamp }
            : a,
        ),
      );
      setToast({ type: 'success', text: '保存成功' });
    }
    setModal(null);
  };

  /** 手动停止活动 */
  const handleStop = async (a: Activity) => {
    await persist(
      activities.map((x) =>
        x.id === a.id
          ? { ...x, stopped: true, status: '已结束' as ActivityStatus, updater: currentOperator(), updatedAt: now() }
          : x,
      ),
    );
    setStop(null);
    setToast({ type: 'success', text: `「${a.name}」已停止` });
  };

  /** 删除活动 */
  const handleRemove = async (a: Activity) => {
    await persist(activities.filter((x) => x.id !== a.id));
    setRemove(null);
    setToast({ type: 'success', text: `「${a.name}」已删除` });
  };

  const renderStatus = (s: ActivityStatus) => (
    <span className={`checkout-status ${s === '进行中' ? 'on' : s === '未开始' ? 'warn' : 'off'}`}>
      <i className="checkout-status-dot" />
      {s}
    </span>
  );

  const renderTime = (a: Activity) => (a.forever ? '永久有效' : `${a.startDate} ~ ${a.endDate}`);

  const setQp = (key: keyof typeof q, v: string) => setQ((old) => ({ ...old, [key]: v }));

  const reset = () =>
    setQ({ name: '', type: '', status: '', id: '', code: '', autoJoin: '', timeStart: '', timeEnd: '' });

  const TYPE_OPTS = [...ACTIVITY_TYPE_VALUES, ...LEGACY_TYPES].map((t) => ({ value: t, label: t }));
  const STATUS_OPTS = (['进行中', '未开始', '已结束'] as const).map((s) => ({ value: s, label: s }));

  return (
    <div className="page discount-page">
      <div className="page-head">
        <h1 className="page-title">优惠折扣</h1>
        <div className="checkout-stat">
          共 <b>{activities.length}</b> 个活动，<b>{runningCount}</b> 个进行中
        </div>
      </div>

      <div className="checkout-panel">
        <div className="checkout-toolbar">
          <div className="checkout-actions">
            <button className="tm-btn tm-btn-primary" type="button" onClick={openAdd}>
              + 新增活动
            </button>
          </div>
          <SearchForm
            className="checkout-search"
            fields={[
              {
                key: 'status',
                label: '活动状态',
                type: 'select',
                placeholder: '请选择',
                width: 110,
                options: STATUS_OPTS,
              },
              {
                key: 'type',
                label: '活动类型',
                type: 'select',
                placeholder: '请选择',
                width: 130,
                options: TYPE_OPTS,
              },
            ]}
            values={q}
            onChange={(k, v) => setQp(k as keyof typeof q, v)}
            onSearch={() => {}}
            onReset={reset}
            beforeButtons={
              <button
                type="button"
                className="tm-btn tm-btn-default checkout-more-btn"
                onClick={() => setShowMore((s) => !s)}
              >
                {showMore ? '收起筛选' : '更多筛选'}
                <span className={`checkout-more-arrow ${showMore ? 'up' : ''}`}>▾</span>
              </button>
            }
          />
        </div>

        {showMore && (
          <div className="checkout-more-filters">
            <div className="checkout-more-item">
              <span className="checkout-more-label">活动时间</span>
              <DatePicker.RangePicker
                value={
                  q.timeStart && q.timeEnd ? [dayjs(q.timeStart), dayjs(q.timeEnd)] : null
                }
                onChange={(dates) => {
                  setQp('timeStart', dates?.[0]?.format('YYYY-MM-DD') ?? '');
                  setQp('timeEnd', dates?.[1]?.format('YYYY-MM-DD') ?? '');
                }}
                placeholder={['开始日期', '结束日期']}
                style={{ width: 260 }}
              />
            </div>
            <div className="checkout-more-item">
              <span className="checkout-more-label">活动ID</span>
              <input
                type="text"
                placeholder="请输入活动ID"
                maxLength={20}
                value={q.id}
                onChange={(e) => setQp('id', e.target.value)}
              />
            </div>
            <div className="checkout-more-item">
              <span className="checkout-more-label">活动编码</span>
              <input
                type="text"
                placeholder="请输入活动编码"
                maxLength={20}
                value={q.code}
                onChange={(e) => setQp('code', e.target.value)}
              />
            </div>
            <div className="checkout-more-item">
              <span className="checkout-more-label">活动名称</span>
              <input
                type="text"
                placeholder="请输入活动名称"
                maxLength={20}
                value={q.name}
                onChange={(e) => setQp('name', e.target.value)}
              />
            </div>
            <div className="checkout-more-item">
              <span className="checkout-more-label">自动参与</span>
              <Select
                className="checkout-more-select"
                value={q.autoJoin || undefined}
                placeholder="请选择"
                options={AUTO_JOIN_OPTS.map((o) => ({ value: o, label: o }))}
                onChange={(v) => setQp('autoJoin', v ?? '')}
              />
            </div>
          </div>
        )}

        <div className="data-table checkout-table discount-table">
          <div className="area-table-scroll checkout-scroll">
            <table className="checkout-real-table">
              <colgroup>
                <col style={{ width: 56 }} />
                <col style={{ width: 128 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 132 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 136 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 84 }} />
                <col style={{ width: 148 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 148 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 310 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="th-center">序号</th>
                  <th>活动ID</th>
                  <th>活动名称</th>
                  <th>活动类型</th>
                  <th>活动时间</th>
                  <th className="th-center">活动状态</th>
                  <th className="th-center">活动来源</th>
                  <th>收银机点餐自动参与</th>
                  <th>活动备注</th>
                  <th>活动编码</th>
                  <th>创建人</th>
                  <th>创建时间</th>
                  <th>最后修改人</th>
                  <th>最后修改时间</th>
                  <th>活动分组</th>
                  <th className="th-sticky">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td className="checkout-empty-cell" colSpan={16}>
                      {loading ? '加载中…' : '暂无活动，点击右上角「新增活动」创建'}
                    </td>
                  </tr>
                )}
                {pagedActivities.map((a, i) => (
                  <tr key={a.id}>
                    <td className="td-center">{(page - 1) * pageSize + i + 1}</td>
                    <td>{a.id}</td>
                    <td>
                      <div className="checkout-name">{a.name}</div>
                      <div className="rule-summary">{renderRuleSummary(a)}</div>
                    </td>
                    <td>{a.type}</td>
                    <td>{renderTime(a)}</td>
                    <td className="td-center">{renderStatus(a.status)}</td>
                    <td className="td-center">{a.source}</td>
                    <td>{a.autoJoin}</td>
                    <td>{a.remark || '-'}</td>
                    <td>{a.code || '-'}</td>
                    <td>{a.creator}</td>
                    <td>{fmt(a.createdAt)}</td>
                    <td>{a.updater}</td>
                    <td>{fmt(a.updatedAt)}</td>
                    <td>{a.group || '-'}</td>
                    <td className="td-sticky">
                      <div className="row-actions">
                        {a.stopped ? (
                          <span className="action-link disabled">已停止</span>
                        ) : (
                          <button className="action-link danger" onClick={() => setStop(a)}>停止</button>
                        )}
                        <button className="action-link" onClick={() => setView(a)}>查看</button>
                        <button className="action-link" onClick={() => openEdit(a)}>编辑</button>
                        <button className="action-link" onClick={() => openCopy(a)}>复制</button>
                        <button className="action-link danger" onClick={() => setRemove(a)}>删除</button>
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

      {/* ===== 新增：选择活动类型 ===== */}
      {pickerOpen && (
        <div className="modal-mask" onClick={() => setPickerOpen(false)}>
          <div className="modal-card checkout-modal type-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">选择活动类型</div>
              <button className="modal-close" aria-label="关闭" onClick={() => setPickerOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="type-picker-tip">选择优惠类型后进入规则配置，POS 结账时可在优惠栏选用已配置的活动</div>
              <div className="type-picker-grid">
                {ACTIVITY_TYPES.map((t) => (
                  <button key={t.value} className="type-picker-card" type="button" onClick={() => pickType(t.value)}>
                    <span className="type-picker-icon">{t.icon}</span>
                    <span className="type-picker-body">
                      <span className="type-picker-name">{t.value}</span>
                      <span className="type-picker-desc">{t.desc}</span>
                      <span className="type-picker-example">示例：{t.example}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setPickerOpen(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 新增 / 编辑活动（配置弹窗） ===== */}
      {modal && (() => {
        return (
          <div className="modal-mask" onClick={() => setModal(null)}>
            <div className="modal-card checkout-modal checkout-modal-lg" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="modal-title">
                  {modal.type === 'add'
                    ? modal.copyFrom
                      ? '复制活动'
                      : `新增活动（${form.type}）`
                    : `编辑活动（${form.type}）`}
                </div>
                <button className="modal-close" aria-label="关闭" onClick={() => setModal(null)}>
                  ×
                </button>
              </div>
              <div className="modal-body checkout-form checkout-form-lg">
                <div className="checkout-form-section-title">基本信息</div>
                <div className="checkout-form-row">
                  <label>
                    <span className="required-mark">*</span>活动名称：
                  </label>
                  <div className="checkout-form-control">
                    <input
                      type="text"
                      placeholder="请输入活动名称，最多20个字符"
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
                  <label>
                    <span className="required-mark">*</span>活动类型：
                  </label>
                  <div className="checkout-form-control">
                    <div className="checkout-form-tip">{form.type}</div>
                  </div>
                </div>

                {isReduceType(form.type) && (
                  <div className="checkout-form-row">
                    <label>扫码点餐是否生效：</label>
                    <div className="checkout-form-control">
                      <label className="checkout-switch">
                        <input
                          type="checkbox"
                          checked={form.scanOrderEffective}
                          onChange={(e) => patch({ scanOrderEffective: e.target.checked })}
                        />
                        <span className="checkout-switch-slider" />
                      </label>
                      <span className="checkout-form-desc" style={{ marginLeft: 12 }}>
                        {form.scanOrderEffective
                          ? '开启后，扫码点餐也将享受该满减'
                          : '关闭时，仅收银台结账可用，扫码点餐不参与'}
                      </span>
                    </div>
                  </div>
                )}

                {isDiscountType(form.type) && (
                  <>
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>折扣：
                      </label>
                      <div className="checkout-form-control">
                        <div className="checkout-fee">
                          <input
                            type="number"
                            min="0.1"
                            max="10"
                            step="0.1"
                            placeholder="如 7.8"
                            value={form.discount}
                            className={errors.discount ? 'input-error' : ''}
                            onChange={(e) => {
                              patch({ discount: e.target.value });
                              if (errors.discount) clearErr('discount');
                            }}
                          />
                          <span className="checkout-fee-suffix">折</span>
                        </div>
                        <div className="checkout-form-desc">如输入 7.8 表示全场按 7.8 折结算</div>
                        {errors.discount && <div className="checkout-form-error">{errors.discount}</div>}
                      </div>
                    </div>
                    <div className="checkout-form-row">
                      <label>不参与活动的菜品：</label>
                      <div className="checkout-form-control">
                        <div>
                          <button
                            className="tm-btn tm-btn-default rule-add-btn"
                            type="button"
                            onClick={() => setDishPickOpen(true)}
                          >
                            + 选择菜品
                          </button>
                          <span className="checkout-form-desc" style={{ marginLeft: 10 }}>
                            选中的菜品在结账时不参与本活动折扣
                          </span>
                        </div>
                        {form.excludeDishes.length > 0 ? (
                          <div className="dish-pick-tags">
                            {form.excludeDishes.map((d) => (
                              <span key={d.id} className="dish-pick-tag">
                                {d.name}
                                <button
                                  type="button"
                                  className="dish-pick-tag-del"
                                  aria-label={`移除${d.name}`}
                                  onClick={() =>
                                    patch({ excludeDishes: form.excludeDishes.filter((x) => x.id !== d.id) })
                                  }
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="checkout-form-desc">未选择时不限制，所有菜品均参与折扣</div>
                        )}
                        {allDishes.length === 0 && (
                          <div className="checkout-form-tip" style={{ marginTop: 8 }}>
                            暂无可选菜品，请先到「菜品库」添加菜品
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {isReduceType(form.type) && (
                  <>
                    <div className="checkout-form-section-title">
                      满减规则
                      <span className="checkout-form-section-desc">例：满 100 减 20</span>
                    </div>
                    <div className="checkout-form-row">
                      <label>
                        <span className="required-mark">*</span>满减规则：
                      </label>
                      <div className="checkout-form-control">
                        <div className="rule-rows">
                          {form.reduceRules.map((r, idx) => (
                            <div className="rule-row" key={idx}>
                              <span className="rule-row-prefix">满</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="rule-row-input rule-row-input-sm"
                                placeholder="输入金额"
                                value={r.threshold}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    reduceRules: f.reduceRules.map((x, i) =>
                                      i === idx ? { ...x, threshold: e.target.value } : x,
                                    ),
                                  }))
                                }
                              />
                              <span className="rule-row-suffix">元</span>
                              <span className="rule-row-prefix">减</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="rule-row-input rule-row-input-sm"
                                placeholder="输入金额"
                                value={r.reduce}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    reduceRules: f.reduceRules.map((x, i) =>
                                      i === idx ? { ...x, reduce: e.target.value } : x,
                                    ),
                                  }))
                                }
                              />
                              <span className="rule-row-suffix">元</span>
                              <button
                                className="rule-row-del"
                                type="button"
                                disabled={form.reduceRules.length === 1}
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    reduceRules: f.reduceRules.filter((_, i) => i !== idx),
                                  }))
                                }
                              >
                                删除
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          className="tm-btn tm-btn-default rule-add-btn"
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              reduceRules: [...f.reduceRules, { threshold: '', reduce: '' }],
                            }))
                          }
                        >
                          + 添加
                        </button>
                        <div className="checkout-form-desc">
                          可设置多档满减（如「满 100 减 20」「满 200 减 50」），按消费金额匹配最高一档
                        </div>
                        {errors.reduceRules && (
                          <div className="checkout-form-error">{errors.reduceRules}</div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {isSpecialType(form.type) && (
                  <div className="checkout-form-row">
                    <label>
                      <span className="required-mark">*</span>特价菜：
                    </label>
                    <div className="checkout-form-control">
                      <div className="rule-rows">
                        {form.items.map((it, idx) => (
                          <div className="rule-row" key={idx}>
                            <input
                              type="text"
                              className="rule-row-input"
                              placeholder="菜品名称，如 精品毛肚"
                              maxLength={30}
                              value={it.dish}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  items: f.items.map((x, i) => (i === idx ? { ...x, dish: e.target.value } : x)),
                                }))
                              }
                            />
                            <span className="rule-row-suffix">特价</span>
                            <input
                              type="number"
                              className="rule-row-input rule-row-input-sm"
                              min="0.01"
                              step="0.01"
                              placeholder="如 39"
                              value={it.price}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  items: f.items.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)),
                                }))
                              }
                            />
                            <span className="rule-row-suffix">元</span>
                            <button
                              className="rule-row-del"
                              type="button"
                              disabled={form.items.length === 1}
                              onClick={() =>
                                setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
                              }
                            >
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        className="tm-btn tm-btn-default rule-add-btn"
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, items: [...f.items, { dish: '', price: '' }] }))}
                      >
                        + 添加菜品
                      </button>
                      <div className="checkout-form-desc">该菜品在活动期间按特价金额结算</div>
                      {errors.items && <div className="checkout-form-error">{errors.items}</div>}
                    </div>
                  </div>
                )}

                {isPlanType(form.type) && (
                  <div className="checkout-form-row">
                    <label>
                      <span className="required-mark">*</span>折扣方案：
                    </label>
                    <div className="checkout-form-control">
                      <div className="rule-rows">
                        {form.plans.map((p, idx) => (
                          <div className="rule-row" key={idx}>
                            <input
                              type="text"
                              className="rule-row-input"
                              placeholder="方案名，如 素菜"
                              maxLength={20}
                              value={p.label}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  plans: f.plans.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                                }))
                              }
                            />
                            <span className="rule-row-suffix">按</span>
                            <input
                              type="number"
                              className="rule-row-input rule-row-input-sm"
                              min="0.1"
                              max="10"
                              step="0.1"
                              placeholder="如 5"
                              value={p.discount}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  plans: f.plans.map((x, i) =>
                                    i === idx ? { ...x, discount: e.target.value } : x,
                                  ),
                                }))
                              }
                            />
                            <span className="rule-row-suffix">折</span>
                            <button
                              className="rule-row-del"
                              type="button"
                              disabled={form.plans.length === 1}
                              onClick={() =>
                                setForm((f) => ({ ...f, plans: f.plans.filter((_, i) => i !== idx) }))
                              }
                            >
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        className="tm-btn tm-btn-default rule-add-btn"
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, plans: [...f.plans, { label: '', discount: '' }] }))}
                      >
                        + 添加方案
                      </button>
                      <div className="checkout-form-desc">如「素菜 5 折、海鲜 8 折」，同一菜品命中多个方案时取最低折扣</div>
                      {errors.plans && <div className="checkout-form-error">{errors.plans}</div>}
                    </div>
                  </div>
                )}

                <div className="checkout-form-section-title">活动时间与参与</div>
                <div className="checkout-form-row">
                  <label>
                    <span className="required-mark">*</span>活动时间：
                  </label>
                  <div className="checkout-form-control">
                    <div className="checkout-form-radios">
                      {(['永久有效', '自定义日期'] as const).map((r) => (
                        <label className="radio-item" key={r}>
                          <input
                            type="radio"
                            name="activity-expire"
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
                  <label>收银机点餐自动参与：</label>
                  <div className="checkout-form-control">
                    <div className="checkout-form-radios">
                      {AUTO_JOIN_OPTS.map((r) => (
                        <label className="radio-item" key={r}>
                          <input
                            type="radio"
                            name="auto-join"
                            checked={form.autoJoin === r}
                            onChange={() => patch({ autoJoin: r })}
                          />
                          <span className="radio-dot" />
                          {r}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="checkout-form-row">
                  <label>活动备注：</label>
                  <div className="checkout-form-control">
                    <input
                      type="text"
                      placeholder="选填"
                      maxLength={200}
                      value={form.remark}
                      onChange={(e) => patch({ remark: e.target.value })}
                    />
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

      {/* ===== 选择不参与菜品（整单折扣） ===== */}
      <DishPickerModal
        open={dishPickOpen}
        dishes={allDishes}
        selectedIds={form.excludeDishes.map((d) => d.id)}
        onClose={() => setDishPickOpen(false)}
        onSubmit={(selected) => {
          patch({ excludeDishes: selected.map((d) => ({ id: d.id, name: d.name })) });
          setDishPickOpen(false);
        }}
      />

      {/* ===== 查看活动详情 ===== */}
      {view && (
        <div className="modal-mask" onClick={() => setView(null)}>
          <div className="modal-card checkout-modal checkout-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">活动详情</div>
              <button className="modal-close" aria-label="关闭" onClick={() => setView(null)}>
                ×
              </button>
            </div>
            <div className="modal-body checkout-form checkout-form-lg">
              <div className="detail-row">
                <span className="detail-label">活动ID</span>
                <span className="detail-value">{view.id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">活动名称</span>
                <span className="detail-value">{view.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">活动类型</span>
                <span className="detail-value">{view.type}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">优惠规则</span>
                <span className="detail-value">{renderRuleSummary(view)}</span>
              </div>
              {isDiscountType(view.type) && (
                <div className="detail-row">
                  <span className="detail-label">不参与活动的菜品</span>
                  <span className="detail-value">
                    {(view.excludeDishes ?? []).length
                      ? view.excludeDishes.map((d) => d.name).join('、')
                      : '无（所有菜品均参与折扣）'}
                  </span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">活动时间</span>
                <span className="detail-value">{renderTime(view)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">活动状态</span>
                <span className="detail-value">{view.status}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">活动来源</span>
                <span className="detail-value">{view.source}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">收银机点餐自动参与</span>
                <span className="detail-value">{view.autoJoin}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">活动备注</span>
                <span className="detail-value">{view.remark || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">活动编码</span>
                <span className="detail-value">{view.code || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">活动分组</span>
                <span className="detail-value">{view.group || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">创建人</span>
                <span className="detail-value">{view.creator}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">创建时间</span>
                <span className="detail-value">{fmt(view.createdAt)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">最后修改人</span>
                <span className="detail-value">{view.updater}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">最后修改时间</span>
                <span className="detail-value">{fmt(view.updatedAt)}</span>
              </div>
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-primary" type="button" onClick={() => setView(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 停止活动确认 */}
      {stop && (
        <ConfirmModal
          open
          title="停止活动"
          message={`确定要停止活动「${stop.name}」吗？停止后门店将不再执行该活动。`}
          confirmText="停止"
          cancelText="取消"
          danger
          onCancel={() => setStop(null)}
          onConfirm={() => handleStop(stop)}
        />
      )}

      {/* 删除活动确认 */}
      {remove && (
        <ConfirmModal
          open
          title="删除活动"
          message={`确定要删除活动「${remove.name}」吗？删除后不可恢复。`}
          confirmText="删除"
          cancelText="取消"
          danger
          onCancel={() => setRemove(null)}
          onConfirm={() => handleRemove(remove)}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
