import { useEffect, useRef, useState } from 'react';
import { exportAoaToXlsx, readXlsxToAoa } from '../utils/excel';
import {
  importDishesApi,
  type ImportDishRow,
  type ImportResult,
  type ImportRowError,
} from '../api/dishes';

interface BatchImportDishModalProps {
  open: boolean;
  onClose: () => void;
  /** 导入完成后回调（父组件用于刷新列表 + 提示） */
  onImported: (result: ImportResult) => void | Promise<void>;
}

/** 最大文件大小：3M */
const MAX_FILE_SIZE = 3 * 1024 * 1024;
/** 最大导入行数：2000 */
const MAX_ITEMS = 2000;
/** 每批提交行数 */
const CHUNK_SIZE = 50;

/** 表头列（与导出一致） */
const TEMPLATE_HEADERS = ['菜品名称', '菜品分类', '菜品类型', '菜品价格', '菜品编码', '规格编码', '状态', '菜品单位', '菜品规格'];

/** 生成导入模板（.xlsx）并触发下载 */
async function downloadTemplate() {
  await exportAoaToXlsx(
    [
      ['菜品信息表'],
      [
        '说明：菜品编码/规格编码无需填写，导入后系统自动生成；菜品类型默认普通菜，状态默认在售，菜品单位默认份，菜品规格默认标准。同一菜品多规格时填写多行（名称/分类/类型相同，规格与价格不同）；名称/分类/类型/规格完全相同时判定为重复，会被自动跳过。',
      ],
      TEMPLATE_HEADERS,
      ['示例：精品毛肚', '荤菜', '普通菜', '45', '', '', '在售', '份', '标准'],
      ['示例：红汤锅底', '锅底油碟', '普通菜', '45', '', '', '在售', '份', '小锅'],
      ['示例：红汤锅底', '锅底油碟', '普通菜', '68', '', '', '在售', '份', '中锅'],
    ],
    {
      sheetName: '菜品信息',
      filename: '批量导入菜品信息模板.xlsx',
      merges: [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      ],
      cols: [
        { wch: 18 },
        { wch: 14 },
        { wch: 10 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
      ],
    },
  );
}

/** 解析 xlsx 表格行（二维数组）→ 菜品数据行。首行为表头，按表头匹配列；空行/示例行跳过 */
function parseRows(rows: unknown[][]): { rows: ImportDishRow[]; errors: string[] } {
  // 定位表头行：包含「菜品名称」且非空列不少于 4 个（避免误匹配标题/说明行）
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? '').trim());
    if (!row.some((c) => c.includes('菜品名称'))) continue;
    const nonEmpty = row.filter((c) => c !== '').length;
    if (nonEmpty >= 4) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return {
      rows: [],
      errors: ['未找到表头，请使用系统模板（需包含「菜品名称」列）'],
    };
  }

  const header = rows[headerIdx].map((c) => String(c ?? '').trim());
  const colName = header.findIndex((c) => c.includes('菜品名称') || (c.includes('名称') && !c.includes('套餐')));
  const colCategory = header.findIndex((c) => c.includes('菜品分类') || c.includes('基础分类') || c.includes('分类'));
  const colType = header.findIndex((c) => c.includes('菜品类型'));
  const colPrice = header.findIndex((c) => c.includes('菜品价格') || c.includes('售卖价') || c.includes('售价') || c.includes('价格'));
  const colStatus = header.findIndex((c) => c.includes('状态'));
  // 规格列优先匹配「菜品规格/规格名称」，再匹配其他含「规格」的列（跳过「规格编码」）
  let colSpec = header.findIndex((c) => c.includes('菜品规格') || c.includes('规格名称'));
  if (colSpec === -1) colSpec = header.findIndex((c) => c.includes('规格') && !c.includes('编码'));

  const out: ImportDishRow[] = [];
  const errors: string[] = [];
  // 文件内唯一键：名称 + 分类 + 类型 + 规格（完全一致视为重复）
  const seen = new Set<string>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? '').trim());
    if (row.every((c) => c === '')) continue;

    const name = colName >= 0 ? row[colName] : '';
    if (!name) {
      errors.push(`第 ${i + 1} 行：缺少菜品名称`);
      continue;
    }
    if (name.startsWith('示例')) continue; // 跳过模板示例行

    const category = colCategory >= 0 && row[colCategory] ? row[colCategory] : '';
    if (!category) {
      errors.push(`第 ${i + 1} 行：缺少菜品分类`);
      continue;
    }

    const typeRaw = colType >= 0 ? row[colType] : '';
    const type = typeRaw === '称重菜' ? '称重菜' : '普通菜';

    const rawPrice = colPrice >= 0 ? row[colPrice] : '';
    if (rawPrice === '') {
      errors.push(`第 ${i + 1} 行：缺少菜品价格`);
      continue;
    }
    const price = Number(rawPrice);
    if (Number.isNaN(price) || price < 0) {
      errors.push(`第 ${i + 1} 行：菜品价格需为不小于 0 的数字`);
      continue;
    }

    const status = colStatus >= 0 && row[colStatus] ? row[colStatus] : '在售';
    if (status !== '在售' && status !== '停售') {
      errors.push(`第 ${i + 1} 行：状态仅支持「在售 / 停售」`);
      continue;
    }

    const spec = colSpec >= 0 && row[colSpec] ? row[colSpec] : '标准';

    const key = `${name}|${category}|${type}|${spec}`;
    if (seen.has(key)) {
      errors.push(`第 ${i + 1} 行：菜品「${name}」（分类 ${category} / 类型 ${type} / 规格 ${spec}）与文件内其他行重复`);
      continue;
    }
    seen.add(key);

    out.push({ name, category, type, price, spec, status });
  }

  return { rows: out, errors };
}

