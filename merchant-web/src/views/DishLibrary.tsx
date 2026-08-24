import { useCallback, useEffect, useMemo, useState } from 'react';
import SearchForm from '../components/SearchForm';
import ConfirmModal from '../components/ConfirmModal';
import Toast, { type ToastData } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import CommonSelect from '../components/CommonSelect';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/Pagination';
import SortDishModal, { type SortDishItem } from '../components/SortDishModal';
import Icon from '../components/Icon';
import BatchImportDishModal, { type ImportDishRow } from '../components/BatchImportDishModal';
import { exportAoaToXlsx } from '../utils/excel';
import { getStoredShop } from '../api/http';
import CreateSetMealModal from '../components/CreateSetMealModal';
import { listCategoriesApi } from '../api/categories';
import {
  listDishesApi,
  createDishApi,
  updateDishApi,
  updateDishStatusApi,
  deleteDishApi,
  importDishesApi,
  sortDishesApi,
  type DishItem as ApiDish,
  type DishSpecItem as ApiDishSpec,
  type DishPayload,
} from '../api/dishes';

/** 菜品类型 */
type DishType = '普通菜' | '称重菜';

/** 在售状态 */
type DishStatus = '在售' | '停售';

/** 菜品规格 */
interface DishSpec {
  spec: string;
  price: number;
}

/** 菜品 */
interface Dish {
  id: string;
  name: string;
  category: string;
  type: DishType;
  price: number;
  code: string;
  specCode: string;
  status: DishStatus;
  /** 多规格：存在且长度 > 1 时，表格按规格展开多行、公共列合并；未设置时按单规格展示 */
  specs?: DishSpec[];
}

/** 新增/编辑表单数据 */
interface DishForm {
  id: string | null;
  name: string;
  category: string;
  type: DishType;
  price: number;
  status: DishStatus;
  /** 计价方式 */
  priceMethod: '按份' | '称重';
  /** 菜品单位 */
  unit: string;
  /** 默认上菜方式 */
  serveMode: string;
  /** 是否需要打印 */
  printEnable: boolean;
  /** 选择出品档口 */
  printDept: string;
  /** 收银端临时改价 */
  tempPriceChange: boolean;
  /** 收银端手动打折 */
  manualDiscount: boolean;
  /** 菜品起售份数 */
  minAmount: number;
  /** 增量售卖数 */
  deltaAmount: number;
  /** 允许小数份售卖 */
  fractional: boolean;
}

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: '在售', label: '在售' },
  { value: '停售', label: '停售' },
];

/** 批量操作下拉选项 */
const BATCH_OPTIONS = [
  { value: 'batchOn', label: '批量在售' },
  { value: 'batchOff', label: '批量停售' },
  { value: 'batchDelete', label: '批量删除' },
  { value: 'batchImage', label: '批量传图' },
  { value: 'batchPrice', label: '批量改价' },
  { value: 'batchMnemonic', label: '批量设置助记码' },
  { value: 'batchPrint', label: '批量设置打印配置' },
  { value: 'batchDept', label: '批量设置出品部门' },
  { value: 'batchDesc', label: '批量设置菜品描述' },
  { value: 'batchDetail', label: '批量设置菜品详细描述' },
  { value: 'batchBarcode', label: '批量设置条形码' },
  { value: 'batchReplace', label: '批量替换套餐子菜' },
  { value: 'batchAttrs', label: '批量修改多项菜品属性' },
];

/** 菜品单位选项 */
const UNIT_OPTIONS = ['份', '个', '杯', '碗', '斤', '两', '克', '盒', '串', '打'].map((u) => ({ value: u, label: u }));

/** 默认上菜方式选项 */
const SERVE_MODE_OPTIONS = ['即起', '叫起'].map((s) => ({ value: s, label: s }));

/** 出品档口选项 */
const DEPT_OPTIONS = ['后厨', '凉菜间', '热菜间', '甜品间', '水吧'].map((d) => ({ value: d, label: d }));

