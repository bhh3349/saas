import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CommonSelect from './CommonSelect';

/** 区域排序项 */
export interface SortAreaItem {
  id?: string | number;
  name: string;
  sort: number;
}

interface SortAreaModalProps {
  open: boolean;
  /** 当前区域列表（已带初始序号） */
  areas: SortAreaItem[];
  onClose: () => void;
  /** 排序确定后回调：新顺序的完整列表 */
  onSubmit: (sorted: SortAreaItem[]) => void;
}

/** 区域排序弹窗：每行下拉选数字几就排到第几，被换出的位置自动换过去 */
export default function SortAreaModal({ open, areas, onClose, onSubmit }: SortAreaModalProps) {
  const [items, setItems] = useState<SortAreaItem[]>([]);
  /** 分页每页条数（自定义下拉） */
  const [sortPageSize, setSortPageSize] = useState<string>('10');

  /** 打开时同步初始排序 */
  useEffect(() => {
    if (open) {
      setItems(areas.map((a, i) => ({ ...a, sort: a.sort ?? i + 1 })));
    }
  }, [open, areas]);

  if (!open) return null;

  /** 切换某行的序号：把当前持有目标序号的行换到旧序号 */
  const handleSortChange = (idx: number, newSort: number) => {
    setItems((prev) => {
      const oldSort = prev[idx].sort;
      if (newSort === oldSort) return prev;
      const next = [...prev];
      const swapIdx = next.findIndex((it) => it.sort === newSort);
      if (swapIdx >= 0) {
        next[swapIdx] = { ...next[swapIdx], sort: oldSort };
      }
      next[idx] = { ...next[idx], sort: newSort };
      return next;
    });
  };

  const total = items.length;
  const maxSort = total;

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card sort-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">区域排序</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="sort-table-head">
            <div className="sort-cell sort-cell-name">区域名称</div>
            <div className="sort-cell sort-cell-sort">当前排序</div>
          </div>

          <div className="sort-list">
            {items.map((item, i) => (
              <div key={item.id ?? i} className="sort-row">
                <div className="sort-cell sort-cell-name">{item.name}</div>
                <div className="sort-cell sort-cell-sort">
                  <SortDropdown
                    value={item.sort}
                    options={Array.from({ length: maxSort }, (_, k) => k + 1)}
                    onChange={(n) => handleSortChange(i, n)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-foot sort-foot">
          <div className="sort-pagination">
            <span className="sort-total">共{total}条记录</span>
            <button className="sort-page-btn" disabled>‹</button>
            <span className="sort-page-num sort-page-active">1</span>
            <button className="sort-page-btn" disabled>›</button>
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
            <button
              className="tm-btn tm-btn-primary"
              type="button"
              onClick={() => onSubmit(items)}
            >
              确定
            </button>
          </div>
        </div>
      </div>
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

  // 外部值变化或失焦后同步显示值
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  /** 打开时计算 fixed 位置，避免被父容器 overflow 裁切 */
  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const flip = spaceBelow < 200;
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(flip
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, [open]);

  /** 点外部关闭下拉 */
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

  /** 提交：解析数字，限制 1..N，回车/失焦固定 */
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
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          ▼
        </span>
      </div>
      {open &&
        createPortal(
          <ul className="sort-dropdown-menu" role="listbox" style={menuStyle}>
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
                {n === value && (
                  <span className="sort-dropdown-check" aria-hidden>✓</span>
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}