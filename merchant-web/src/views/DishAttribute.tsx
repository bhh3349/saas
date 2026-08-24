import { useCallback, useEffect, useState } from 'react';
import SearchForm from '../components/SearchForm';
import ConfirmModal from '../components/ConfirmModal';
import Toast, { type ToastData } from '../components/Toast';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/Pagination';
import {
  listAttributesApi,
  createAttributeApi,
  updateAttributeApi,
  deleteAttributeApi,
} from '../api/attributes';

/** 属性类型 Tab */
type AttrTab = '规格' | '做法' | '单位管理';

/** 菜品属性项 */
interface DishAttr {
  id: string;
  name: string;
  /** 关联菜品数量（仅展示） */
  dishCount: number;
  /** 系统默认项（如「标准」规格），不可删除 */
  preset: boolean;
}

const TAB_LIST: AttrTab[] = ['规格', '做法', '单位管理'];

/** Tab → 后端 kind */
const KIND: Record<AttrTab, 'spec' | 'method' | 'unit'> = {
  规格: 'spec',
  做法: 'method',
  单位管理: 'unit',
};

/** 后端属性 → 页面条目（关联菜品数量由后端后续统计，当前展示 0） */
function toLocalAttr(it: { id: number; name: string; preset: boolean }): DishAttr {
  return { id: String(it.id), name: it.name, dishCount: 0, preset: it.preset };
}

