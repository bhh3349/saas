import { useEffect, useState } from 'react';

/** 单个区域表单项 */
export interface AreaFormItem {
  name: string;
  scope: 'all' | 'partial';
}

interface AddAreaModalProps {
  open: boolean;
  onClose: () => void;
  /** 表单校验通过后回调（已 trim + 必填校验）；暂未接真实 API */
  onSubmit: (items: AreaFormItem[]) => void;
}

const emptyItem = (): AreaFormItem => ({ name: '', scope: 'all' });

/** 新增区域弹窗：支持一次添加多个区域 */
export default function AddAreaModal({ open, onClose, onSubmit }: AddAreaModalProps) {
  const [items, setItems] = useState<AreaFormItem[]>([emptyItem()]);
  const [errorIndex, setErrorIndex] = useState<number>(-1);

  /** 每次打开重置为 1 个空区域 */
  useEffect(() => {
    if (open) {
      setItems([emptyItem()]);
      setErrorIndex(-1);
    }
  }, [open]);

  if (!open) return null;

  const updateAt = (i: number, patch: Partial<AreaFormItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    if (patch.name !== undefined && patch.name.trim()) setErrorIndex(-1);
  };

  const addOne = () => setItems((prev) => [...prev, emptyItem()]);

  const removeAt = (i: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  };

  const handleSubmit = () => {
    const trimmed = items.map((it) => ({ ...it, name: it.name.trim() }));
    const emptyIdx = trimmed.findIndex((it) => !it.name);
    if (emptyIdx >= 0) {
      setErrorIndex(emptyIdx);
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card area-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">新增区域</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {items.map((item, i) => (
            <div key={i} className="area-form-item">
              <div className="area-form-head">
                <span className="area-form-bar" aria-hidden />
                <span className="area-form-label">区域{i + 1}</span>
                {items.length > 1 && (
                  <button
                    className="area-form-del"
                    type="button"
                    onClick={() => removeAt(i)}
                  >
                    删除
                  </button>
                )}
              </div>

              <div className="area-form-row">
                <label>
                  <span className="required-mark">*</span>区域名称 {i + 1}：
                </label>
                <input
                  type="text"
                  placeholder="请输入，最多支持20个字符"
                  maxLength={20}
                  value={item.name}
                  onChange={(e) => updateAt(i, { name: e.target.value })}
                  className={errorIndex === i ? 'input-error' : ''}
                />
              </div>

              <div className="area-form-row">
                <label>
                  <span className="required-mark">*</span>菜品销售范围：
                </label>
                <div className="area-form-radios">
                  <label className="radio-item">
                    <input
                      type="radio"
                      name={`scope-${i}`}
                      checked={item.scope === 'all'}
                      onChange={() => updateAt(i, { scope: 'all' })}
                    />
                    <span className="radio-dot" />
                    全部菜品
                  </label>
                  <label className="radio-item">
                    <input
                      type="radio"
                      name={`scope-${i}`}
                      checked={item.scope === 'partial'}
                      onChange={() => updateAt(i, { scope: 'partial' })}
                    />
                    <span className="radio-dot" />
                    仅限部分菜品
                  </label>
                </div>
              </div>
            </div>
          ))}

          <button className="area-add-more" type="button" onClick={addOne}>
            + 添加区域名称
          </button>
        </div>

        <div className="modal-foot">
          <button className="tm-btn tm-btn-default" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="tm-btn tm-btn-primary"
            type="button"
            onClick={handleSubmit}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}