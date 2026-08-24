import { useEffect } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  /** 确认按钮文字，默认「确定」 */
  confirmText?: string;
  /** 取消按钮文字，默认「取消」 */
  cancelText?: string;
  /** 确认按钮为危险样式（红色） */
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 通用确认弹窗：替代 window.confirm，避免浏览器原生弹窗在某些环境被拦截 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = true,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="modal-mask" onClick={onCancel}>
      <div className="modal-card confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="modal-close" aria-label="关闭" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <p className="confirm-modal-message">{message}</p>
        </div>

        <div className="modal-foot">
          <button className="tm-btn tm-btn-default" type="button" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`tm-btn ${danger ? 'tm-btn-danger' : 'tm-btn-primary'}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
