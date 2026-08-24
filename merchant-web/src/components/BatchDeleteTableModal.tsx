import { useEffect, useState } from 'react';
import Icon from './Icon';
import { allTablesApi, type TableItem } from '../api/tables';

interface BatchDeleteTableModalProps {
  open: boolean;
  /** 区域（左侧树，含桌台数量） */
  areas: { name: string; tableCount: number }[];
  onClose: () => void;
  /** 确认删除回调：被勾选的桌台 id 列表 */
  onConfirm: (ids: number[]) => void;
}

/** 批量删除桌台：搜索 + 区域树 + 桌台表格多选 + 底部已选标签
 *  - 打开时拉取本店全部桌台，按区域树 / 关键字过滤
 *  - 表头复选框全选（含半选态）
 *  - 底部展示「已选择（N）」+ 清空 + 已选桌台标签（可单独关闭）
 */
export default function BatchDeleteTableModal({
  open,
  areas,
  onClose,
  onConfirm,
}: BatchDeleteTableModalProps) {
  const [keyword, setKeyword] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(false);

  /** 打开时重置并加载全部桌台 */
  useEffect(() => {
    if (open) {
      setKeyword('');
      setSelectedArea('all');
      setSelected(new Set());
      setLoading(true);
      allTablesApi()
        .then(setTables)
        .catch(() => setTables([]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const totalCount = areas.reduce((s, a) => s + a.tableCount, 0);
  const treeNodes = [
    { key: 'all', label: '全部', count: totalCount },
    ...areas.map((a) => ({ key: a.name, label: a.name, count: a.tableCount })),
  ];

  /** 按区域树 + 关键字过滤后的桌台 */
  const filtered = tables.filter((t) => {
    if (selectedArea !== 'all' && t.area !== selectedArea) return false;
    if (keyword && !t.name.toLowerCase().includes(keyword.toLowerCase())) return false;
    return true;
  });

  const allChecked = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const someChecked = filtered.some((t) => selected.has(t.id));

  const toggle = (id: number) => {
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
      if (allChecked) {
        filtered.forEach((t) => next.delete(t.id));
      } else {
        filtered.forEach((t) => next.add(t.id));
      }
      return next;
    });
  };

  const clearAll = () => setSelected(new Set());

  const selectedTables = tables.filter((t) => selected.has(t.id));

  const handleConfirm = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    onConfirm(ids);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div
        className="modal-card batch-modal batch-delete-table-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title">选择桌台</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body batch-body">
          <div className="batch-search">
            <Icon name="search" className="batch-search-icon" />
            <input
              type="text"
              placeholder="请输入关键字搜索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="batch-delete-layout">
            {/* 左侧区域树 */}
            <aside className="batch-delete-tree">
              <div className="batch-delete-tree-title">区域</div>
              <div className="batch-delete-tree-list">
                {treeNodes.map((n) => (
                  <button
                    key={n.key}
                    className={`batch-delete-tree-node ${selectedArea === n.key ? 'active' : ''}`}
                    onClick={() => setSelectedArea(n.key)}
                  >
                    <span>{n.label}</span>
                    <span className="batch-delete-tree-count">{n.count}</span>
                  </button>
                ))}
              </div>
            </aside>

            {/* 右侧桌台表格 */}
            <div className="batch-delete-tables">
              <div className="batch-table-head batch-delete-head">
                <div className="batch-cell batch-cell-check">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked && !allChecked;
                    }}
                    onChange={toggleAll}
                    aria-label="全选"
                  />
                </div>
                <div className="batch-cell batch-cell-name">桌台名称</div>
                <div className="batch-cell batch-cell-cap">标准用餐人数</div>
                <div className="batch-cell batch-cell-mnemonic">数字助记码</div>
              </div>

              <div className="batch-list">
                {loading ? (
                  <div className="batch-empty">加载中…</div>
                ) : filtered.length === 0 ? (
                  <div className="batch-empty">无匹配桌台</div>
                ) : (
                  filtered.map((t) => {
                    const checked = selected.has(t.id);
                    return (
                      <div
                        key={t.id}
                        className={`batch-row ${checked ? 'selected' : ''}`}
                        onClick={() => toggle(t.id)}
                      >
                        <div className="batch-cell batch-cell-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(t.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="batch-cell batch-cell-name">{t.name}</div>
                        <div className="batch-cell batch-cell-cap">{t.capacity}</div>
                        <div className="batch-cell batch-cell-mnemonic">
                          {t.mnemonic || '-'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot batch-foot">
          {/* 第一行：已选择 + 清空 */}
          <div className="batch-foot-header">
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

          {/* 第二行：已选标签 */}
          <div className="batch-tags">
            {selectedTables.length === 0 ? (
              <span className="batch-tags-empty">未选择桌台</span>
            ) : (
              selectedTables.map((t) => (
                <span key={t.id} className="batch-tag">
                  {t.name}
                  <button
                    type="button"
                    className="batch-tag-close"
                    aria-label={`移除${t.name}`}
                    onClick={() => toggle(t.id)}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          {/* 第三行：操作按钮 */}
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
