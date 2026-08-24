import { useCallback, useEffect, useMemo, useState } from 'react';
import SearchForm from '../components/SearchForm';
import ConfirmModal from '../components/ConfirmModal';
import Toast, { type ToastData } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import {
  listCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  deleteCategoryApi,
  type CategoryItem as ApiCategory,
} from '../api/categories';

/** 归属 */
type Belong = '门店' | '品牌';

/** 分类 */
interface DishCategory {
  id: string;
  /** null 表示一级分类 */
  parentId: string | null;
  name: string;
  code: string;
  showOnMobile: boolean;
  belong: Belong;
  dishCount: number;
  sortOrder: number;
}

/** 新增/编辑表单数据 */
interface CategoryForm {
  id: string | null;
  parentId: string | null;
  name: string;
  code: string;
  showOnMobile: boolean;
  belong: Belong;
}

const COLS_KEY = 'merchant.dish.category.columns';

/** 可设置的表格列（序号、分类名称、操作不可设置） */
const ALL_COLUMNS = [
  { key: 'code', label: '分类编码' },
  { key: 'showOnMobile', label: '手机点餐端展示' },
  { key: 'belong', label: '归属' },
  { key: 'dishCount', label: '关联菜品数量' },
] as const;

const emptyForm: CategoryForm = {
  id: null,
  parentId: null,
  name: '',
  code: '',
  showOnMobile: true,
  belong: '门店',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

const generateCode = () => Math.floor(100000000 + Math.random() * 900000000).toString();

/** 后端分类 → 页面分类 */
function toLocalCategory(c: ApiCategory): DishCategory {
  return {
    id: String(c.id),
    parentId: c.parent_id == null ? null : String(c.parent_id),
    name: c.name,
    code: c.code || '',
    showOnMobile: c.show_on_mobile,
    belong: c.belong === '品牌' ? '品牌' : '门店',
    dishCount: c.dish_count,
    sortOrder: c.sort_order,
  };
}

const SettingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default function DishCategory() {
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState({ keyword: '' });
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    const stored = load<string[]>(COLS_KEY, ALL_COLUMNS.map((c) => c.key));
    return new Set(stored.length ? stored : ALL_COLUMNS.map((c) => c.key));
  });
  const [modal, setModal] = useState<'form' | 'sort' | 'batch' | 'columns' | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  /** true=二级分类（创建/编辑时选择所属一级分类） */
  const [isSub, setIsSub] = useState(false);
  const [delTarget, setDelTarget] = useState<DishCategory | null>(null);
  const [batchType, setBatchType] = useState<1 | 2>(1);
  const [batchParentId, setBatchParentId] = useState<string | null>(null);
  const [batchNames, setBatchNames] = useState<string[]>(['']);
  const [sortList, setSortList] = useState<DishCategory[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);

  /** 从后端加载本店全部分类（关联菜品数量由后端统计） */
  const reloadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCategoriesApi();
      setCategories(res.map(toLocalCategory));
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '加载分类失败' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadCategories();
  }, [reloadCategories]);

  const rootCategories = useMemo(
    () => categories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const childMap = useMemo(() => {
    const map = new Map<string, DishCategory[]>();
    categories.forEach((c) => {
      if (c.parentId) {
        const arr = map.get(c.parentId) || [];
        arr.push(c);
        map.set(c.parentId, arr);
      }
    });
    map.forEach((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder));
    return map;
  }, [categories]);

  /** 树形展示行：一级分类下紧跟其二级分类 */
  const displayRows = useMemo(() => {
    const k = search.keyword.trim().toLowerCase();
    const rows: { cat: DishCategory; level: 1 | 2 }[] = [];
    rootCategories.forEach((cat) => {
      const children = childMap.get(cat.id) || [];
      const nameMatch = cat.name.toLowerCase().includes(k) || cat.code.toLowerCase().includes(k);
      if (nameMatch) {
        rows.push({ cat, level: 1 });
        children.forEach((child) => rows.push({ cat: child, level: 2 }));
      } else if (k) {
        const matched = children.filter(
          (child) => child.name.toLowerCase().includes(k) || child.code.toLowerCase().includes(k)
        );
        if (matched.length) {
          rows.push({ cat, level: 1 });
          matched.forEach((child) => rows.push({ cat: child, level: 2 }));
        }
      }
    });
    return rows;
  }, [rootCategories, childMap, search.keyword]);

  const colSpan = 3 + visibleCols.size;

  const updateForm = <K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreate = (sub: boolean) => {
    setIsSub(sub);
    setForm({ ...emptyForm, code: generateCode(), parentId: sub ? rootCategories[0]?.id || null : null });
    setModal('form');
  };

  const openEdit = (cat: DishCategory) => {
    setIsSub(!!cat.parentId);
    setForm({
      id: cat.id,
      parentId: cat.parentId,
      name: cat.name,
      code: cat.code,
      showOnMobile: cat.showOnMobile,
      belong: cat.belong,
    });
    setModal('form');
  };

  /** 校验并保存当前表单，返回是否保存成功 */
  const doSave = async (): Promise<boolean> => {
    if (!form.name.trim()) {
      setToast({ type: 'warning', text: '请输入分类名称' });
      return false;
    }
    if (isSub && !form.parentId) {
      setToast({ type: 'warning', text: '请选择所属一级分类' });
      return false;
    }
    if (form.code && !/^\d+$/.test(form.code.trim())) {
      setToast({ type: 'warning', text: '分类编码只能为数字' });
      return false;
    }
    const code = form.code.trim() || generateCode();
    try {
      if (form.id) {
        await updateCategoryApi(Number(form.id), {
          parent_id: form.parentId ? Number(form.parentId) : null,
          name: form.name.trim(),
          code,
          show_on_mobile: form.showOnMobile,
          belong: form.belong,
        });
        setToast({ type: 'success', text: '修改成功' });
      } else {
        await createCategoryApi({
          parent_id: isSub && form.parentId ? Number(form.parentId) : null,
          name: form.name.trim(),
          code,
          show_on_mobile: form.showOnMobile,
          belong: form.belong,
        });
        setToast({ type: 'success', text: '创建成功' });
      }
      await reloadCategories();
      return true;
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
      return false;
    }
  };

  const submitForm = async () => {
    if (await doSave()) setModal(null);
  };

  /** 保存当前后继续打开一个新的新建窗口 */
  const submitAndNew = async () => {
    if (await doSave()) {
      setForm({ ...emptyForm, code: generateCode(), parentId: isSub ? rootCategories[0]?.id || null : null });
    }
  };

  const promptDelete = (cat: DishCategory) => {
    if (cat.dishCount > 0) {
      setToast({ type: 'warning', text: '该分类下有关联菜品，无法删除' });
      return;
    }
    if (!cat.parentId && (childMap.get(cat.id)?.length || 0) > 0) {
      setToast({ type: 'warning', text: '请先删除该分类下的二级分类' });
      return;
    }
    setDelTarget(cat);
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    try {
      await deleteCategoryApi(Number(delTarget.id));
      setCategories((prev) => prev.filter((c) => c.id !== delTarget.id));
      setToast({ type: 'success', text: '删除成功' });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '删除失败' });
    }
    setDelTarget(null);
  };

  const openSort = () => {
    setSortList(rootCategories.map((c) => ({ ...c })));
    setModal('sort');
  };

  const moveSort = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sortList.length) return;
    const next = [...sortList];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSortList(next);
  };

  const saveSort = async () => {
    try {
      await Promise.all(sortList.map((c, i) => updateCategoryApi(Number(c.id), { sort_order: i + 1 })));
      await reloadCategories();
      setToast({ type: 'success', text: '排序保存成功' });
      setModal(null);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存排序失败' });
    }
  };

  const openBatch = () => {
    setBatchType(1);
    setBatchParentId(null);
    setBatchNames(['']);
    setModal('batch');
  };

  const submitBatch = () => {
    const names = batchNames.map((s) => s.trim()).filter(Boolean);
    if (!names.length) {
      setToast({ type: 'warning', text: '请输入至少一个分类名称' });
      return;
    }
    if (batchType === 2 && !batchParentId) {
      setToast({ type: 'warning', text: '请选择所属一级分类' });
      return;
    }
    if (batchParentId && !rootCategories.some((c) => c.id === batchParentId)) {
      setToast({ type: 'warning', text: '所选一级分类不存在' });
      return;
    }
    const parentId = batchType === 2 ? batchParentId : null;
    try {
      await Promise.all(
        names.map((name) =>
          createCategoryApi({
            parent_id: parentId ? Number(parentId) : null,
            name,
            code: generateCode(),
            show_on_mobile: true,
            belong: '门店',
          })
        )
      );
      await reloadCategories();
      setToast({ type: 'success', text: `成功添加 ${names.length} 个分类` });
      setBatchNames(['']);
      setBatchParentId(null);
      setBatchType(1);
      setModal(null);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '批量添加失败' });
    }
  };

  const toggleCol = (key: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      save(COLS_KEY, Array.from(next));
      return next;
    });
  };

  return (
    <div className="page">
      {/* 页面头 */}
      <div className="page-head">
        <h1 className="page-title">菜品分类</h1>
        <div className="page-head-actions">
          <button className="tm-btn tm-btn-default" type="button" onClick={() => setModal('columns')}>
            <SettingIcon />
            字段设置
          </button>
        </div>
      </div>

      {/* 操作按钮组 */}
      <div className="goods-list-action-bar">
        <button className="tm-btn tm-btn-primary" type="button" onClick={() => openCreate(false)}>
          创建一级分类
        </button>
        <button className="tm-btn tm-btn-primary" type="button" onClick={() => openCreate(true)}>
          创建二级分类
        </button>
        <button className="tm-btn tm-btn-default" type="button" onClick={openSort}>
          分类排序
        </button>
        <button className="tm-btn tm-btn-default" type="button" onClick={openBatch}>
          批量添加分类
        </button>
      </div>

      {/* 搜索 + 表格 */}
      <section className="panel">
        <div className="panel-body">
          <SearchForm
            fields={[
              {
                key: 'keyword',
                label: '分类名称：',
                placeholder: '请输入分类名称',
              },
            ]}
            values={search}
            onChange={(key, value) => setSearch((prev) => ({ ...prev, [key]: value }))}
            onSearch={() => {}}
            onReset={() => setSearch({ keyword: '' })}
          />

          <div className="category-summary">
            一共有{rootCategories.length}个一级分类，{categories.length - rootCategories.length}个二级分类
          </div>

          <div className="data-table table-list">
            <div className="area-table-scroll checkout-scroll">
              <table className="checkout-real-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>序号</th>
                    <th>分类名称</th>
                    {visibleCols.has('code') && <th>分类编码</th>}
                    {visibleCols.has('showOnMobile') && <th>手机点餐端展示</th>}
                    {visibleCols.has('belong') && <th>归属</th>}
                    {visibleCols.has('dishCount') && <th>关联菜品数量</th>}
                    <th className="th-sticky" style={{ width: 120 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} style={{ height: 200, textAlign: 'center', padding: 0 }}>
                        <EmptyState
                          title={loading ? '加载中' : '暂无分类'}
                          desc={loading ? '正在从云端加载分类数据…' : '点击上方「创建一级分类」开始录入'}
                        />
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row, idx) => (
                      <tr key={row.cat.id} className={row.level === 2 ? 'category-level-2' : ''}>
                        <td>{idx + 1}</td>
                        <td className="category-name-cell">{row.cat.name}</td>
                        {visibleCols.has('code') && <td>{row.cat.code}</td>}
                        {visibleCols.has('showOnMobile') && (
                          <td>
                            <span className={`status-tag ${row.cat.showOnMobile ? 'status-on' : 'status-off'}`}>
                              {row.cat.showOnMobile ? '展示' : '不展示'}
                            </span>
                          </td>
                        )}
                        {visibleCols.has('belong') && <td>{row.cat.belong}</td>}
                        {visibleCols.has('dishCount') && <td>{row.cat.dishCount}</td>}
                        <td className="td-sticky">
                          <div className="row-actions">
                            <button className="action-link" type="button" onClick={() => openEdit(row.cat)}>
                              编辑
                            </button>
                            <button className="action-link danger" type="button" onClick={() => promptDelete(row.cat)}>
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
      {modal === 'form' && (
        <div className="modal-mask" onClick={() => setModal(null)}>
          <div className="modal-card category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">
                {form.id ? '编辑分类' : isSub ? '创建二级分类' : '创建一级分类'}
              </div>
              <button className="modal-close" aria-label="关闭" type="button" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {isSub && (
                <div className="dish-form-item">
                  <label className="dish-form-item-label">
                    <span className="required-mark">*</span>所属一级分类
                  </label>
                  <div className="dish-form-item-control">
                    <select
                      className="category-select"
                      value={form.parentId || ''}
                      onChange={(e) => updateForm('parentId', e.target.value || null)}
                    >
                      <option value="">请选择</option>
                      {rootCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="dish-form-item">
                <label className="dish-form-item-label">
                  <span className="required-mark">*</span>分类名称
                </label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    placeholder="请输入分类名称"
                    maxLength={20}
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                  />
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label">分类编码</label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    placeholder="请输入分类编码"
                    maxLength={20}
                    value={form.code}
                    onChange={(e) => updateForm('code', e.target.value)}
                  />
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label">手机点餐端展示</label>
                <div className="dish-form-item-control">
                  <div className="area-form-radios">
                    {['展示', '不展示'].map((p) => (
                      <label key={p} className="radio-item">
                        <input
                          type="radio"
                          name="showOnMobile"
                          checked={form.showOnMobile === (p === '展示')}
                          onChange={() => updateForm('showOnMobile', p === '展示')}
                        />
                        <span className="radio-dot" />
                        <span>{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setModal(null)}>
                取消
              </button>
              {!form.id && (
                <button className="tm-btn tm-btn-default" type="button" onClick={submitAndNew}>
                  保存并新建
                </button>
              )}
              <button className="tm-btn tm-btn-primary" type="button" onClick={submitForm}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 排序弹窗 */}
      {modal === 'sort' && (
        <div className="modal-mask" onClick={() => setModal(null)}>
          <div className="modal-card category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">分类排序</div>
              <button className="modal-close" aria-label="关闭" type="button" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="category-sort-tip">排序仅保存一级分类，二级分类跟随所属一级分类。</p>
              <div className="category-sort-list">
                {sortList.map((c, idx) => (
                  <div key={c.id} className="category-sort-item">
                    <span className="category-sort-name">{c.name}</span>
                    <div className="category-sort-ops">
                      <button
                        className="category-sort-btn"
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSort(idx, -1)}
                      >
                        ↑
                      </button>
                      <button
                        className="category-sort-btn"
                        type="button"
                        disabled={idx === sortList.length - 1}
                        onClick={() => moveSort(idx, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setModal(null)}>
                取消
              </button>
              <button className="tm-btn tm-btn-primary" type="button" onClick={saveSort}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量添加弹窗 */}
      {modal === 'batch' && (
        <div className="modal-mask" onClick={() => setModal(null)}>
          <div className="modal-card category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">批量添加分类</div>
              <button className="modal-close" aria-label="关闭" type="button" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="dish-form-item">
                <label className="dish-form-item-label">
                  <span className="required-mark">*</span>类型
                </label>
                <div className="dish-form-item-control">
                  <div className="area-form-radios">
                    {[
                      { value: 1, label: '一级分类' },
                      { value: 2, label: '二级分类' },
                    ].map((t) => (
                      <label key={t.value} className="radio-item">
                        <input
                          type="radio"
                          name="batchType"
                          checked={batchType === t.value}
                          onChange={() => setBatchType(t.value as 1 | 2)}
                        />
                        <span className="radio-dot" />
                        <span>{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {batchType === 2 && (
                <div className="dish-form-item">
                  <label className="dish-form-item-label">
                    <span className="required-mark">*</span>所属一级分类
                  </label>
                  <div className="dish-form-item-control">
                    <select
                      className="category-select"
                      value={batchParentId || ''}
                      onChange={(e) => setBatchParentId(e.target.value || null)}
                    >
                      <option value="">请选择</option>
                      {rootCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="category-batch-table">
                <div className="category-batch-head">
                  <span>序号</span>
                  <span>分类名称</span>
                  <span>操作</span>
                </div>
                {batchNames.map((name, idx) => (
                  <div className="category-batch-row" key={idx}>
                    <span>{idx + 1}</span>
                    <input
                      type="text"
                      placeholder="请输入分类名称"
                      value={name}
                      onChange={(e) => {
                        const next = [...batchNames];
                        next[idx] = e.target.value;
                        setBatchNames(next);
                      }}
                    />
                    <button
                      className="action-link danger"
                      type="button"
                      onClick={() => {
                        if (batchNames.length <= 1) return;
                        const next = [...batchNames];
                        next.splice(idx, 1);
                        setBatchNames(next);
                      }}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="category-batch-add"
                type="button"
                onClick={() => setBatchNames([...batchNames, ''])}
              >
                <span>+</span>
                添加
              </button>
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setModal(null)}>
                取消
              </button>
              <button className="tm-btn tm-btn-primary" type="button" onClick={submitBatch}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 字段设置弹窗 */}
      {modal === 'columns' && (
        <div className="modal-mask" onClick={() => setModal(null)}>
          <div className="modal-card category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">字段设置</div>
              <button className="modal-close" aria-label="关闭" type="button" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="category-col-list">
                {ALL_COLUMNS.map((c) => (
                  <label key={c.key} className="category-col-item">
                    <input
                      type="checkbox"
                      className="table-check"
                      checked={visibleCols.has(c.key)}
                      onChange={() => toggleCol(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-primary" type="button" onClick={() => setModal(null)}>
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!delTarget}
        title="删除确认"
        message={`确定删除分类「${delTarget?.name || ''}」吗？删除后不可恢复。`}
        confirmText="删除"
        danger={true}
        onCancel={() => setDelTarget(null)}
        onConfirm={confirmDelete}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