export default function DishAttribute() {
  const [activeTab, setActiveTab] = useState<AttrTab>('规格');
  const [items, setItems] = useState<Record<AttrTab, DishAttr[]>>({ 规格: [], 做法: [], 单位管理: [] });
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DishAttr | null>(null);
  const [formName, setFormName] = useState('');
  const [delId, setDelId] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortList, setSortList] = useState<DishAttr[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);
  /** 分页 */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const list = items[activeTab];
  /** 操作列宽度按按钮数量分配：2 个操作按钮（编辑/删除）× 44 + 1 个间距 × 16 */
  const opColWidth = 2 * 44 + 1 * 16;

  /** 从后端加载指定 Tab 的属性 */
  const reloadTab = useCallback(async (tab: AttrTab) => {
    setLoading(true);
    try {
      const res = await listAttributesApi(KIND[tab]);
      setItems((prev) => ({ ...prev, [tab]: res.map(toLocalAttr) }));
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || `加载${tab}失败` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    TAB_LIST.forEach((t) => reloadTab(t));
  }, [reloadTab]);

  const filtered = list.filter((it) => !keyword || it.name.includes(keyword));

  /** 分页切片 */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageData = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  /** 删除/筛选导致页码越界时回退 */
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const setList = (tab: AttrTab, next: DishAttr[]) => {
    setItems((prev) => ({ ...prev, [tab]: next }));
  };

  const openAdd = () => {
    setEditing(null);
    setFormName('');
    setModalOpen(true);
  };

  const openEdit = (it: DishAttr) => {
    setEditing(it);
    setFormName(it.name);
    setModalOpen(true);
  };

  const submitForm = async () => {
    const name = formName.trim();
    if (!name) {
      setToast({ type: 'warning', text: `请输入${activeTab}名称` });
      return;
    }
    try {
      if (editing) {
        await updateAttributeApi(Number(editing.id), { name });
        setToast({ type: 'success', text: '修改成功' });
      } else {
        await createAttributeApi({ kind: KIND[activeTab], name });
        setToast({ type: 'success', text: '添加成功' });
      }
      setModalOpen(false);
      await reloadTab(activeTab);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  const delTarget = delId ? list.find((it) => it.id === delId) : null;

  const confirmDelete = async () => {
    if (!delId) return;
    try {
      await deleteAttributeApi(Number(delId));
      await reloadTab(activeTab);
      setToast({ type: 'success', text: '删除成功' });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '删除失败' });
    }
    setDelId(null);
  };

  const switchTab = (tab: AttrTab) => {
    setActiveTab(tab);
    setKeyword('');
    setCurrentPage(1);
    reloadTab(tab);
  };

  const openSort = () => {
    setSortList([...list]);
    setSortOpen(true);
  };

  const moveSort = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= sortList.length) return;
    const next = [...sortList];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setSortList(next);
  };

  const saveSort = async () => {
    try {
      await Promise.all(sortList.map((it, i) => updateAttributeApi(Number(it.id), { sort_order: i + 1 })));
      await reloadTab(activeTab);
      setToast({ type: 'success', text: '排序保存成功' });
      setSortOpen(false);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存排序失败' });
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">菜品属性</h1>
      </div>

      <div className="checkout-panel">
        {/* Tab 切换 */}
        <div className="pill-tabs" style={{ marginBottom: 12, padding: 0 }}>
          {TAB_LIST.map((t) => (
            <button
              key={t}
              className={`pill-tab ${activeTab === t ? 'active' : ''}`}
              onClick={() => switchTab(t)}
            >
              {t.endsWith('管理') ? t : `${t}管理`}
            </button>
          ))}
        </div>

        {/* 子页面操作：新建 / 排序 */}
        <div style={{ display: 'flex', gap: 8, margin: '12px 0 16px' }}>
          <button className="saas-btn saas-btn-primary" onClick={openAdd}>
            新建{activeTab}
          </button>
          <button className="saas-btn saas-btn-default" onClick={openSort}>
            排序
          </button>
        </div>

        {/* 查询栏 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <SearchForm
            fields={[{ key: 'name', label: `${activeTab}名称`, placeholder: '请输入', width: 180 }]}
            values={{ name: keyword }}
            onChange={(_, v) => {
              setKeyword(v);
              setCurrentPage(1);
            }}
            onSearch={() => undefined}
            onReset={() => {
              setKeyword('');
              setCurrentPage(1);
            }}
          />
        </div>

        {/* 表格 */}
        <div className="data-table checkout-table">
          <div className="area-table-scroll checkout-scroll">
            <table className="checkout-real-table">
              <colgroup>
                <col style={{ width: 150 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: opColWidth }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="th-center">序号</th>
                  <th>{activeTab}名称</th>
                  <th className="th-center">关联菜品数量</th>
                  <th className="th-center">状态</th>
                  <th className="th-center th-sticky">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td className="checkout-empty-cell" colSpan={5}>
                      {loading ? '加载中…' : '暂无数据'}
                    </td>
                  </tr>
                ) : (
                  pageData.map((it, i) => (
                    <tr key={it.id}>
                      <td className="td-center">{(safePage - 1) * pageSize + i + 1}</td>
                      <td>{it.name}</td>
                      <td className="td-center">{it.dishCount}</td>
                      <td className="td-center">
                        {it.preset ? <span className="status-tag status-on">默认</span> : '-'}
                      </td>
                      <td className="td-center td-sticky">
                        <div className="row-actions">
                          <a className="link" onClick={() => openEdit(it)}>编辑</a>
                          <a className="link" onClick={() => setDelId(it.id)}>
                            删除
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination
          total={filtered.length}
          page={safePage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* 新增/编辑弹窗 */}
      {modalOpen && (
        <div className="modal-mask" onClick={() => setModalOpen(false)}>
          <div className="modal-card category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{editing ? '编辑' : '新建'}{activeTab}</div>
              <button className="modal-close" type="button" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="dish-form-item">
                <label className="dish-form-item-label">
                  <span className="required-mark">*</span>{activeTab}名称
                </label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={`请输入${activeTab}名称`}
                  />
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

      {/* 排序弹窗 */}
      {sortOpen && (
        <div className="modal-mask" onClick={() => setSortOpen(false)}>
          <div className="modal-card category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{activeTab}排序</div>
              <button className="modal-close" type="button" onClick={() => setSortOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="category-sort-tip">点击上移/下移调整{activeTab}顺序，保存后生效。</p>
              <div className="category-sort-list">
                {sortList.map((it, idx) => (
                  <div key={it.id} className="category-sort-item">
                    <span className="category-sort-name">{it.name}</span>
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
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setSortOpen(false)}>
                取消
              </button>
              <button className="tm-btn tm-btn-primary" type="button" onClick={saveSort}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!delId}
        title="确认删除"
        message={
          delTarget && delTarget.dishCount > 0
            ? `「${delTarget.name}」已关联 ${delTarget.dishCount} 个菜品，删除后关联关系将失效。确定删除吗？`
            : '确定删除该属性吗？删除后不可恢复。'
        }
        onConfirm={confirmDelete}
        onCancel={() => setDelId(null)}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
