import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CommonSelectProps {
  /** 当前选中值（空字符串表示未选/占位） */
  value: string;
  /** 选项列表 */
  options: SelectOption[];
  /** 选中回调 */
  onChange: (value: string) => void;
  /** 未选中时显示的占位文字 */
  placeholder?: string;
  /** 按钮宽度（默认 200） */
  width?: number | string;
  /** 下拉菜单对齐：left 靠按钮左 / right 靠按钮右（用于分页条靠右的下拉） */
  align?: 'left' | 'right';
  /** 附加 className */
  className?: string;
  /** 整体占位/容器类名（影响 page-size 靠右布局等） */
  containerStyle?: React.CSSProperties;
  /** aria-label */
  ariaLabel?: string;
}

/**
 * 通用下拉选择器：完全自定义渲染（按钮 + 弹出菜单），
 * 弹出层用 fixed 定位，避免被父容器 overflow 裁切。
 */
export default function CommonSelect({
  value,
  options,
  onChange,
  placeholder,
  width = 200,
  align = 'left',
  className,
  containerStyle,
  ariaLabel,
}: CommonSelectProps) {
  const [open, setOpen] = useState(false);
  /** true 时下拉菜单向上展开（视口下方空间不够时翻转） */
  const [flip, setFlip] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  /** 点外部关闭 */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /**
   * 打开时：
   * 1. 检测视口空间决定是否 flip（向上展开）
   * 2. 用 fixed 定位计算精确坐标，突破所有 overflow 裁切
   */
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const shouldFlip = spaceBelow < 200;
    setFlip(shouldFlip);
    setMenuStyle({
      position: 'fixed',
      left: align === 'right' ? rect.right - rect.width : rect.left,
      minWidth: rect.width,
      width: 'auto',
      ...(shouldFlip
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, [open, align]);

  /** 滚动/resize 时关闭下拉，避免 fixed 定位错位；下拉自身滚动不关闭（如批量操作长列表） */
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (menuRef.current && menuRef.current.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);
  const display = current?.label ?? placeholder;

  const handleSelect = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      className={`saas-select ${className ?? ''}`}
      style={{ width, ...containerStyle }}
    >
      <button
        type="button"
        className={`saas-select-selector ${open ? 'open' : ''} ${current ? '' : 'placeholder'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
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
            ref={menuRef}
            className={`saas-select-dropdown align-${align} ${flip ? 'flip' : ''}`}
            role="listbox"
            style={menuStyle}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {options.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                aria-disabled={opt.disabled || undefined}
                className={`saas-select-option ${opt.disabled ? 'disabled' : ''} ${opt.value === value ? 'selected' : ''}`}
                onClick={() => handleSelect(opt)}
              >
                {opt.label}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}