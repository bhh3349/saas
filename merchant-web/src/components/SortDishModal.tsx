import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CommonSelect, { type SelectOption } from './CommonSelect';

/** 菜品排序项 */
export interface SortDishItem {
  id: string;
  name: string;
  status: string;
  sort: number;
}

interface SortDishModalProps {
  open: boolean;
  /** 全部菜品（弹窗内按分类/状态筛选） */
  dishes: { id: string; name: string; category: string; status: string }[];
  /** 分类选项（含「全部」），保持与菜品库一致的顺序 */
  categoryOptions?: string[];
  onClose: () => void;
  /** 确定：返回筛选集合的最新排序 */
  onSubmit: (sorted: SortDishItem[]) => void;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: '在售', label: '在售' },
  { value: '停售', label: '停售' },
  { value: '尚未启售', label: '尚未启售' },
];

/** 菜品排序弹窗：分类 + 状态筛选，按行下拉/输入设置当前排序 */
export default function SortDishModal({
  open,
  dishes,
  categoryOptions,
  onClose,
  onSubmit,
}: SortDishModalProps) {
  const [filterCategory, setFilterCategory] = useState('全部');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [items, setItems] = useState<SortDishItem[]>([]);
  const [page, setPage] = useState(1);
  const [sortPageSize, setSortPageSize] = useState('10');

  /** 分类顺序：优先使用传入的分类列表，未传入时按菜品出现顺序去重 */
  const categories = useMemo(() => {
    if (categoryOptions?.length) return categoryOptions;
    return ['全部', ...Array.from(new Set(dishes.map((d) => d.category)))];
  }, [dishes, categoryOptions]);

  /** 打开或筛选变化时重建排序列表（初始序号 = 列表顺序） */
  useEffect(() => {
    if (!open) return;
    setItems(
      dishes
        .filter(
          (d) =>
            (filterCategory === '全部' || d.category === filterCategory) &&
            (statusFilter.length === 0 || statusFilter.includes(d.status)),
        )
        .map((d, i) => ({ id: d.id, name: d.name, status: d.status, sort: i + 1 })),
    );
    setPage(1);
  }, [open, dishes, filterCategory, statusFilter]);

  if (!open) return null;

  const pageSizeNum = Number(sortPageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSizeNum));
  const pageItems = items.slice((page - 1) * pageSizeNum, page * pageSizeNum);

  /** 切换某行序号：把当前持有目标序号的行换到旧序号 */
  const handleSortChange = (idx: number, newSort: number) => {
    setItems((prev) => {
      const globalIdx = (page - 1) * pageSizeNum + idx;
      const oldSort = prev[globalIdx].sort;
      if (newSort === oldSort) return prev;
      const next = [...prev];
      const swapIdx = next.findIndex((it) => it.sort === newSort);
      if (swapIdx >= 0) next[swapIdx] = { ...next[swapIdx], sort: oldSort };
      next[globalIdx] = { ...next[globalIdx], sort: newSort };
      return next;
    });
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card sort-modal dish-sort-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">菜品排序</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* 筛选区 */}
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
              <span className="sort-filter-label">菜品状态</span>
              <StatusMultiSelect value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />
            </div>
          </div>

          {/* 表头 */}
          <div className="sort-table-head">
            <div className="sort-cell sort-cell-name">菜品名称</div>
            <div className="sort-cell" style={{ width: 120, flex: 'none' }}>菜品状态</div>
            <div className="sort-cell" style={{ width: 180, flex: 'none' }}>当前排序</div>
          </div>

          {/* 排序列表（当前页） */}
          <div className="sort-list">
            {pageItems.length === 0 && (
              <div className="sort-empty">暂无符合条件的菜品</div>
            )}
            {pageItems.map((item, i) => (
              <div key={item.id} className="sort-row">
                <div className="sort-cell sort-cell-name" title={item.name}>{item.name}</div>
                <div className="sort-cell" style={{ width: 120, flex: 'none' }}>
                  <span className={`status-tag ${item.status === '在售' ? 'status-on' : 'status-off'}`}>
                    {item.status}
                  </span>
                </div>
                <div className="sort-cell" style={{ width: 180, flex: 'none' }}>
                  <SortDropdown
                    value={item.sort}
                    options={Array.from({ length: items.length }, (_, k) => k + 1)}
                    onChange={(n) => handleSortChange(i, n)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-foot sort-foot">
          <div className="sort-pagination">
            <span className="sort-total">共{items.length}条记录</span>
            <button className="sort-page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span className="sort-page-num sort-page-active">{page}</span>
            <button className="sort-page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
            <CommonSelect
              className="sort-page-size"
              value={sortPageSize}
              align="right"
              width="auto"
              containerStyle={{ marginLeft: 'auto' }}
              options={[
                { value: '10', label: '10 条/页' },
                { value: '20', label: '20 条/页' },
                { value: '30', label: '30 条/页' },
                { value: '50', label: '50 条/页' },
              ]}
              onChange={setSortPageSize}
            />
          </div>
          <div className="sort-foot-actions">
            <button className="tm-btn tm-btn-default" type="button" onClick={onClose}>
              取消
            </button>
            <button className="tm-btn tm-btn-primary" type="button" onClick={() => onSubmit(items)}>
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 状态多选下拉（复用 CommonSelect 外观，支持多选） */
function StatusMultiSelect({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: SelectOption[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const shouldFlip = spaceBelow < 200;
    setFlip(shouldFlip);
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(shouldFlip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const display =
    value.length === 0
      ? '全部'
      : options.filter((o) => value.includes(o.value)).map((o) => o.label).join('、');

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <div className="sort-multi-select" ref={ref}>
      <button
        type="button"
        className={`saas-select-selector ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="saas-select-label">{display}</span>
        <span className="saas-select-arrow" aria-hidden>
          <svg viewBox="0 0 256 256" width="10" height="10" fill="currentColor">
            <path d="M35.14 92.89a10.67 10.67 0 0113.6-16.32l1.5 1.21 77.76 77.8 77.78-77.8a10.67 10.67 0 0113.61-1.21l1.5 1.21a10.67 10.67 0 011.21 13.61l-1.21 1.5-85.34 85.33a10.67 10.67 0 01-13.59 1.21l-1.5-1.21-85.32-85.34z" />
          </svg>
        </span>
      </button>

      {open &&
        createPortal(
          <ul
            className={`sort-multi-menu ${flip ? 'flip' : ''}`}
            role="listbox"
            style={menuStyle}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {options.map((opt) => {
              const checked = value.includes(opt.value);
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={checked}
                  className={`sort-multi-option ${checked ? 'selected' : ''}`}
                  onClick={() => toggle(opt.value)}
                >
                  {opt.label}
                  {checked && <span className="sort-multi-check-later" aria-hidden>✅</span>}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}

/* 自定义排序输入（可直接输入数字 + 回车固定，点 ▼ 也可选） */
function SortDropdown({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const flip = spaceBelow < 200;
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [open]);

  const commit = () => {
    const max = options.length;
    const n = parseInt(draft, 10);
    const clamped = Number.isNaN(n) ? value : Math.min(Math.max(1, n), max);
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <div className="sort-dropdown" ref={ref}>
      <div className="sort-input-wrap">
        <input
          className="sort-input"
          value={draft}
          inputMode="numeric"
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onFocus={() => {
            setFocused(true);
            setOpen(false);
          }}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="排序序号"
        />
        <span
          className="sort-input-caret"
          aria-hidden
          onClick={() => setOpen((o) => !o)}
        >
          ▼
        </span>
      </div>
      {open &&
        createPortal(
          <ul
            className="sort-dropdown-menu"
            role="listbox"
            style={menuStyle}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {options.map((n) => (
              <li
                key={n}
                role="option"
                aria-selected={n === value}
                className={`sort-dropdown-option ${n === value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(n);
                  setOpen(false);
                }}
              >
                {n}
                {n === value && <span className="sort-dropdown-check" aria-hidden>✓</span>}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
