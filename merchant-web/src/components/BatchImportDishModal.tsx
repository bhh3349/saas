import { useEffect, useRef, useState } from 'react';
import { exportAoaToXlsx, readXlsxToAoa } from '../utils/excel';

/** 导入的菜品数据行（一个规格一行） */
export interface ImportDishRow {
  name: string;
  category: string;
  type: string;
  price: number;
  spec: string;
  status: string;
}

interface BatchImportDishModalProps {
  open: boolean;
  onClose: () => void;
  /** 提交回调：返回 true 表示成功，成功后父组件关闭弹窗 */
  onSubmit: (rows: ImportDishRow[]) => Promise<boolean>;
  submitting?: boolean;
}

/** 最大文件大小：3M */
const MAX_FILE_SIZE = 3 * 1024 * 1024;
/** 最大导入行数：2000 */
const MAX_ITEMS = 2000;

/** 表头列（与导出一致） */
const TEMPLATE_HEADERS = ['菜品名称', '菜品分类', '菜品类型', '菜品价格', '菜品编码', '规格编码', '状态', '菜品单位', '菜品规格'];

/** 生成导入模板（.xlsx）并触发下载 */
async function downloadTemplate() {
  await exportAoaToXlsx(
    [
      ['菜品信息表'],
      [
        '说明：菜品编码/规格编码无需填写，导入后系统自动生成；菜品类型默认普通菜，状态默认在售，菜品单位默认份，菜品规格默认标准。同一菜品多规格时填写多行（名称/分类/类型/编码相同，规格与价格不同）。',
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
  const seen = new Set<string>(); // 名称 + 规格 去重

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

    const key = `${name}|${spec}`;
    if (seen.has(key)) {
      errors.push(`第 ${i + 1} 行：菜品「${name}」规格「${spec}」重复`);
      continue;
    }
    seen.add(key);

    out.push({ name, category, type, price, spec, status });
  }

  return { rows: out, errors };
}

/** 批量导入菜品弹窗：下载模板 → 上传 .xlsx → 解析预览 → 一次性提交 */
export default function BatchImportDishModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
}: BatchImportDishModalProps) {
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ImportDishRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFileName('');
      setError('');
      setRows([]);
      setDragOver(false);
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
      const { rows: parsed, errors } = parseRows(data);
      if (parsed.length === 0) {
        setRows([]);
        setError(errors[0] || '文件中没有可导入的菜品数据');
        return;
      }
      if (parsed.length > MAX_ITEMS) {
        setRows([]);
        setError(`每次导入菜品行数应小于 ${MAX_ITEMS} 条，请拆分后导入`);
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      setError(errors.length > 0 ? `已解析 ${parsed.length} 行，但有 ${errors.length} 行无效数据被跳过（首条：${errors[0]}）` : '');
    } catch {
      setFileName('');
      setRows([]);
      setError('文件解析失败，请确认是有效的 .xlsx 文件');
    }
  };

  const handleConfirm = async () => {
    if (rows.length === 0) return;
    const ok = await onSubmit(rows);
    if (ok) {
      setFileName('');
      setRows([]);
      setError('');
    }
  };

  if (!open) return null;

  return (
    <div className="modal-mask" onClick={() => !submitting && onCloseSafe()}>
      <div className="modal-card batch-table-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">批量导入菜品</div>
          <button className="modal-close" aria-label="关闭" onClick={onCloseSafe}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="batch-table-tip">
            <span className="batch-table-tip-icon" aria-hidden>
              i
            </span>
            <span>
              下载导入模板，根据模板编辑菜品数据后上传；菜品名称唯一，同一菜品多规格时填写多行（名称/分类/类型相同，规格与价格不同）。每次导入行数应小于 {MAX_ITEMS} 条，文件小于 3M。
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
              已解析 {rows.length} 行，共{' '}
              {new Set(rows.map((r) => r.name)).size} 个菜品：
              {rows.slice(0, 6).map((r) => `${r.name}(${r.spec}/${r.price}元)`).join('、')}
              {rows.length > 6 ? `…` : ''}
            </div>
          )}

          {error && <div className="area-form-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="tm-btn tm-btn-default" type="button" onClick={onCloseSafe}>
            取 消
          </button>
          <button
            className="tm-btn tm-btn-primary"
            type="button"
            onClick={handleConfirm}
            disabled={submitting || rows.length === 0}
          >
            {submitting ? '导入中…' : '开始导入'}
          </button>
        </div>
      </div>
    </div>
  );

  /** 弹窗关闭回调（提交中不可关） */
  function onCloseSafe() {
    if (!submitting) onClose();
  }
}
