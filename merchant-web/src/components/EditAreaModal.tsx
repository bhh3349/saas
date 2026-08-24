import { useEffect, useState } from 'react';

interface EditAreaModalProps {
  open: boolean;
  /** 当前编辑的区域名称 */
  initialName: string;
  onClose: () => void;
  /** 名称校验通过后回调（已 trim） */
  onSubmit: (name: string) => void;
}

/** 编辑区域弹窗：重命名区域 */
export default function EditAreaModal({
  open,
  initialName,
  onClose,
  onSubmit,
}: EditAreaModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(false);
    }
  }, [open, initialName]);

  if (!open) return null;

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card area-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">编辑区域</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="area-form-row">
            <label>
              <span className="required-mark">*</span>区域名称：
            </label>
            <input
              type="text"
              placeholder="请输入，最多支持20个字符"
              maxLength={20}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setError(false);
              }}
              className={error ? 'input-error' : ''}
              autoFocus
            />
          </div>
          {error && <div className="area-form-error">区域名称不能为空</div>}
        </div>

        <div className="modal-foot">
          <button className="tm-btn tm-btn-default" type="button" onClick={onClose}>
            取消
          </button>
          <button className="tm-btn tm-btn-primary" type="button" onClick={handleSubmit}>
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
