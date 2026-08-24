import { useEffect, useMemo, useState } from 'react';
import CommonSelect from './CommonSelect';

/** 可选菜品（来自菜品库） */
export interface PickableDish {
  id: string;
  name: string;
  category: string;
  status: string;
}

interface DishPickerModalProps {
  open: boolean;
  /** 全部菜品 */
  dishes: PickableDish[];
  /** 已选菜品 id */
  selectedIds: string[];
  onClose: () => void;
  /** 确定：返回本次选中的菜品完整信息 */
  onSubmit: (selected: PickableDish[]) => void;
}

/** 多选菜品弹窗：分类筛选 + 关键词搜索，支持多选 */
export default function DishPickerModal({
  open,
  dishes,
  selectedIds,
  onClose,
  onSubmit,
}: DishPickerModalProps) {
  const [kw, setKw] = useState('');
  const [filterCategory, setFilterCategory] = useState('全部');
  const [selected, setSelected] = useState<PickableDish[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelected(dishes.filter((d) => selectedIds.includes(d.id)));
    setKw('');
    setFilterCategory('全部');
  }, [open, dishes, selectedIds]);

  const categories = useMemo(() => {
    return ['全部', ...Array.from(new Set(dishes.map((d) => d.category)))];
  }, [dishes]);

  const filtered = useMemo(() => {
    const k = kw.trim();
    return dishes.filter(
      (d) =>
        (filterCategory === '全部' || d.category === filterCategory) &&
        (!k || d.name.includes(k)),
    );
  }, [dishes, filterCategory, kw]);

  if (!open) return null;

  const selectedMap = new Map(selected.map((d) => [d.id, d]));

  const toggle = (d: PickableDish) => {
    setSelected((prev) => {
      const has = prev.some((x) => x.id === d.id);
      return has ? prev.filter((x) => x.id !== d.id) : [...prev, d];
    });
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card sort-modal dish-pick-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">选择菜品</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="sort-filter-bar">
            <div className="sort-filter-item">
              <span className="sort-filter-label">分类</span>
              <CommonSelect
                value={filterCategory}
                width={200}
                options={categories.map((c) => ({ value: c, label: c }))}
                onChange={setFilterCategory}
              />
            </div>
            <div className="sort-filter-item">
              <span className="sort-filter-label">搜索</span>
              <input
                type="text"
                className="dish-pick-search"
                placeholder="输入菜品名称"
                maxLength={30}
                value={kw}
                onChange={(e) => setKw(e.target.value)}
              />
            </div>
          </div>

          <div className="sort-table-head">
            <div className="sort-cell sort-cell-name">菜品名称</div>
            <div className="sort-cell" style={{ width: 140, flex: 'none' }}>菜品分类</div>
            <div className="sort-cell" style={{ width: 110, flex: 'none' }}>菜品状态</div>
          </div>

          <div className="sort-list">
            {filtered.length === 0 && <div className="sort-empty">暂无符合条件的菜品</div>}
            {filtered.map((d) => {
              const checked = selectedMap.has(d.id);
              return (
                <div key={d.id} className="sort-row dish-pick-row" onClick={() => toggle(d)}>
                  <div className="sort-cell sort-cell-name" title={d.name}>
                    <span className={`dish-pick-check ${checked ? 'checked' : ''}`} aria-hidden>
                      {checked && (
                        <svg viewBox="0 0 256 256" width="11" height="11" fill="currentColor">
                          <path d="M104.6 168.9 67.7 132a10.7 10.7 0 0 1 15.1-15.1l21.8 21.7 53.6-53.6a10.7 10.7 0 0 1 15.1 15.1z" />
                        </svg>
                      )}
                    </span>
                    {d.name}
                  </div>
                  <div className="sort-cell" style={{ width: 140, flex: 'none' }}>{d.category}</div>
                  <div className="sort-cell" style={{ width: 110, flex: 'none' }}>
                    <span className={`status-tag ${d.status === '在售' ? 'status-on' : 'status-off'}`}>
                      {d.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-foot sort-foot">
          <div className="sort-pagination">
            <span className="sort-total">已选 {selected.length} 道菜品</span>
          </div>
          <div className="sort-foot-actions">
            <button className="tm-btn tm-btn-default" type="button" onClick={onClose}>
              取消
            </button>
            <button className="tm-btn tm-btn-primary" type="button" onClick={() => onSubmit(selected)}>
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
