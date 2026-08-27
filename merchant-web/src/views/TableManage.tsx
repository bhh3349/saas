import { useCallback, useEffect, useRef, useState } from 'react';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import AddTableModal, { type TableFormItem } from '../components/AddTableModal';
import BatchAddTableModal from '../components/BatchAddTableModal';
import BatchDeleteTableModal from '../components/BatchDeleteTableModal';
import BatchImportTableModal, {
  type ImportTableItem,
} from '../components/BatchImportTableModal';
import { exportAoaToXlsx } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import CommonSelect from '../components/CommonSelect';
import Pagination from '../components/Pagination';
import SearchForm from '../components/SearchForm';
import type { ViewKey } from '../data/navigation';
import {
  listTablesApi,
  createTableApi,
  updateTableApi,
  deleteTableApi,
  importTablesApi,
  exportTablesApi,
  type TableItem,
  type TablePayload,
} from '../api/tables';
import { getStoredShop } from '../api/http';
import {
  listAreasApi,
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

/** 桌台列表列定义（序号/桌台ID/桌台名称/所属区域/标准用餐人数/用餐人数范围/数字助记码/操作） */
const TABLE_COLS: ColDef[] = [
  { key: 'idx', label: '序号', width: 70, center: true },
  { key: 'id', label: '桌台ID', width: 110 },
  { key: 'name', label: '桌台名称', width: 120 },
  { key: 'area', label: '所属区域', width: 140 },
  { key: 'capacity', label: '标准用餐人数', width: 130, center: true },
  { key: 'capRange', label: '用餐人数范围', width: 140 },
  { key: 'mnemonic', label: '数字助记码', width: 130 },
  { key: 'actions', label: '操作', width: 140, right: true },
];

/** 桌台行展示：后端返回 + 前端补齐展示字段 */
interface TableRow extends TableItem {
  capRange: string;
  mnemonic: string;
}

const toRow = (t: TableItem): TableRow => ({
  ...t,
  capRange: t.seats_min && t.seats_max ? `${t.seats_min}-${t.seats_max}` : '-',
  mnemonic: t.mnemonic || '-',
});

interface TableManageProps {
  onNavigate?: (viewKey: ViewKey, label: string) => void;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function TableManage({ onNavigate }: TableManageProps = {}) {
  /** 桌台 tab 搜索（输入值 + 已提交关键字，回车/点查询才生效） */
  const [tableQuery, setTableQuery] = useState<string>('');
  const [tableKeyword, setTableKeyword] = useState<string>('');
  /** 桌台管理：批量操作 + 每页条数（给自定义下拉使用） */
  const [batchAction, setBatchAction] = useState<string>('');
  const [pageSize, setPageSize] = useState<string>('10');
  /** 桌台区域树：搜索 + 选中区域 */
  const [treeSearch, setTreeSearch] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('all');

  /** ---- 真实数据 ---- */
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableSubmitting, setTableSubmitting] = useState(false);
  const [tableAddOpen, setTableAddOpen] = useState(false);
  const [batchAddOpen, setBatchAddOpen] = useState(false);
  const [batchDeleteTableOpen, setBatchDeleteTableOpen] = useState(false);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableRow | null>(null);

  /** 应用内确认弹窗（替代 window.confirm，避免原生弹窗被拦截） */
  const [confirmState, setConfirmState] = useState<{ row: TableRow } | null>(null);

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

  /** 桌台列表列宽 */
  const [tableColWidths, setTableColWidths] = useState<number[]>(
    TABLE_COLS.map((c) => c.width),
  );
  /** 双击表头编辑列宽 */
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [draftWidth, setDraftWidth] = useState('');

  const pageSizeNum = Number(pageSize) || 10;

  /** 双击列头 → 输入宽度（px）→ 回车固定 */
  const startEditCol = (i: number) => {
    setEditingColIdx(i);
    setDraftWidth(String(tableColWidths[i]));
  };

  const commitColWidth = () => {
    if (editingColIdx === null) return;
    const n = parseInt(draftWidth, 10);
    if (!Number.isNaN(n)) {
      const w = Math.min(Math.max(50, n), 600);
      setTableColWidths((prev) => {
        const next = [...prev];
        next[editingColIdx] = w;
        return next;
      });
    }
    setEditingColIdx(null);
  };

  /** 渲染桌台表格列头（支持双击输入列宽） */
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

  /** ---- 数据加载 ---- */
  const loadAreas = useCallback(async () => {
    try {
      const res = await listAreasApi();
      setAreas(res);
    } catch (e) {
      console.error('加载区域失败:', e);
    }
  }, []);

  const loadTables = useCallback(async () => {
    setTableLoading(true);
    try {
      const res = await listTablesApi({
        page,
        page_size: pageSizeNum,
        name: tableKeyword || undefined,
        area: selectedArea === 'all' ? undefined : selectedArea,
      });
      setTables(res.items.map(toRow));
      setTotal(res.total);
    } catch (e) {
      console.error('加载桌台失败:', e);
    } finally {
      setTableLoading(false);
    }
  }, [page, pageSizeNum, tableKeyword, selectedArea]);

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  /** 选择区域树节点（含「全部」） */
  const selectArea = (key: string) => {
    setSelectedArea(key);
    setPage(1);
  };

  /** ---- 桌台操作 ---- */
  const handleSubmitTable = async (
    item: TableFormItem,
    mode: 'save' | 'saveAndContinue',
  ): Promise<boolean> => {
    setTableSubmitting(true);
    try {
      const payload: TablePayload = {
        name: item.name,
        area: item.area,
        capacity: item.capacity,
        seats_min: item.seatsMin,
        seats_max: item.seatsMax,
        mnemonic: item.mnemonic,
      };
      if (editingTable) {
        await updateTableApi(editingTable.id, payload);
      } else {
        await createTableApi(payload);
      }
      await Promise.all([loadTables(), loadAreas()]);
      // 「保存并继续新增」成功后保持弹窗（由弹窗内部重置表单）
      if (mode === 'saveAndContinue') return true;
      setTableAddOpen(false);
      setEditingTable(null);
      return true;
    } catch (e) {
      showToast('error', errMsg(e));
      return false;
    } finally {
      setTableSubmitting(false);
    }
  };

  /** 批量新增桌台：逐条调用创建接口，全部成功返回 true */
  const handleBatchAddTables = async (items: TableFormItem[]): Promise<boolean> => {
    setTableSubmitting(true);
    try {
      for (const item of items) {
        const payload: TablePayload = {
          name: item.name,
          area: item.area,
          capacity: item.capacity,
          seats_min: item.seatsMin,
          seats_max: item.seatsMax,
          mnemonic: item.mnemonic,
        };
        await createTableApi(payload);
      }
      await Promise.all([loadTables(), loadAreas()]);
      return true;
    } catch (e) {
      showToast('error', errMsg(e));
      return false;
    } finally {
      setTableSubmitting(false);
    }
  };

  const handleDeleteTable = (row: TableRow) => {
    setConfirmState({ row });
  };

  const confirmDeleteTable = async () => {
    if (!confirmState) return;
    const { row } = confirmState;
    setConfirmState(null);
    try {
      await deleteTableApi(row.id);
      if (tables.length === 1 && page > 1) {
        setPage(page - 1); // 触发 effect 重新加载
      } else {
        await loadTables();
      }
      await loadAreas();
    } catch (e) {
      showToast('error', errMsg(e));
    }
  };

  /** 批量导入桌台：一次性提交导入数据 */
  const handleBatchImportTables = async (items: ImportTableItem[]): Promise<boolean> => {
    setTableSubmitting(true);
    try {
      const res = await importTablesApi(
        items.map((it) => ({ name: it.name, area: it.area, capacity: it.capacity })),
      );
      await Promise.all([loadTables(), loadAreas()]);
      setBatchImportOpen(false);
      showToast('success', `成功导入 ${res.count} 个桌台`);
      return true;
    } catch (e) {
      showToast('error', errMsg(e));
      return false;
    } finally {
      setTableSubmitting(false);
    }
  };

  /** 批量删除桌台：逐条删除，任一失败中断并提示 */
  const handleBatchDeleteTables = async (ids: number[]): Promise<boolean> => {
    setTableSubmitting(true);
    try {
      for (const id of ids) {
        await deleteTableApi(id);
      }
      await Promise.all([loadTables(), loadAreas()]);
      setBatchDeleteTableOpen(false);
      return true;
    } catch (e) {
      showToast('error', errMsg(e));
      return false;
    } finally {
      setTableSubmitting(false);
    }
  };

  /** 桌台导出：按当前选中的区域导出（全部/具体区域），生成 Excel */
  const handleExportTables = async () => {
    try {
      const area = selectedArea === 'all' ? undefined : selectedArea;
      const list = await exportTablesApi(area);
      if (list.length === 0) {
        showToast('info', '没有可导出的桌台');
        return;
      }
      const shopName = getStoredShop() || '店铺';
      const areaLabel = area || '全部';
      const aoa: (string | number)[][] = [
        ['桌台信息表'],
        [`门店：[${shopName}];桌台区域：[${areaLabel}];桌台名称：[全部]`],
        ['桌台ID', '桌台名称', '所属区域', '标准用餐人数', '数字助记码', '桌台类型'],
        ...list.map((t) => [t.id, t.name, t.area, t.capacity ?? '', '', '堂食']),
      ];
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      await exportAoaToXlsx(aoa, {
        sheetName: '桌台信息表',
        filename: `${shopName}_桌台信息表_${areaLabel}_${stamp}.xlsx`,
        merges: [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        ],
        cols: [{ wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 10 }],
      });
    } catch (e) {
      showToast('error', errMsg(e));
    }
  };

  /** ---- 派生数据 ---- */
  const totalTableCount = areas.reduce((s, a) => s + a.tableCount, 0);
  const treeNodes = [
    { key: 'all', label: '全部', count: totalTableCount },
    ...areas.map((a) => ({ key: a.name, label: a.name, count: a.tableCount })),
  ];
  const visibleNodes = treeNodes.filter((n) =>
    treeSearch ? n.label.toLowerCase().includes(treeSearch.toLowerCase()) : true,
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">桌台管理</h1>
      </div>

      <div className="table-panel-wrap tm-main-panel">
        {/* 必点菜提示横幅 */}
        <div className="tm-tip">
          <span className="tm-tip-icon" aria-hidden>!</span>
          如想在开台时自动添加必点菜，点此处设置
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.('ops:business:must', '必点菜设置');
            }}
          >
            必点菜方案
          </a>
        </div>

        {/* 功能按钮区（独立成行，不在 panel-body 表单 DOM 内，跨整个表格分栏宽度） */}
        <div className="tm-toolbar">
          <button
            className="tm-btn tm-btn-primary"
            onClick={() => {
              setEditingTable(null);
              setTableAddOpen(true);
            }}
          >
            新增桌台
          </button>
          <button
            className="tm-btn tm-btn-default"
            onClick={() => {
              // TODO: 后续接桌台排序弹窗
              console.log('桌台排序');
            }}
          >
            桌台排序
          </button>
          <CommonSelect
            value={batchAction}
            placeholder="批量操作"
            width={200}
            options={[
              { value: 'add', label: '批量新增' },
              { value: 'import', label: '批量导入' },
              { value: 'delete', label: '批量删除' },
            ]}
            onChange={(v) => {
              setBatchAction('');
              if (v === 'add') {
                setBatchAddOpen(true);
              } else if (v === 'import') {
                setBatchImportOpen(true);
              } else if (v === 'delete') {
                setBatchDeleteTableOpen(true);
              }
            }}
          />
          <button
            className="tm-btn tm-btn-default"
            onClick={() => {
              void handleExportTables();
            }}
          >
            <Icon name="export" className="btn-icon" />
            桌台导出
          </button>
        </div>
        <div className="table-panel table-split">
          {/* 左侧区域树（全部/大厅/外摆…，计数取自区域接口） */}
          <aside className="tree-panel">
            <div className="tree-search">
              <Icon name="search" className="tree-search-icon" />
              <input
                type="text"
                placeholder="搜索节点"
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
              />
            </div>
            <div className="tree-list">
              {visibleNodes.length === 0 ? (
                <div className="tree-empty">无匹配节点</div>
              ) : (
                visibleNodes.map((n) => (
                  <button
                    key={n.key}
                    className={`tree-node ${selectedArea === n.key ? 'active' : ''}`}
                    onClick={() => selectArea(n.key)}
                  >
                    <span className="tree-title">
                      {n.label}({n.count})
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* 右侧：搜索表单 + 表格 + 分页 */}
          <section className="panel" style={{ flex: 1, minWidth: 0 }}>
            <div className="panel-body">
              {/* 搜索表单（桌台名称 + 查询 + 重置） */}
              <SearchForm
                fields={[{ key: 'tableQuery', label: '桌台名称：', placeholder: '请输入' }]}
                values={{ tableQuery }}
                onChange={(k, v) => {
                  if (k === 'tableQuery') setTableQuery(v);
                }}
                onSearch={() => {
                  setTableKeyword(tableQuery.trim());
                  setPage(1);
                }}
                onReset={() => {
                  setTableQuery('');
                  setTableKeyword('');
                  setPage(1);
                }}
              />

              {/* 桌台列表 */}
              <div className="data-table table-list">
                <div className="area-table-scroll">
                  <table className="checkout-real-table">
                    <colgroup>
                      {TABLE_COLS.map((c, i) => (
                        <col key={c.key} style={{ width: tableColWidths[i] }} />
                      ))}
                    </colgroup>
                    {renderColHead(TABLE_COLS, tableColWidths)}
                    <tbody>
                      {tableLoading ? (
                        <tr>
                          <td colSpan={8} style={{ height: 160, textAlign: 'center', padding: 0 }}>
                            <EmptyState title="加载中…" />
                          </td>
                        </tr>
                      ) : tables.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ height: 160, textAlign: 'center', padding: 0 }}>
                            <EmptyState title="暂无桌台数据" />
                          </td>
                        </tr>
                      ) : (
                        tables.map((t, i) => (
                          <tr key={t.id}>
                            <td className="td-center">{(page - 1) * pageSizeNum + i + 1}</td>
                            <td>{t.id}</td>
                            <td>{t.name}</td>
                            <td>{t.area}</td>
                            <td className="td-center">{t.capacity}</td>
                            <td>{t.capRange}</td>
                            <td>{t.mnemonic}</td>
                            <td className="td-sticky">
                              <div className="row-actions">
                                <button
                                  className="action-link"
                                  type="button"
                                  onClick={() => {
                                    setEditingTable(t);
                                    setTableAddOpen(true);
                                  }}
                                >
                                  编辑
                                </button>
                                <button
                                  className="action-link danger"
                                  type="button"
                                  onClick={() => handleDeleteTable(t)}
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

              {/* 分页条 */}
              <Pagination
                total={total}
                page={page}
                pageSize={pageSizeNum}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(String(s));
                  setPage(1);
                }}
              />
            </div>
          </section>
        </div>
      </div>

      <BatchAddTableModal
        open={batchAddOpen}
        areas={areas}
        onClose={() => setBatchAddOpen(false)}
        onSubmit={handleBatchAddTables}
        submitting={tableSubmitting}
      />

      <BatchImportTableModal
        open={batchImportOpen}
        onClose={() => setBatchImportOpen(false)}
        onSubmit={handleBatchImportTables}
        submitting={tableSubmitting}
      />

      <BatchDeleteTableModal
        open={batchDeleteTableOpen}
        areas={areas}
        onClose={() => setBatchDeleteTableOpen(false)}
        onConfirm={(ids) => {
          handleBatchDeleteTables(ids);
        }}
      />

      <AddTableModal
        open={tableAddOpen}
        areas={areas}
        initial={
          editingTable
            ? {
                name: editingTable.name,
                area: editingTable.area,
                capacity: editingTable.capacity,
                seatsMin: editingTable.seats_min,
                seatsMax: editingTable.seats_max,
                mnemonic: editingTable.mnemonic,
              }
            : null
        }
        onClose={() => {
          setTableAddOpen(false);
          setEditingTable(null);
        }}
        onSubmit={handleSubmitTable}
        submitting={tableSubmitting}
      />

      <ConfirmModal
        open={confirmState !== null}
        title="删除桌台"
        message={
          confirmState
            ? `确定删除桌台「${confirmState.row.name}」吗？删除后不可恢复。`
            : ''
        }
        confirmText="删除"
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmDeleteTable}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
