import { useCallback, useState } from 'react';
import type { ToastData } from '../Toast';

/** 报表页轻提示 hook：返回 { toast, notify, close } */
export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const notify = useCallback((t: ToastData) => setToast(t), []);
  const close = useCallback(() => setToast(null), []);
  return { toast, notify, close };
}