const emptyForm: DishForm = {
  id: null,
  name: '',
  category: '',
  type: '普通菜',
  price: 0,
  status: '在售',
  priceMethod: '按份',
  unit: '份',
  serveMode: '即起',
  printEnable: false,
  printDept: '',
  tempPriceChange: false,
  manualDiscount: true,
  minAmount: 1,
  deltaAmount: 1,
  fractional: false,
};



/** 后端菜品 → 页面 Dish（多规格售价 = 基础价 + 加价） */
function toLocalDish(item: ApiDish): Dish {
  const specs =
    item.specs && item.specs.length > 1
      ? item.specs.map((s) => ({
          spec: s.name,
          price: Math.round((item.price + s.price_delta) * 100) / 100,
        }))
      : undefined;
  return {
    id: String(item.id),
    name: item.name,
    category: item.category,
    type: item.type === '称重菜' ? '称重菜' : '普通菜',
    price: item.price,
    code: item.code || '',
    specCode: item.spec_code || '',
    status: item.status === '停售' ? '停售' : '在售',
    specs,
  };
}

/** 页面规格 → 后端规格（加价 = 规格售价 - 基础价） */
function toApiSpecs(specs: DishSpec[] | undefined, basePrice: number): ApiDishSpec[] {
  return (specs ?? []).map((s) => ({
    name: s.spec,
    price_delta: Math.round((s.price - basePrice) * 100) / 100,
  }));
}

/** 价格展示：0 视为未设置 */
function formatPrice(n: number): string {
  return n > 0 ? `¥${n.toFixed(2)}` : '-';
}

