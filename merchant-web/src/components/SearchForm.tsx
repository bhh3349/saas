import type { ReactNode } from 'react';
import CommonSelect from './CommonSelect';

export interface SearchFieldConfig {
  /** 字段唯一标识，同时作为 values 的 key */
  key: string;
  /** 表单 label */
  label: string;
  /** 控件类型：input 文本输入 / select 下拉选择，默认 input */
  type?: 'input' | 'select';
  /** 占位文字，默认「请输入」 */
  placeholder?: string;
  /** 控件宽度，默认 input 220 / select 140 */
  width?: number | string;
  /** type=select 时的选项 */
  options?: { value: string; label: string }[];
}

export interface SearchFormProps {
  /** 字段配置列表 */
  fields: SearchFieldConfig[];
  /** 当前表单值（受控） */
  values: Record<string, string>;
  /** 任一字段值变化时回调 */
  onChange: (key: string, value: string) => void;
  /** 点「查询」回调（不传则按钮无动作） */
  onSearch?: () => void;
  /** 点「重置」回调（不传则不渲染重置按钮） */
  onReset?: () => void;
  /** 渲染在查询/重置按钮之前的附加按钮 */
  beforeButtons?: ReactNode;
  /** 附加到 form 的 className */
  className?: string;
}

const SearchIcon = () => (
  <span role="img" aria-label="search" className="saasicon saasicon-search">
    <svg viewBox="0 0 256 256" focusable="false" data-icon="search" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M117.33 21.33a96 96 0 0175.01 155.93l49.88 49.85a10.67 10.67 0 01-13.61 16.32l-1.5-1.21-49.83-49.88a96 96 0 11-59.95-171zm0 21.34a74.67 74.67 0 100 149.33 74.67 74.67 0 000-149.33z" />
    </svg>
  </span>
);

const RedoIcon = () => (
  <span role="img" aria-label="redo" className="saasicon saasicon-redo">
    <svg viewBox="64 64 896 896" focusable="false" data-icon="redo" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M758.2 839.1C851.8 765.9 912 651.9 912 523.9 912 303 733.5 124.3 512.6 124 291.4 123.7 112 302.8 112 523.9c0 125.2 57.5 236.9 147.6 310.2 3.5 2.8 8.6 2.2 11.4-1.3l39.4-50.5c2.7-3.4 2.1-8.3-1.2-11.1-8.1-6.6-15.9-13.7-23.4-21.2a318.64 318.64 0 01-68.6-101.7C200.4 609 192 567.1 192 523.9s8.4-85.1 25.1-124.5c16.1-38.1 39.2-72.3 68.6-101.7 29.4-29.4 63.6-52.5 101.7-68.6C426.9 212.4 468.8 204 512 204s85.1 8.4 124.5 25.1c38.1 16.1 72.3 39.2 101.7 68.6 29.4 29.4 52.5 63.6 68.6 101.7 16.7 39.4 25.1 81.3 25.1 124.5s-8.4 85.1-25.1 124.5a318.64 318.64 0 01-68.6 101.7c-9.3 9.3-19.1 18-29.3 26L668.2 724a8 8 0 00-14.1 3l-39.6 162.2c-1.2 5 2.6 9.9 7.7 9.9l167 .8c6.7 0 10.5-7.7 6.3-12.9l-37.3-47.9z" />
    </svg>
  </span>
);

/**
 * 通用搜索表单：DOM 对齐标准 saas-form-inline 结构
 * （label 独立列 + control-wrapper + 带图标的查询/重置按钮），
 * 传入字段配置自动生成，后续新页面直接复用。
 */
export default function SearchForm({
  fields,
  values,
  onChange,
  onSearch,
  onReset,
  beforeButtons,
  className = '',
}: SearchFormProps) {
  return (
    <div className="saas-layout-inline-spreader">
      <form
        className={`saas-form saas-form-inline saas-form-middle ${className}`.trim()}
      >
        {fields.map((f, i) => (
          <div className="saas-row saas-form-item" data-index={i} key={f.key}>
            <div className="saas-col saas-form-item-label saas-form-item-label-item-label">
              <label htmlFor={`sf-${f.key}`} title={f.label}>
                {f.label}
              </label>
            </div>
            <div className="saas-col saas-form-item-control-wrapper">
              <div className="saas-form-item-control">
                <span className="saas-form-item-children">
                  {f.type === 'select' ? (
                    <CommonSelect
                      value={values[f.key] ?? ''}
                      placeholder={f.placeholder ?? '请选择'}
                      width={f.width ?? 140}
                      options={f.options ?? []}
                      onChange={(v) => onChange(f.key, v)}
                    />
                  ) : (
                    <input
                      id={`sf-${f.key}`}
                      className="ant-input"
                      type="text"
                      placeholder={f.placeholder ?? '请输入'}
                      value={values[f.key] ?? ''}
                      onChange={(e) => onChange(f.key, e.target.value)}
                    />
                  )}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div className="saas-row saas-form-item fix" data-index={fields.length}>
          <div className="saas-col saas-form-item-control-wrapper">
            <div className="saas-form-item-control">
              <span className="saas-form-item-children">
                {beforeButtons}
                <button type="button" className="saas-btn saas-btn-primary" onClick={onSearch}>
                  <SearchIcon />
                  <span>查询</span>
                </button>
                {onReset && (
                  <button type="button" className="saas-btn saas-btn-default" onClick={onReset}>
                    <RedoIcon />
                    <span>重置</span>
                  </button>
                )}
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