/** 批量导入菜品弹窗：下载模板 → 上传 .xlsx → 解析预览 → 分批导入并展示进度/结果卡片 */
export default function BatchImportDishModal({
  open,
  onClose,
  onImported,
}: BatchImportDishModalProps) {
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ImportDishRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** confirm：预览待导入；running：导入中；done：展示结果 */
  const [phase, setPhase] = useState<'confirm' | 'running' | 'done'>('confirm');
  const [progress, setProgress] = useState({ done: 0, total: 0, imported: 0, skipped: 0, failed: 0 });
  const [errors, setErrors] = useState<ImportRowError[]>([]);

  useEffect(() => {
    if (open) {
      setFileName('');
      setError('');
      setRows([]);
      setDragOver(false);
      setPhase('confirm');
      setErrors([]);
      setProgress({ done: 0, total: 0, imported: 0, skipped: 0, failed: 0 });
    }
  }, [open]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setFileName('');
      setRows([]);
      setError('仅支持 .xlsx 格式文件，请下载模板后填写数据');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileName('');
      setRows([]);
      setError('文件超过 3M，请精简数据后重新上传');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const data = await readXlsxToAoa(buf);
      const { rows: parsed, errors: parseErrs } = parseRows(data);
      if (parsed.length === 0) {
        setRows([]);
        setError(parseErrs[0] || '文件中没有可导入的菜品数据');
        return;
      }
      if (parsed.length > MAX_ITEMS) {
        setRows([]);
        setError(`每次导入菜品行数应小于 ${MAX_ITEMS} 条，请拆分后导入`);
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      setError(parseErrs.length > 0 ? `已解析 ${parsed.length} 行，但有 ${parseErrs.length} 行无效数据被跳过（首条：${parseErrs[0]}）` : '');
    } catch {
      setFileName('');
      setRows([]);
      setError('文件解析失败，请确认是有效的 .xlsx 文件');
    }
  };

  /** 分批导入并推进度 */
  const handleConfirm = async () => {
    if (rows.length === 0 || phase === 'running') return;
    setPhase('running');
    setErrors([]);
    setProgress({ done: 0, total: rows.length, imported: 0, skipped: 0, failed: 0 });

    let imported = 0;
    let skipped = 0;
    let done = 0;
    const allErrors: ImportRowError[] = [];

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const batch = rows.slice(i, i + CHUNK_SIZE);
      try {
        const res = await importDishesApi(batch);
        imported += res.imported;
        skipped += res.skipped;
        allErrors.push(...res.errors);
      } catch (e) {
        // 整批请求失败：本批各行记失败并中止，剩余未导入行计入失败
        allErrors.push(
          ...batch.map((r) => ({
            name: r.name,
            category: r.category,
            type: r.type,
            spec: r.spec,
            reason: (e as Error).message || '导入请求失败',
          })),
        );
        done = rows.length;
        setProgress({ done, total: rows.length, imported, skipped, failed: rows.length - imported - skipped });
        setErrors(allErrors);
        setPhase('done');
        await onImported({
          total: rows.length,
          imported,
          skipped,
          errors: allErrors,
        });
        return;
      }
      done = Math.min(i + batch.length, rows.length);
      setProgress({ done, total: rows.length, imported, skipped, failed: rows.length - imported - skipped });
    }

    setErrors(allErrors);
    setPhase('done');
    setProgress({ done: rows.length, total: rows.length, imported, skipped, failed: rows.length - imported - skipped });
    await onImported({
      total: rows.length,
      imported,
      skipped,
      errors: allErrors,
    });
  };

  if (!open) return null;

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  /** 弹窗关闭回调（导入中不可关） */
  function onCloseSafe() {
    if (phase !== 'running') onClose();
  }

  return (
    <div className="modal-mask" onClick={onCloseSafe}>
      <div className="modal-card batch-table-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">批量导入菜品</div>
          <button className="modal-close" aria-label="关闭" onClick={onCloseSafe}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {phase === 'confirm' && (
            <>
              <div className="batch-table-tip">
                <span className="batch-table-tip-icon" aria-hidden>
                  i
                </span>
                <span>
                  下载导入模板，根据模板编辑菜品数据后上传；菜品名称唯一，同一菜品多规格时填写多行（名称/分类/类型相同，规格与价格不同），名称/分类/类型/规格完全相同的重复行会被自动跳过。每次导入行数应小于 {MAX_ITEMS} 条，文件小于 3M。
                </span>
              </div>

              <div className="batch-import-step">
                <div className="batch-import-step-num">1</div>
                <div className="batch-import-step-main">
                  <div className="batch-import-step-text">下载导入模板，根据系统提供的模板编辑数据</div>
                  <button
                    className="tm-btn tm-btn-default batch-import-download-btn"
                    type="button"
                    onClick={downloadTemplate}
                  >
                    下载模板
                  </button>
                </div>
              </div>

              <div className="batch-import-step">
                <div className="batch-import-step-num">2</div>
                <div className="batch-import-step-main">
                  <div className="batch-import-step-text">上传编辑好的数据，仅支持 .xlsx 格式文件</div>
                  <div
                    className={`batch-import-upload${dragOver ? ' batch-import-upload-dragover' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFile(e.dataTransfer.files?.[0]);
                    }}
                  >
                    {fileName ? (
                      <>
                        <div className="batch-import-upload-icon">✓</div>
                        <div className="batch-import-upload-name">{fileName}</div>
                        <div className="batch-import-upload-hint">点击或拖拽可重新上传</div>
                      </>
                    ) : (
                      <>
                        <div className="batch-import-upload-icon">＋</div>
                        <div className="batch-import-upload-name">点击上传 或 拖拽文件至此处</div>
                        <div className="batch-import-upload-hint">仅支持 .xlsx 格式文件</div>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      handleFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {rows.length > 0 && (
                <div className="batch-table-preview">
                  已解析 {rows.length} 行（规格行），共{' '}
                  {new Set(rows.map((r) => r.name)).size} 个菜品名称：
                  {rows.slice(0, 6).map((r) => `${r.name}(${r.spec}/${r.price}元)`).join('、')}
                  {rows.length > 6 ? `…` : ''}
                </div>
              )}

              {error && <div className="area-form-error">{error}</div>}
            </>
          )}

          {phase === 'running' && (
            <div className="batch-import-progress">
              <div className="batch-import-progress-head">
                <span>正在导入…</span>
                <span>
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="batch-import-progress-bar">
                <div className="batch-import-progress-bar-inner" style={{ width: `${pct}%` }} />
              </div>
              <div className="batch-import-progress-stats">
                <span className="ok">成功 {progress.imported}</span>
                <span className="warn">重复跳过 {progress.skipped}</span>
                <span className="err">失败 {progress.failed}</span>
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="batch-import-progress is-done">
              <div className={`batch-import-result-icon${progress.failed > 0 ? ' has-error' : ''}`}>
                {progress.failed > 0 ? '!' : '✓'}
              </div>
              <div className="batch-import-result-title">导入完成</div>
              <div className="batch-import-progress-stats">
                <span className="ok">成功 {progress.imported}</span>
                <span className="warn">重复跳过 {progress.skipped}</span>
                <span className="err">失败 {progress.failed}</span>
              </div>
              {errors.length > 0 && (
                <div className="batch-import-error-list">
                  <div className="batch-import-error-title">
                    重复 / 失败明细（{errors.length} 条）
                  </div>
                  <div className="batch-import-error-scroll">
                    {errors.slice(0, 50).map((e, i) => (
                      <div key={i} className="batch-import-error-item">
                        <span className="batch-import-error-name">{e.name}</span>
                        <span className="batch-import-error-spec">{e.spec}</span>
                        <span className="batch-import-error-reason">{e.reason}</span>
                      </div>
                    ))}
                    {errors.length > 50 && (
                      <div className="batch-import-error-more">… 其余 {errors.length - 50} 条</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          {phase === 'running' ? (
            <button className="tm-btn tm-btn-primary" type="button" disabled>
              导入中…
            </button>
          ) : phase === 'done' ? (
            <button className="tm-btn tm-btn-primary" type="button" onClick={onClose}>
              完 成
            </button>
          ) : (
            <>
              <button className="tm-btn tm-btn-default" type="button" onClick={onCloseSafe}>
                取 消
              </button>
              <button
                className="tm-btn tm-btn-primary"
                type="button"
                onClick={handleConfirm}
                disabled={rows.length === 0}
              >
                开始导入
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
