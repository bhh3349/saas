import { useEffect, useMemo, useState } from 'react';
import CommonSelect from './CommonSelect';
import { listDishesApi, type DishItem as ApiDish } from '../api/dishes';

interface SelectedDish {
  id: string;
  name: string;
  price?: number;
}

interface SelectDishesModalProps {
  open: boolean;
  /** 已选菜品 id 列表（用于回显勾选） */
  initialSelected: string[];
  onClose: () => void;
  /** 用户点击确定回调，返回合并后的选中菜品 */
  onConfirm: (selected: SelectedDish[]) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const ALL_CAT = 'all';

export default function SelectDishesModal({
  open,
  initialSelected,
  onClose,
  onConfirm,
}: SelectDishesModalProps) {
  const [nameKw, setNameKw] = useState('');
  const [status, setStatus] = useState('all');
  const [cat, setCat] = useState(ALL_CAT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);

  useEffect(() => {
    if (open) {
      setNameKw('');
      setStatus('all');
      setCat(ALL_CAT);
      setPage(1);
      setPageSize(10);
      setSelected(new Set(initialSelected));
      setShowSelectedPanel(false);
    }
  }, [open, initialSelected]);

  /** 后端菜品（打开时加载全量，id 统一为字符串以兼容回显） */
  const [allDishes, setAllDishes] = useState<
    { id: string; name: string; price?: number; category: string; status: string; code: string }[]
  >([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setAllDishes([]);
    (async () => {
      try {
        const all: ApiDish[] = [];
        let page = 1;
        const pageSize = 1000;
        let total = Number.POSITIVE_INFINITY;
        while (all.length < total) {
          const res = await listDishesApi({ page, page_size: pageSize });
          all.push(...res.items);
          total = res.total;
          if (res.items.length === 0) break;
          page++;
        }
        if (active) {
          setAllDishes(
            all.map((d) => ({
              id: String(d.id),
              name: d.name,
              price: d.price,
              category: d.category,
              status: d.status,
              code: d.code || '',
            }))
          );
        }
      } catch {
        // 加载失败保持空列表
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  const cats = useMemo(() => {
    const names = Array.from(new Set(allDishes.map((d) => d.category).filter(Boolean))) as string[];
    return [ALL_CAT, ...names];
  }, [allDishes]);

  const filtered = useMemo(() => {
    const kw1 = nameKw.trim().toLowerCase();
    return allDishes.filter((d) => {
      if (cat !== ALL_CAT && d.category !== cat) return false;
      if (status === 'on' && d.status !== '在售') return false;
      if (status === 'off' && d.status === '在售') return false;
      if (kw1 && !d.name.toLowerCase().includes(kw1)) return false;
      return true;
    });
  }, [allDishes, cat, status, nameKw]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = filtered.length > 0 && filtered.every((d) => next.has(d.id));
      if (allSelected) {
        filtered.forEach((d) => next.delete(d.id));
      } else {
        filtered.forEach((d) => next.add(d.id));
      }
      return next;
    });
  };

  const removeSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const clearSelected = () => setSelected(new Set());

  const handleConfirm = () => {
    const items: SelectedDish[] = Array.from(selected)
      .map((id) => allDishes.find((d) => d.id === id))
      .filter(Boolean)
      .map((d) => ({ id: d!.id, name: d!.name, price: d!.price }));
    onConfirm(items);
  };

  const isAllChecked = filtered.length > 0 && filtered.every((d) => selected.has(d.id));
  const isIndeterminate = !isAllChecked && filtered.some((d) => selected.has(d.id));

  const pageNumbers = useMemo(() => {
    const arr: (number | string)[] = [];
    const max = totalPages;
    if (max <= 7) {
      for (let i = 1; i <= max; i++) arr.push(i);
      return arr;
    }
    arr.push(1);
    if (page > 4) arr.push('...');
    const start = Math.max(2, page - 1);
    const end = Math.min(max - 1, page + 1);
    for (let i = start; i <= end; i++) arr.push(i);
    if (page < max - 3) arr.push('...');
    arr.push(max);
    return arr;
  }, [page, totalPages]);

  if (!open) return null;

  return (
    <div className="modal-mask select-dishes-mask" onClick={onClose}>
      <div
        className="modal-card select-dishes-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title">选择商品</div>
          <button className="modal-close" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="select-dishes-warning">
          <span className="select-dishes-warning-icon">!</span>
          添加停售状态下菜，可能会导致套餐无法正常销售。
        </div>

        <div className="select-dishes-filters">
          <div className="select-dishes-filter">
            <span className="select-dishes-filter-label">名称：</span>
            <input
              type="text"
              placeholder="请输入名称或者助记码"
              value={nameKw}
              onChange={(e) => {
                setNameKw(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="select-dishes-filter">
            <span className="select-dishes-filter-label">菜品状态：</span>
            <CommonSelect
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: 'all', label: '全部' },
                { value: 'on', label: '在售' },
                { value: 'off', label: '停售' },
              ]}
              width={120}
              placeholder="请选择"
              ariaLabel="菜品状态"
            />
          </div>
          <div className="select-dishes-filter-actions">
            <button
              className="select-dishes-query"
              type="button"
              onClick={() => setPage(1)}
            >
              查询
            </button>
            <button
              className="tm-btn tm-btn-default select-dishes-reset-btn"
              type="button"
              onClick={() => {
                setNameKw('');
                setStatus('all');
                setCat(ALL_CAT);
                setPage(1);
              }}
            >
              <span aria-hidden>↺</span>重置
            </button>
          </div>
        </div>

        <div className="select-dishes-body">
          <div className="select-dishes-cat-tree">
            <button className="select-dishes-cat-add" type="button">
              + 添加菜品
            </button>
            <ul>
              {cats.map((c) => (
                <li
                  key={c}
                  className={cat === c ? 'active' : ''}
                  onClick={() => {
                    setCat(c);
                    setPage(1);
                  }}
                >
                  <span className="select-dishes-cat-dot" />
                  {c === ALL_CAT ? '全部分类' : c}
                </li>
              ))}
            </ul>
          </div>

          <div className="select-dishes-table-wrap">
            <table className="select-dishes-table">
              <thead>
                <tr>
                  <th className="select-dishes-th-cb">
                    <input
                      type="checkbox"
                      checked={isAllChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = isIndeterminate;
                      }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>序号</th>
                  <th>名称</th>
                  <th>菜品状态</th>
                  <th>数字助记码</th>
                  <th>规格名</th>
                  <th>允许小数份售卖</th>
                  <th>价格</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="select-dishes-empty">
                      暂无匹配的菜品
                    </td>
                  </tr>
                )}
                {pageData.map((d, idx) => (
                  <tr key={d.id}>
                    <td className="select-dishes-td-cb">
                      <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                      />
                    </td>
                    <td>{(page - 1) * pageSize + idx + 1}</td>
                    <td className="select-dishes-td-name">
                      <span title={d.name}>
                        <div className="dishNameBox">
                          <div>
                            <span className="text-hidden-1">{d.name}</span>
                          </div>
                          <div className="dishNameBox_tags" />
                        </div>
                      </span>
                    </td>
                    <td>{d.status || '在售'}</td>
                    <td>{d.code || '-'}</td>
                    <td>标准</td>
                    <td>否</td>
                    <td>￥{(d.price ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="select-dishes-pagination">
          <span className="select-dishes-pag-action" onClick={toggleAll}>
            {isAllChecked ? '取消全选' : '全选所有结果'}
          </span>
          <span className="select-dishes-pag-info">共 {total} 条</span>
          <div className="select-dishes-pag-pages">
            <button
              className="select-dishes-pag-btn"
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            {pageNumbers.map((p, i) =>
              typeof p === 'number' ? (
                <button
                  key={i}
                  type="button"
                  className={`select-dishes-pag-num ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ) : (
                <span key={i} className="select-dishes-pag-ellipsis">
                  …
                </span>
              )
            )}
            <button
              className="select-dishes-pag-btn"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </button>
          </div>
          <div className="select-dishes-pag-size">
            <CommonSelect
              value={String(pageSize)}
              onChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
              options={PAGE_SIZE_OPTIONS.map((n) => ({
                value: String(n),
                label: `${n}条/页`,
              }))}
              width={100}
              ariaLabel="每页条数"
            />
          </div>
        </div>

        {showSelectedPanel && (
          <div className="select-dishes-selected-panel">
            <div className="select-dishes-selected-head">
              <span>已选 {selected.size} 项</span>
              <span className="select-dishes-selected-clear" onClick={clearSelected}>
                清空
              </span>
            </div>
            <div className="select-dishes-selected-list">
              {Array.from(selected).map((id) => {
                const d = allDishes.find((x) => x.id === id);
                if (!d) return null;
                return (
                  <span className="select-dishes-selected-tag" key={id}>
                    {d.name}
                    <button type="button" onClick={() => removeSelected(id)}>
                      ×
                    </button>
                  </span>
                );
              })}
              {selected.size === 0 && (
                <span className="select-dishes-selected-empty">暂无已选菜品</span>
              )}
            </div>
          </div>
        )}

        <div className="select-dishes-foot">
          <button className="select-dishes-foot-add" type="button">
            + 添加菜品
          </button>
          <div className="select-dishes-foot-right">
            <span
              className="select-dishes-foot-view"
              onClick={() => setShowSelectedPanel((v) => !v)}
            >
              查看已选({selected.size})
            </span>
            <button className="tm-btn tm-btn-default" type="button" onClick={onClose}>
              取消
            </button>
            <button
              className="tm-btn select-dishes-confirm"
              type="button"
              onClick={handleConfirm}
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
