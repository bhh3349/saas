import { useEffect, useState } from 'react';
import Icon from './Icon';

export interface BatchAreaItem {
  id?: string | number;
  name: string;
  tableCount: number;
}

interface BatchDeleteAreasModalProps {
  open: boolean;
  areas: BatchAreaItem[];
  onClose: () => void;
  /** 确认删除回调：被勾选的区域 id 列表 */
  onConfirm: (ids: Array<string | number>) => void;
}

/** 批量删除桌台区域：搜索 + 复选框 + 已选择计数 + 清空 + 确定
 *  - 区域下有桌台时（tableCount > 0）拦截并提示
 *  - 底部按钮未选时禁用
 */
export default function BatchDeleteAreasModal({
  open,
  areas,
  onClose,
  onConfirm,
}: BatchDeleteAreasModalProps) {
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [blockMsg, setBlockMsg] = useState('');

  /** 打开时清空 */
  useEffect(() => {
    if (open) {
      setKeyword('');
      setSelected(new Set());
      setBlockMsg('');
    }
  }, [open]);

  if (!open) return null;

  const filtered = areas.filter((a) =>
    keyword ? a.name.toLowerCase().includes(keyword.toLowerCase()) : true,
  );

  const allSelected =
    filtered.length > 0 && filtered.every((a) => selected.has(a.id as string | number));

  const toggle = (id: string | number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach((a) => next.delete(a.id as string | number));
      } else {
        filtered.forEach((a) => next.add(a.id as string | number));
      }
      return next;
    });
  };

  const clearAll = () => setSelected(new Set());

  const handleConfirm = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    // 有桌台的区域禁止删除
    const blocked = areas.filter(
      (a) => selected.has(a.id as string | number) && a.tableCount > 0,
    );
    if (blocked.length > 0) {
      setBlockMsg(
        `「${blocked.map((a) => a.name).join('、')}」区域下还有桌台，请先删除桌台后再删除该区域`,
      );
      return;
    }
    setBlockMsg('');
    onConfirm(ids);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card batch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">选择桌台区域</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body batch-body">
          {blockMsg && <div className="batch-error">{blockMsg}</div>}

          <div className="batch-search">
            <Icon name="search" className="batch-search-icon" />
            <input
              type="text"
              placeholder="请输入关键字搜索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="batch-table-head">
            <div className="batch-cell batch-cell-check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="全选"
              />
            </div>
            <div className="batch-cell batch-cell-name">桌台区域名称</div>
            <div className="batch-cell batch-cell-count">桌台数量</div>
          </div>

          <div className="batch-list">
            {filtered.length === 0 ? (
              <div className="batch-empty">无匹配区域</div>
            ) : (
              filtered.map((a) => {
                const id = a.id as string | number;
                const checked = selected.has(id);
                return (
                  <div
                    key={id}
                    className={`batch-row ${checked ? 'selected' : ''}`}
                    onClick={() => toggle(id)}
                  >
                    <div className="batch-cell batch-cell-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="batch-cell batch-cell-name">{a.name}</div>
                    <div className="batch-cell batch-cell-count">{a.tableCount}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-foot batch-foot">
          <div className="batch-foot-left">
            <span className="batch-selected">已选择（{selected.size}）</span>
            <button
              className="batch-clear"
              type="button"
              onClick={clearAll}
              disabled={selected.size === 0}
            >
              清空
            </button>
          </div>
          <div className="batch-foot-actions">
            <button className="tm-btn tm-btn-default" type="button" onClick={onClose}>
              取消
            </button>
            <button
              className="tm-btn tm-btn-primary"
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}