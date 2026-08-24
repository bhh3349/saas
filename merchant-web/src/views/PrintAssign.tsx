import { useEffect, useMemo, useState } from 'react';
import SearchForm from '../components/SearchForm';
import Toast, { type ToastData } from '../components/Toast';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/Pagination';
import { getBucket, putBucket } from '../api/buckets';
import { listAllDishesApi } from '../api/dishes';

/** 打印分配配置桶 key */
const BUCKET_KEY = 'print';

/** 打印分配菜品 */
interface PrintDish {
  id: string;
  name: string;
  category: string;
  code: string;
  station: string;
}

/** 出品档口 */
interface Station {
  id: string;
  name: string;
}

const DEFAULT_STATIONS: Station[] = [
  { id: 's1', name: '荤菜档' },
  { id: 's2', name: '素菜档' },
  { id: 's3', name: '小吃档' },
  { id: 's4', name: '酒水档' },
  { id: 's5', name: '锅底档' },
];

export default function PrintAssign() {
  const [dishes, setDishes] = useState<PrintDish[]>([]);
  const [stations, setStations] = useState<Station[]>(DEFAULT_STATIONS);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [search, setSearch] = useState({ keyword: '', station: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [assignStation, setAssignStation] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);

  const stationOptions = useMemo(
    () => [{ value: '', label: '全部' }, ...stations.map((s) => ({ value: s.name, label: s.name }))],
    [stations],
  );

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      if (activeCategory !== '全部' && d.category !== activeCategory) return false;
      if (search.keyword && !d.name.includes(search.keyword) && !d.code.includes(search.keyword)) return false;
      if (search.station && d.station !== search.station) return false;
      return true;
    });
  }, [dishes, activeCategory, search]);

  const pageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, search]);

  /** 从云端加载：优先取已保存的分配数据，否则从菜品库同步 */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getBucket<{ dishes: PrintDish[]; stations: Station[] }>(BUCKET_KEY);
        if (!active) return;
        if (data && Array.isArray(data.stations) && data.stations.length) setStations(data.stations);
        if (data && Array.isArray(data.dishes) && data.dishes.length) {
          setDishes(data.dishes);
        } else {
          setDishes(
            (await listAllDishesApi()).map((d) => ({
              id: String(d.id),
              name: d.name,
              category: d.category,
              code: d.code ?? '',
              station: '',
            }))
          );
        }
      } catch {
        if (active) setDishes([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /** 保存分配结果到云端 */
  const persistDishes = async (next: PrintDish[]) => {
    setDishes(next);
    try {
      await putBucket(BUCKET_KEY, { dishes: next, stations });
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

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
    setSearch({ keyword: '', station: '' });
    setActiveCategory('全部');
  };

  const handleBatchAssign = () => {
    if (selectedIds.length === 0) {
      setToast({ type: 'warning', text: '请先选择要分配的菜品' });
      return;
    }
    setAssignStation('');
    setModalOpen(true);
  };

  const confirmAssign = async () => {
    if (!assignStation) {
      setToast({ type: 'warning', text: '请选择出品档口' });
      return;
    }
    await persistDishes(
      dishes.map((d) => (selectedIds.includes(d.id) ? { ...d, station: assignStation } : d))
    );
    setToast({ type: 'success', text: `已将 ${selectedIds.length} 个菜品分配至「${assignStation}」` });
    setModalOpen(false);
    setSelectedIds([]);
  };

  const handleSingleAssign = async (id: string, stationName: string) => {
    await persistDishes(dishes.map((d) => (d.id === id ? { ...d, station: stationName } : d)));
    setToast({ type: 'success', text: `已分配至「${stationName}」` });
  };

  /** 动态分类：全部 + 数据中出现的分类（保持出现顺序） */
  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(dishes.map((d) => d.category).filter(Boolean)))],
    [dishes],
  );

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { 全部: 0 };
    dishes.forEach((d) => {
      map['全部']++;
      if (d.category) map[d.category] = (map[d.category] ?? 0) + 1;
    });
    return map;
  }, [dishes]);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">打印分配</h1>
      </div>

      <div className="print-assign-body">
        {/* 左侧分类树 */}
        <div className="category-sidebar">
          <div className="category-tree">
            {categories.map((cat) => (
              <div
                key={cat}
                className={`category-item ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                <span className="category-name">{cat}</span>
                <span className="category-count">{categoryCounts[cat] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="checkout-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 工具栏 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              gap: 12,
            }}
          >
            <button className="saas-btn saas-btn-primary" onClick={handleBatchAssign}>
              分配出品档口
            </button>
            <SearchForm
              fields={[
                {
                  key: 'keyword',
                  label: '菜品名称/助记码',
                  placeholder: '请输入',
                  width: 180,
                },
                {
                  key: 'station',
                  label: '出品档口',
                  type: 'select',
                  placeholder: '全部',
                  options: stationOptions,
                },
              ]}
              values={search}
              onChange={handleSearchChange}
              onSearch={() => setCurrentPage(1)}
              onReset={handleReset}
            />
          </div>

          {/* 表格 */}
          <div className="data-table checkout-table" style={{ flex: 1 }}>
            <div className="area-table-scroll checkout-scroll">
              <table className="checkout-real-table">
                <colgroup>
                  <col style={{ width: 44 }} />
                  <col />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 140 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="th-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>菜品名称</th>
                    <th>菜品分类</th>
                    <th>菜品编码</th>
                    <th>出品档口</th>
                    <th className="th-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.length === 0 ? (
                    <tr>
                      <td className="checkout-empty-cell" colSpan={6}>
                        {loading ? '加载中…' : '暂无数据'}
                      </td>
                    </tr>
                  ) : (
                    pageData.map((d) => (
                      <tr key={d.id}>
                        <td className="td-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(d.id)}
                            onChange={() => toggleSelect(d.id)}
                          />
                        </td>
                        <td>{d.name}</td>
                        <td>{d.category}</td>
                        <td>{d.code}</td>
                        <td>{d.station}</td>
                        <td className="td-center">
                          <div className="link-group">
                            {stations.map((s) => (
                              <a
                                key={s.id}
                                className={`link ${d.station === s.name ? 'link-active' : ''}`}
                                onClick={() => handleSingleAssign(d.id, s.name)}
                              >
                                {s.name}
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
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
      </div>

      {/* 分配档口弹窗 */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content checkout-modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>分配出品档口</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="checkout-form-row">
                <label>已选菜品：</label>
                <span>{selectedIds.length} 个</span>
              </div>
              <div className="checkout-form-row">
                <label>出品档口：</label>
                <div className="checkout-form-control">
                  <select
                    className="ant-input"
                    style={{ width: 200 }}
                    value={assignStation}
                    onChange={(e) => setAssignStation(e.target.value)}
                  >
                    <option value="">请选择</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="saas-btn saas-btn-default" onClick={() => setModalOpen(false)}>
                取消
              </button>
              <button className="saas-btn saas-btn-primary" onClick={confirmAssign}>
                确认分配
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
