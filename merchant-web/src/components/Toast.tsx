export interface ToastData {
  type: 'success' | 'warning' | 'error' | 'info';
  text: string;
}

interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

/** 应用内轻提示：替代 window.alert / window.confirm 的原生弹窗提示，避免被浏览器环境拦截 */
export default function Toast({ toast, onClose }: ToastProps) {
  if (!toast) return null;
  return (
    <div className={`app-toast app-toast-${toast.type}`} role="status">
      <span className="app-toast-icon" aria-hidden="true">
        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'i'}
      </span>
      <span className="app-toast-text">{toast.text}</span>
      <button className="app-toast-close" aria-label="关闭" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
