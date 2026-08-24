import { useEffect, useRef, useState } from 'react';
import { exportAoaToXlsx, readXlsxToAoa } from '../utils/excel';

interface ImportItem {
  name: string;
  area?: string;
  capacity?: number;
}

interface BatchImportTableModalProps {
  open: boolean;
  onClose: () => void;
  /** 提交回调：返回 true 表示成功，成功后父组件关闭弹窗 */
  onSubmit: (items: ImportItem[]) => Promise<boolean>;
  submitting?: boolean;
}

export interface ImportTableItem extends ImportItem {}

/** 最大文件大小：3M */
const MAX_FILE_SIZE = 3 * 1024 * 1024;
/** 最大导入条数：2000 */
const MAX_ITEMS = 2000;

/** 生成导入模板（.xlsx）并触发下载 */
async function downloadTemplate() {
  await exportAoaToXlsx(
    [
      ['桌台名称', '所属区域', '标准用餐人数'],
      ['示例：大厅1号桌', '大厅', '4'],
      ['示例：包间1号', '包间', '8'],
    ],
    {
      sheetName: '桌台信息',
      filename: '批量导入门店桌台信息模板.xlsx',
      cols: [{ wch: 20 }, { wch: 16 }, { wch: 14 }],
    },
  );
}

/** 解析 xlsx 表格行（二维数组）→ 桌台条目。首行为表头，按表头匹配列；空行/示例行跳过 */
function parseRows(rows: unknown[][]): { items: ImportItem[]; errors: string[] } {

  // 定位表头行（包含「桌台名称」或「名称」）
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? '').trim());
    if (row.some((c) => c.includes('桌台名称') || c === '名称')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return {
      items: [],
      errors: ['未找到表头，请使用系统模板（需包含「桌台名称」列）'],
    };
  }

  const header = rows[headerIdx].map((c) => String(c ?? '').trim());
  const colName = header.findIndex((c) => c.includes('桌台名称') || c === '名称');
  const colArea = header.findIndex((c) => c.includes('区域') || c.includes('分区'));
  const colCap = header.findIndex(
    (c) => c.includes('用餐人数') || c.includes('人数') || c.includes('座位'),
  );

  const items: ImportItem[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? '').trim());
    const isEmpty = row.every((c) => c === '');
    if (isEmpty) continue;

    const rawName = colName >= 0 ? row[colName] : '';
    if (!rawName) {
      errors.push(`第 ${i + 1} 行：缺少桌台名称`);
      continue;
    }
    if (rawName.startsWith('示例')) continue; // 跳过模板示例行
    if (seen.has(rawName)) {
      errors.push(`第 ${i + 1} 行：桌台名称「${rawName}」重复`);
      continue;
    }
    seen.add(rawName);

    const area = colArea >= 0 && row[colArea] ? row[colArea] : '默认区';
    let capacity = 4;
    const rawCap = colCap >= 0 ? row[colCap] : '';
    if (rawCap !== '') {
      const num = Number(rawCap);
      if (Number.isNaN(num) || num < 1 || num > 100) {
        errors.push(`第 ${i + 1} 行：标准用餐人数需为 1-100 的整数`);
        continue;
      }
      capacity = num;
    }
    items.push({ name: rawName, area, capacity });
  }

  return { items, errors };
}

/** 批量导入桌台弹窗：下载模板 → 上传 .xlsx → 解析预览 → 一次性提交 */
export default function BatchImportTableModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
}: BatchImportTableModalProps) {
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState<ImportItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFileName('');
      setError('');
      setItems([]);
      setDragOver(false);
    }
  }, [open]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setFileName('');
      setItems([]);
      setError('仅支持 .xlsx 格式文件，请下载模板后填写数据');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileName('');
      setItems([]);
      setError('文件超过 3M，请精简数据后重新上传');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const rows = await readXlsxToAoa(buf);
      const { items: parsed, errors } = parseRows(rows);
      if (parsed.length === 0) {
        setItems([]);
        setError(errors[0] || '文件中没有可导入的桌台数据');
        return;
      }
      if (parsed.length > MAX_ITEMS) {
        setItems([]);
        setError(`每次导入桌台数量应小于 ${MAX_ITEMS} 条，请拆分后导入`);
        return;
      }
      setItems(parsed);
      setFileName(file.name);
      setError(errors.length > 0 ? `已解析 ${parsed.length} 条，但有 ${errors.length} 条无效数据被跳过（首条：${errors[0]}）` : '');
    } catch {
      setFileName('');
      setItems([]);
      setError('文件解析失败，请确认是有效的 .xlsx 文件');
    }
  };

  const handleConfirm = async () => {
    if (items.length === 0) return;
    const ok = await onSubmit(items);
    if (ok) {
      setFileName('');
      setItems([]);
      setError('');
    }
  };

  if (!open) return null;

  return (
    <div className="modal-mask" onClick={() => !submitting && onCloseSafe()}>
      <div className="modal-card batch-table-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">批量导入桌台</div>
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
              下载导入模板，根据模板编辑桌台数据后上传；每次导入桌台数量应小于 {MAX_ITEMS} 条，文件小于 3M。
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

          {items.length > 0 && (
            <div className="batch-table-preview">
              已解析 {items.length} 条桌台：
              {items.slice(0, 6).map((it) => `${it.name}(${it.area}/${it.capacity}人)`).join('、')}
              {items.length > 6 ? `…` : ''}
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
            disabled={submitting || items.length === 0}
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