export default function DishLibrary() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [treeSearch, setTreeSearch] = useState('');
  const [search, setSearch] = useState({ keyword: '', status: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [batchMode, setBatchMode] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [form, setForm] = useState<DishForm>(emptyForm);
  const [delId, setDelId] = useState<string | null>(null);
  const [batchDelOpen, setBatchDelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [setMealOpen, setSetMealOpen] = useState(false);
  const [batchAction, setBatchAction] = useState('');

  const [sortOpen, setSortOpen] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  /** 动态分类：全部 + 数据中出现的分类（保持出现顺序） */
  const categories = useMemo(() => {
    return ['全部', ...Array.from(new Set(dishes.map((d) => d.category).filter(Boolean)))];
  }, [dishes]);

  /** 后端分类（含 0 关联，用于创建菜品弹窗下拉） */
  const [serverCategoryOptions, setServerCategoryOptions] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    listCategoriesApi()
      .then((cats) => {
        if (active) setServerCategoryOptions(cats.map((c) => c.name));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  /** 创建菜品弹窗分类下拉：菜单分类（含 0 关联）∪ 菜品库出现的分类 */
  const dishCategoryOptions = useMemo(() => {
    return Array.from(
      new Set([...serverCategoryOptions, ...dishes.map((d) => d.category).filter(Boolean)])
    );
  }, [dishes, serverCategoryOptions]);

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      if (activeCategory !== '全部' && d.category !== activeCategory) return false;
      if (search.status && d.status !== search.status) return false;
      if (search.keyword && !d.name.includes(search.keyword) && !d.code.includes(search.keyword)) return false;
      return true;
    });
  }, [dishes, activeCategory, search]);

  const pageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  /** 按规格展开为表格行：多规格菜品每个规格一行，公共列用 rowSpan 合并 */
  const tableRows = useMemo(() => {
    return pageData.flatMap((d, idx) => {
      const specs = d.specs && d.specs.length > 0 ? d.specs : [];
      if (specs.length > 1) {
        return specs.map((s, i) => ({
          dish: d,
          seq: idx + 1,
          spec: s.spec,
          price: s.price,
          rowSpan: specs.length,
          isFirst: i === 0,
        }));
      }
      return [{ dish: d, seq: idx + 1, spec: '标准', price: d.price, rowSpan: 1, isFirst: true }];
    });
  }, [pageData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, search]);

  /** 从后端加载本店全部菜品（分页循环拉全量） */
  const reloadDishes = useCallback(async () => {
    setLoading(true);
    try {
      const all: Dish[] = [];
      let page = 1;
      const pageSize = 1000;
      let total = Number.POSITIVE_INFINITY;
      while (all.length < total) {
        const res = await listDishesApi({ page, page_size: pageSize });
        all.push(...res.items.map(toLocalDish));
        total = res.total;
        if (res.items.length === 0) break;
        page++;
      }
      setDishes(all);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '加载菜品失败' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadDishes();
  }, [reloadDishes]);

  const isAllSelected = pageData.length > 0 && pageData.every((d) => selectedIds.includes(d.id));

  const toggleSelectAll = () => {
    const pageIds = pageData.map((d) => d.id);
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSearchChange = (key: string, value: string) => {
    setSearch((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setSearch({ keyword: '', status: '' });
    setActiveCategory('全部');
    setTreeSearch('');
  };

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { 全部: 0 };
    dishes.forEach((d) => {
      map['全部']++;
      if (d.category) map[d.category] = (map[d.category] ?? 0) + 1;
    });
    return map;
  }, [dishes]);

  const visibleCats = useMemo(() => categories.filter((c) => c.includes(treeSearch.trim())), [categories, treeSearch]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (d: Dish) => {
    setEditing(d);
    setForm({ ...emptyForm, ...(d as Partial<DishForm>) });
    setModalOpen(true);
  };

  const updateForm = <K extends keyof DishForm>(key: K, value: DishForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitForm = async () => {
    if (!form.name.trim()) {
      setToast({ type: 'warning', text: '请输入菜品名称' });
      return;
    }
    if (!form.category) {
      setToast({ type: 'warning', text: '请选择菜品分类' });
      return;
    }
    if (form.price < 0) {
      setToast({ type: 'warning', text: '价格不能为负数' });
      return;
    }
    try {
      if (editing) {
        await updateDishApi(Number(editing.id), {
          name: form.name.trim(),
          category: form.category,
          type: form.type,
          price: form.price,
          // 多规格在「添加多个规格」中维护，编辑时保持后端原规格
        });
        setToast({ type: 'success', text: '修改成功' });
      } else {
        const now = Date.now();
        await createDishApi({
          name: form.name.trim(),
          category: form.category,
          type: form.type,
          price: form.price,
          code: `D${now}`,
          spec_code: `S${now}`,
        });
        setToast({ type: 'success', text: '添加成功' });
      }
      setModalOpen(false);
      await reloadDishes();
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  const toggleStatus = async (d: Dish) => {
    const next: DishStatus = d.status === '在售' ? '停售' : '在售';
    try {
      await updateDishStatusApi(Number(d.id), { status: next });
      setDishes((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: next } : x)));
      setToast({ type: 'success', text: `已${next}` });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '操作失败' });
    }
  };

  const handleBatchStatus = async (status: DishStatus) => {
    if (selectedIds.length === 0) {
      setToast({ type: 'warning', text: '请先选择要操作的菜品' });
      return;
    }
    try {
      await Promise.all(selectedIds.map((id) => updateDishStatusApi(Number(id), { status })));
      setDishes((prev) => prev.map((d) => (selectedIds.includes(d.id) ? { ...d, status } : d)));
      setToast({ type: 'success', text: `已批量${status} ${selectedIds.length} 个菜品` });
      setSelectedIds([]);
      setBatchMode(false);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '批量操作失败' });
    }
  };

  const confirmDelete = async () => {
    if (!delId) return;
    try {
      await deleteDishApi(Number(delId));
      setDishes((prev) => prev.filter((d) => d.id !== delId));
      setToast({ type: 'success', text: '删除成功' });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '删除失败' });
    }
    setDelId(null);
  };

  const confirmBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map((id) => deleteDishApi(Number(id))));
      setDishes((prev) => prev.filter((d) => !selectedIds.includes(d.id)));
      setToast({ type: 'success', text: `已删除 ${selectedIds.length} 个菜品` });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '批量删除失败' });
    }
    setSelectedIds([]);
    setBatchDelOpen(false);
    setBatchMode(false);
  };

  /** 导出菜品：与桌台导出格式一致；多规格菜品每个规格一行（名称/分类/类型/编码相同，规格与价格不同） */
  const handleExportDishes = async () => {
    if (dishes.length === 0) {
      setToast({ type: 'info', text: '没有可导出的菜品' });
      return;
    }
    const shopName = getStoredShop() || '店铺';
    const aoa: (string | number)[][] = [
      ['菜品信息表'],
      [`门店：[${shopName}]; 菜品分类：[全部]; 菜品名称：[全部]`],
      ['菜品名称', '菜品分类', '菜品类型', '菜品价格', '菜品编码', '规格编码', '状态', '菜品单位', '菜品规格'],
      ...dishes.flatMap((d) => {
        const specs = d.specs && d.specs.length > 0 ? d.specs : [{ spec: '标准', price: d.price }];
        return specs.map((s) => [d.name, d.category, d.type, s.price, d.code, d.specCode, d.status, '份', s.spec]);
      }),
    ];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    await exportAoaToXlsx(aoa, {
      sheetName: '菜品信息表',
      filename: `${shopName}_菜品信息表_全部_${stamp}.xlsx`,
      merges: [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      ],
      cols: [
        { wch: 18 },
        { wch: 14 },
        { wch: 10 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
      ],
    });
  };

  /** 导入菜品提交：按名称分组，同一名称下规格不同视为多规格合并为一个菜品 */
  const handleImportSubmit = async (rows: ImportDishRow[]) => {
    const groups = new Map<string, ImportDishRow[]>();
    rows.forEach((r) => {
      const arr = groups.get(r.name);
      if (arr) arr.push(r);
      else groups.set(r.name, [r]);
    });

    const now = Date.now();
    let counter = 0;
    const gen = () => {
      const suffix = counter++;
      return { code: `D${now}_${suffix}`, spec_code: `S${now}_${suffix}` };
    };

    const payloads: DishPayload[] = [];
    let skip = 0;
    groups.forEach((group) => {
      const first = group[0];
      if (dishes.some((d) => d.name === first.name)) {
        skip++;
        return;
      }
      const { code, spec_code } = gen();
      const multi = new Set(group.map((r) => r.spec)).size > 1;
      payloads.push({
        name: first.name,
        category: first.category,
        type: first.type as DishType,
        price: first.price,
        code,
        spec_code,
        ...(multi
          ? { specs: toApiSpecs(group.map((r) => ({ spec: r.spec, price: r.price })), first.price) }
          : {}),
      });
    });

    if (payloads.length === 0) {
      setToast({ type: 'error', text: `导入失败：${skip} 个菜品名称与现有菜单重复` });
      return false;
    }
    try {
      await importDishesApi(payloads);
      setToast({
        type: 'success',
        text: `成功导入 ${payloads.length} 个菜品${skip > 0 ? `，跳过 ${skip} 个重名菜品` : ''}`,
      });
      await reloadDishes();
      return true;
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '导入失败' });
      return false;
    }
  };

  /** 批量操作下拉动作 */
  const handleBatchAction = (v: string) => {
    setBatchAction('');
    const needSelect = ['batchOn', 'batchOff', 'batchDelete'].includes(v);
    if (needSelect) {
      if (!batchMode) {
        setBatchMode(true);
        setToast({ type: 'info', text: '已进入批量管理模式，请勾选菜品后再次选择操作' });
        return;
      }
      if (selectedIds.length === 0) {
        setToast({ type: 'warning', text: '请先选择要操作的菜品' });
        return;
      }
      if (v === 'batchOn') return handleBatchStatus('在售');
      if (v === 'batchOff') return handleBatchStatus('停售');
      if (v === 'batchDelete') return setBatchDelOpen(true);
    }
    setToast({ type: 'info', text: `「${BATCH_OPTIONS.find((o) => o.value === v)?.label ?? v}」功能开发中` });
  };

  const exitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds([]);
  };

  /** 菜品排序确定：ids 顺序即排序，提交后端后重新拉取 */
  const handleSortSubmit = async (sorted: SortDishItem[]) => {
    const ids = [...sorted].sort((a, b) => a.sort - b.sort).map((s) => Number(s.id));
    try {
      await sortDishesApi(ids);
      setSortOpen(false);
      await reloadDishes();
      setToast({ type: 'success', text: '排序已保存' });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存排序失败' });
    }
  };

  return (
    <div className="page">
      {/* 页面头 */}
      <div className="page-head">
        <h1 className="page-title">菜品库</h1>
      </div>

      {/* 操作按钮组 */}
      <div className="goods-list-action-bar">
        <button className="tm-btn tm-btn-primary" type="button" onClick={openAdd}>
          创建菜品
        </button>
        <button
          className="tm-btn tm-btn-default"
          type="button"
          style={{ backgroundColor: '#f7ba2a', borderColor: '#f7ba2a', color: '#3d3d3d' }}
          onClick={() => setSetMealOpen(true)}
        >
          创建套餐
        </button>
        <button
          className="tm-btn tm-btn-default"
          type="button"
          onClick={() => setToast({ type: 'info', text: '「手机点餐菜品管理」功能开发中' })}
        >
          手机点餐菜品管理
        </button>
        <button className="tm-btn tm-btn-default" type="button" onClick={() => setSortOpen(true)}>
          菜品排序
        </button>
        <button className="tm-btn tm-btn-default" type="button" onClick={() => setImportOpen(true)}>
          导入菜品
        </button>
        <button className="tm-btn tm-btn-default" type="button" onClick={handleExportDishes}>
          导出菜品
        </button>
        {batchMode && (
          <button className="tm-btn tm-btn-primary" type="button" onClick={exitBatchMode}>
            退出批量管理
          </button>
        )}
        <CommonSelect
          value={batchAction}
          placeholder="批量操作"
          width={104}
          options={BATCH_OPTIONS}
          ariaLabel="批量操作"
          onChange={handleBatchAction}
        />
        <button
          className="tm-btn tm-btn-default"
          type="button"
          onClick={() => setToast({ type: 'info', text: '「菜品打印配置」功能开发中' })}
        >
          菜品打印配置
        </button>
      </div>

      {/* 左侧分类树 + 右侧表格 */}
      <div className="table-panel table-split">
        <aside className="tree-panel">
          <div className="tree-search">
            <Icon name="search" className="tree-search-icon" />
            <input
              type="text"
              placeholder="搜索菜品分类"
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
            />
          </div>
          <div className="tree-list">
            {visibleCats.length === 0 ? (
              <div className="tree-empty">无匹配菜品分类</div>
            ) : (
              visibleCats.map((cat) => (
                <button
                  key={cat}
                  className={`tree-node ${activeCategory === cat ? 'active' : ''}`}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                >
                  <span className="tree-title">
                    {cat}({categoryCounts[cat] ?? 0})
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* 右侧：搜索 + 表格 + 分页 */}
        <section className="panel" style={{ flex: 1, minWidth: 0 }}>
          <div className="panel-body">
            <SearchForm
              fields={[
                {
                  key: 'keyword',
                  label: '菜品名称/编码：',
                  placeholder: '请输入',
                },
                {
                  key: 'status',
                  label: '状态：',
                  type: 'select',
                  placeholder: '全部',
                  options: STATUS_OPTIONS,
                },
              ]}
              values={search}
              onChange={handleSearchChange}
              onSearch={() => setCurrentPage(1)}
              onReset={handleReset}
            />

            <div className="data-table table-list">
              <div className="area-table-scroll checkout-scroll">
                <table className="checkout-real-table">
                  <colgroup>
                    {batchMode && <col style={{ width: 48 }} />}
                    <col style={{ width: 60 }} />
                    <col />
                    <col />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 100 }} />
                    <col />
                    <col />
                    <col style={{ width: 100 }} />
                    <col />
                    <col style={{ width: 130 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {batchMode && (
                        <th className="th-center">
                          <input type="checkbox" className="table-check" checked={isAllSelected} onChange={toggleSelectAll} />
                        </th>
                      )}
                      <th className="th-center">序号</th>
                      <th>菜品名称</th>
                      <th>菜品分类</th>
                      <th>菜品类型</th>
                      <th className="th-center">菜品规格</th>
                      <th className="th-center">菜品价格</th>
                      <th>菜品编码</th>
                      <th>规格编码</th>
                      <th>状态</th>
                      <th className="th-sticky">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.length === 0 ? (
                      <tr>
                        <td colSpan={batchMode ? 11 : 10} style={{ height: 200, textAlign: 'center', padding: 0 }}>
                          <EmptyState
                            title={loading ? '加载中' : '暂无菜品'}
                            desc={loading ? '正在从云端加载菜品数据…' : '点击右上角「导入菜品」导入数据'}
                          />
                        </td>
                      </tr>
                    ) : (
                      tableRows.map((r) => {
                        const d = r.dish;
                        return (
                          <tr key={`${d.id}_${r.spec}`}>
                            {r.isFirst && batchMode && (
                              <td className="td-center" rowSpan={r.rowSpan}>
                                <input
                                  type="checkbox"
                                  className="table-check"
                                  checked={selectedIds.includes(d.id)}
                                  onChange={() => toggleSelect(d.id)}
                                />
                              </td>
                            )}
                            {r.isFirst && (
                              <td className="td-center" rowSpan={r.rowSpan}>
                                {r.seq}
                              </td>
                            )}
                            {r.isFirst && (
                              <td style={{ fontWeight: 500 }} rowSpan={r.rowSpan}>
                                {d.name}
                              </td>
                            )}
                            {r.isFirst && <td rowSpan={r.rowSpan}>{d.category}</td>}
                            {r.isFirst && <td rowSpan={r.rowSpan}>{d.type}</td>}
                            <td className="td-center">{r.spec}</td>
                            <td className="td-center">{formatPrice(r.price)}</td>
                            {r.isFirst && <td rowSpan={r.rowSpan}>{d.code}</td>}
                            {r.isFirst && <td rowSpan={r.rowSpan}>{d.specCode}</td>}
                            {r.isFirst && (
                              <td rowSpan={r.rowSpan}>
                                <span className={`status-tag ${d.status === '在售' ? 'status-on' : 'status-off'}`}>
                                  {d.status}
                                </span>
                              </td>
                            )}
                            {r.isFirst && (
                              <td className="td-sticky" rowSpan={r.rowSpan}>
                                <div className="row-actions">
                                  <button className="action-link" type="button" onClick={() => openEdit(d)}>编辑</button>
                                  <button className="action-link" type="button" onClick={() => toggleStatus(d)}>
                                    {d.status === '在售' ? '停售' : '在售'}
                                  </button>
                                  <button className="action-link danger" type="button" onClick={() => setDelId(d.id)}>删除</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 分页 */}
            <Pagination
              total={filtered.length}
              page={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setCurrentPage(1);
              }}
            />
          </div>
        </section>
      </div>

      {/* 新增 / 编辑弹窗 */}
      {modalOpen && (
        <div className="modal-mask" onClick={() => setModalOpen(false)}>
          <div className="modal-card dish-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{editing ? '编辑菜品' : '创建菜品'}</div>
              <button className="modal-close" aria-label="关闭" type="button" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {/* 基础信息 */}
              <div className="dish-form-group">
                <h3 className="dish-form-group-title">基础信息</h3>
                <div className="dish-form-grid">
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">
                      <span className="required-mark">*</span>菜品名称
                    </label>
                    <div className="dish-form-item-control">
                      <input
                        type="text"
                        placeholder="请输入菜品名称，例如：精品毛肚"
                        maxLength={20}
                        value={form.name}
                        onChange={(e) => updateForm('name', e.target.value)}
                      />
                      <button
                        className="dish-form-link"
                        type="button"
                        onClick={() => setToast({ type: 'info', text: '「复制菜品」功能开发中' })}
                      >
                        复制菜品
                      </button>
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">
                      <span className="required-mark">*</span>所属菜品分类
                    </label>
                    <div className="dish-form-item-control">
                      <CommonSelect
                        width="100%"
                        containerStyle={{ flex: 1 }}
                        value={form.category}
                        placeholder="请选择"
                        options={dishCategoryOptions.map((c) => ({ value: c, label: c }))}
                        ariaLabel="所属菜品分类"
                        onChange={(v) => updateForm('category', v)}
                      />
                      <button
                        className="dish-form-link"
                        type="button"
                        onClick={() => setToast({ type: 'info', text: '「新建分类」功能开发中' })}
                      >
                        新建分类
                      </button>
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">
                      <span className="required-mark">*</span>菜品类型
                    </label>
                    <div className="dish-form-item-control">
                      <div className="area-form-radios">
                        {(['普通菜', '称重菜'] as const).map((t) => (
                          <label key={t} className="radio-item">
                            <input
                              type="radio"
                              name="dishType"
                              checked={form.type === t}
                              onChange={() => {
                                updateForm('type', t);
                                updateForm('priceMethod', t === '称重菜' ? '称重' : '按份');
                              }}
                            />
                            <span className="radio-dot" />
                            <span>{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 菜品规格 */}
              <div className="dish-form-group">
                <h3 className="dish-form-group-title">菜品规格</h3>
                <div className="dish-form-grid">
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">
                      <span className="required-mark">*</span>基础价
                    </label>
                    <div className="dish-form-item-control">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        value={form.price}
                        onChange={(e) => updateForm('price', Number(e.target.value))}
                      />
                      <span className="area-form-suffix">元</span>
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">计价方式</label>
                    <div className="dish-form-item-control">
                      <div className="area-form-radios">
                        {(['按份', '称重'] as const).map((m) => (
                          <label key={m} className="radio-item">
                            <input
                              type="radio"
                              name="priceMethod"
                              checked={form.priceMethod === m}
                              onChange={() => updateForm('priceMethod', m)}
                            />
                            <span className="radio-dot" />
                            <span>{m}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">菜品单位</label>
                    <div className="dish-form-item-control">
                      <CommonSelect
                        width="100%"
                        containerStyle={{ flex: 1 }}
                        value={form.unit}
                        placeholder="请选择"
                        options={UNIT_OPTIONS}
                        ariaLabel="菜品单位"
                        onChange={(v) => updateForm('unit', v)}
                      />
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">默认上菜方式</label>
                    <div className="dish-form-item-control">
                      <CommonSelect
                        width="100%"
                        containerStyle={{ flex: 1 }}
                        value={form.serveMode}
                        placeholder="请选择"
                        options={SERVE_MODE_OPTIONS}
                        ariaLabel="默认上菜方式"
                        onChange={(v) => updateForm('serveMode', v)}
                      />
                    </div>
                  </div>
                </div>
                <button
                  className="dish-form-link"
                  type="button"
                  onClick={() => setToast({ type: 'info', text: '「添加多个规格」功能开发中' })}
                >
                  + 添加多个规格
                </button>
              </div>

              {/* 菜品构成 */}
              <div className="dish-form-group">
                <h3 className="dish-form-group-title">菜品构成</h3>
                <div className="dish-form-item">
                  <label className="dish-form-item-label">做法</label>
                  <div className="dish-form-item-control">
                    <button
                      className="tm-btn tm-btn-primary"
                      type="button"
                      onClick={() => setToast({ type: 'info', text: '「添加做法」功能开发中' })}
                    >
                      添加做法
                    </button>
                    <span className="dish-form-note">还可添加 10 组</span>
                  </div>
                </div>
              </div>

              {/* 打印配置 */}
              <div className="dish-form-group">
                <h3 className="dish-form-group-title">打印配置</h3>
                <div className="dish-form-grid">
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">是否需要打印</label>
                    <div className="dish-form-item-control">
                      <div className="area-form-radios">
                        {['打印', '不打印'].map((p) => (
                          <label key={p} className="radio-item">
                            <input
                              type="radio"
                              name="printEnable"
                              checked={form.printEnable === (p === '打印')}
                              onChange={() => updateForm('printEnable', p === '打印')}
                            />
                            <span className="radio-dot" />
                            <span>{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">
                      <span className="required-mark">*</span>选择出品档口
                    </label>
                    <div className="dish-form-item-control">
                      <CommonSelect
                        width="100%"
                        containerStyle={{ flex: 1 }}
                        value={form.printDept}
                        placeholder="请选择打印方案"
                        options={DEPT_OPTIONS}
                        ariaLabel="选择出品档口"
                        onChange={(v) => updateForm('printDept', v)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 销售信息 */}
              <div className="dish-form-group">
                <h3 className="dish-form-group-title">销售信息</h3>
                <div className="dish-form-grid">
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">售卖状态</label>
                    <div className="dish-form-item-control">
                      <div className="area-form-radios">
                        {(['在售', '停售', '定时启停售'] as const).map((s) => (
                          <label key={s} className="radio-item">
                            <input
                              type="radio"
                              name="saleStatus"
                              checked={form.status === (s === '定时启停售' ? '在售' : s)}
                              onChange={() => {
                                if (s === '定时启停售') {
                                  setToast({ type: 'info', text: '「定时启停售」功能开发中' });
                                } else {
                                  updateForm('status', s);
                                }
                              }}
                            />
                            <span className="radio-dot" />
                            <span>{s}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">收银端临时改价</label>
                    <div className="dish-form-item-control">
                      <div className="area-form-radios">
                        {['允许', '不允许'].map((p) => (
                          <label key={p} className="radio-item">
                            <input
                              type="radio"
                              name="tempPriceChange"
                              checked={form.tempPriceChange === (p === '允许')}
                              onChange={() => updateForm('tempPriceChange', p === '允许')}
                            />
                            <span className="radio-dot" />
                            <span>{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">收银端手动打折</label>
                    <div className="dish-form-item-control">
                      <div className="area-form-radios">
                        {['允许', '不允许'].map((p) => (
                          <label key={p} className="radio-item">
                            <input
                              type="radio"
                              name="manualDiscount"
                              checked={form.manualDiscount === (p === '允许')}
                              onChange={() => updateForm('manualDiscount', p === '允许')}
                            />
                            <span className="radio-dot" />
                            <span>{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">
                      <span className="required-mark">*</span>菜品起售份数
                    </label>
                    <div className="dish-form-item-control">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={form.minAmount}
                        onChange={(e) => updateForm('minAmount', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">增量售卖数</label>
                    <div className="dish-form-item-control">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={form.deltaAmount}
                        onChange={(e) => updateForm('deltaAmount', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="dish-form-item">
                    <label className="dish-form-item-label">允许小数份售卖</label>
                    <div className="dish-form-item-control">
                      <div className="area-form-radios">
                        {['否', '是'].map((p) => (
                          <label key={p} className="radio-item">
                            <input
                              type="radio"
                              name="fractional"
                              checked={form.fractional === (p === '是')}
                              onChange={() => updateForm('fractional', p === '是')}
                            />
                            <span className="radio-dot" />
                            <span>{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>
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

      <ConfirmModal
        open={!!delId}
        title="确认删除"
        message="确定删除该菜品吗？删除后不可恢复。"
        onConfirm={confirmDelete}
        onCancel={() => setDelId(null)}
      />
      <ConfirmModal
        open={batchDelOpen}
        title="确认批量删除"
        message={`确定删除选中的 ${selectedIds.length} 个菜品吗？删除后不可恢复。`}
        onConfirm={confirmBatchDelete}
        onCancel={() => setBatchDelOpen(false)}
      />
      <SortDishModal
        open={sortOpen}
        dishes={dishes}
        categoryOptions={categories}
        onClose={() => setSortOpen(false)}
        onSubmit={handleSortSubmit}
      />
      <BatchImportDishModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSubmit={handleImportSubmit}
      />
      {setMealOpen && <CreateSetMealModal open={setMealOpen} onClose={() => setSetMealOpen(false)} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
