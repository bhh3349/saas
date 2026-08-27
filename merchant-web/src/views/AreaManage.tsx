import { useCallback, useEffect, useRef, useState } from 'react';
import EmptyState from '../components/EmptyState';
import AddAreaModal, { type AreaFormItem } from '../components/AddAreaModal';
import EditAreaModal from '../components/EditAreaModal';
import SortAreaModal, { type SortAreaItem } from '../components/SortAreaModal';
import BatchDeleteAreasModal from '../components/BatchDeleteAreasModal';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import SearchForm from '../components/SearchForm';
import {
  listAreasApi,
  createAreasApi,
  sortAreasApi,
  deleteAreaApi,
  updateAreaApi,
  type AreaItem,
} from '../api/areas';

interface ColDef {
  key: string;
  label: string;
  width: number;
  tip?: string;
  right?: boolean;
  center?: boolean;
}

/** 区域列表列定义（双击表头可直接输入列宽） */
const AREA_COLS: ColDef[] = [
  { key: 'idx', label: '序号', width: 88, center: true },
  { key: 'name', label: '名称', width: 280 },
  { key: 'count', label: '桌台数量', width: 160, tip: '该区域下的桌台数量', center: true },
  { key: 'actions', label: '操作', width: 140, right: true },
];

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function AreaManage() {
  /** 区域 tab 搜索（输入值 + 已提交关键字） */
  const [areaQuery, setAreaQuery] = useState<string>('');
  const [areaKeyword, setAreaKeyword] = useState<string>('');

  /** ---- 真实数据 ---- */
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [areaLoading, setAreaLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaItem | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  /** 应用内确认弹窗（替代 window.confirm，避免原生弹窗被拦截） */
  const [confirmState, setConfirmState] = useState<{ area: AreaItem } | null>(null);

  /** 应用内轻提示（替代 window.alert，避免原生弹窗被拦截） */
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  /** 区域列表列宽 */
  const [areaColWidths, setAreaColWidths] = useState<number[]>(AREA_COLS.map((c) => c.width));
  /** 双击表头编辑列宽 */
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [draftWidth, setDraftWidth] = useState('');

  /** ---- 数据加载 ---- */
  const loadAreas = useCallback(async () => {
    setAreaLoading(true);
    try {
      const res = await listAreasApi();
      setAreas(res);
    } catch (e) {
      console.error('加载区域失败:', e);
    } finally {
      setAreaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  /** ---- 区域操作 ---- */
  const handleAddAreas = async (items: AreaFormItem[]) => {
    try {
      await createAreasApi(items.map((it) => it.name));
      setAddOpen(false);
      await loadAreas();
    } catch (e) {
      showToast('error', errMsg(e));
    }
  };

  const handleSortAreas = async (sorted: SortAreaItem[]) => {
    try {
      await sortAreasApi(sorted.map((s) => ({ id: Number(s.id), sort: s.sort })));
      setSortOpen(false);
      await loadAreas();
    } catch (e) {
      showToast('error', errMsg(e));
    }
  };

  const handleBatchDeleteAreas = async (ids: Array<string | number>) => {
    try {
      await Promise.all(ids.map((id) => deleteAreaApi(Number(id))));
      setBatchDeleteOpen(false);
      await loadAreas();
    } catch (e) {
      showToast('error', errMsg(e));
    }
  };

  const handleDeleteArea = (area: AreaItem) => {
    setConfirmState({ area });
  };

  const confirmDeleteArea = async () => {
    if (!confirmState) return;
    const { area } = confirmState;
    setConfirmState(null);
    try {
      await deleteAreaApi(area.id);
      await loadAreas();
    } catch (e) {
      showToast('error', errMsg(e));
    }
  };

  const handleEditArea = (area: AreaItem) => {
    setEditingArea(area);
    setEditOpen(true);
  };

  const handleRenameArea = async (name: string) => {
    if (!editingArea) return;
    try {
      await updateAreaApi(editingArea.id, name);
      setEditOpen(false);
      setEditingArea(null);
      await loadAreas();
    } catch (e) {
      showToast('error', errMsg(e));
    }
  };

  /** 双击列头 → 输入宽度（px）→ 回车固定 */
  const startEditCol = (i: number) => {
    setEditingColIdx(i);
    setDraftWidth(String(areaColWidths[i]));
  };

  const commitColWidth = () => {
    if (editingColIdx === null) return;
    const n = parseInt(draftWidth, 10);
    if (!Number.isNaN(n)) {
      const w = Math.min(Math.max(50, n), 600);
      setAreaColWidths((prev) => {
        const next = [...prev];
        next[editingColIdx] = w;
        return next;
      });
    }
    setEditingColIdx(null);
  };

  /** 渲染区域表格列头（支持双击输入列宽） */
  const renderColHead = (cols: readonly ColDef[], widths: number[]) => (
    <thead>
      <tr>
        {cols.map((col, i) => {
          const isEditing = editingColIdx === i;
          return (
            <th
              key={col.key}
              className={`${col.right ? 'th-sticky' : ''} ${col.center ? 'th-center' : ''}`}
              style={{ width: widths[i] }}
              title="双击设置列宽"
              onDoubleClick={() => startEditCol(i)}
            >
              {isEditing ? (
                <input
                  autoFocus
                  className="col-width-input"
                  value={draftWidth}
                  inputMode="numeric"
                  onChange={(e) => setDraftWidth(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitColWidth();
                    if (e.key === 'Escape') setEditingColIdx(null);
                  }}
                  onBlur={commitColWidth}
                  onDoubleClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  {col.label}
                  {col.tip && (
                    <span className="th-tip" title={col.tip}>ⓘ</span>
                  )}
                </>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );

  /** ---- 派生数据 ---- */
  const filteredAreas = areas.filter((a) =>
    areaKeyword ? a.name.toLowerCase().includes(areaKeyword.toLowerCase()) : true,
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">区域管理</h1>
      </div>

      <div className="area-panel tm-main-panel">
        {/* 操作按钮行 */}
        <div className="tm-toolbar">
          <button
            className="tm-btn tm-btn-primary"
            onClick={() => setAddOpen(true)}
          >
            新增区域
          </button>
          <button
            className="tm-btn tm-btn-default"
            onClick={() => setSortOpen(true)}
          >
            区域排序
          </button>
          <button
            className="tm-btn tm-btn-default"
            onClick={() => setBatchDeleteOpen(true)}
          >
            批量删除
          </button>
        </div>

        {/* 区域列表 */}
        <section className="panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="panel-body">
            {/* 搜索行 */}
            <SearchForm
              fields={[{ key: 'areaQuery', label: '区域名称：', placeholder: '请输入' }]}
              values={{ areaQuery }}
              onChange={(k, v) => {
                if (k === 'areaQuery') setAreaQuery(v);
              }}
              onSearch={() => setAreaKeyword(areaQuery.trim())}
              onReset={() => {
                setAreaQuery('');
                setAreaKeyword('');
              }}
            />

            <div className="data-table area-table">
              <div className="area-table-scroll">
                <table className="checkout-real-table">
                  <colgroup>
                    {AREA_COLS.map((c, i) => (
                      <col key={c.key} style={{ width: areaColWidths[i] }} />
                    ))}
                  </colgroup>
                  {renderColHead(AREA_COLS, areaColWidths)}
                  <tbody>
                    {areaLoading ? (
                      <tr>
                        <td colSpan={4} style={{ height: 160, textAlign: 'center', padding: 0 }}>
                          <EmptyState title="加载中…" />
                        </td>
                      </tr>
                    ) : filteredAreas.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ height: 160, textAlign: 'center', padding: 0 }}>
                          <EmptyState
                            title="暂无区域"
                            desc="点击右上角「新增区域」创建第一个区域"
                          />
                        </td>
                      </tr>
                    ) : (
                      filteredAreas.map((a, i) => (
                        <tr key={a.id}>
                          <td className="td-center">{i + 1}</td>
                          <td>{a.name}</td>
                          <td className="td-center">{a.tableCount}</td>
                          <td className="td-sticky">
                            <div className="row-actions">
                              <button
                                className="action-link"
                                type="button"
                                onClick={() => handleEditArea(a)}
                              >
                                编辑
                              </button>
                              <button
                                className="action-link danger"
                                type="button"
                                onClick={() => handleDeleteArea(a)}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>

      <AddAreaModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddAreas}
      />

      <EditAreaModal
        open={editOpen}
        initialName={editingArea?.name ?? ''}
        onClose={() => setEditOpen(false)}
        onSubmit={handleRenameArea}
      />

      <SortAreaModal
        open={sortOpen}
        areas={areas}
        onClose={() => setSortOpen(false)}
        onSubmit={handleSortAreas}
      />

      <BatchDeleteAreasModal
        open={batchDeleteOpen}
        areas={areas}
        onClose={() => setBatchDeleteOpen(false)}
        onConfirm={handleBatchDeleteAreas}
      />

      <ConfirmModal
        open={confirmState !== null}
        title="删除区域"
        message={
          confirmState
            ? `确定删除区域「${confirmState.area.name}」吗？删除后不可恢复。`
            : ''
        }
        confirmText="删除"
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmDeleteArea}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
