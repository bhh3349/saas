/**
 * Excel 工具层：统一封装 xlsx 的懒加载与读写。
 *
 * xlsx 包体积约 875KB（gzip 后约 250KB），不应随首屏加载。
 * 本模块内部动态 import('xlsx')，首次调用才拉取该 chunk，
 * 之后全局复用同一份实例（浏览器缓存一次下载）。
 *
 * 后续新增能力（菜品导入导出、报表导出等）直接复用本模块，
 * 不要再在业务文件中静态 import 'xlsx'。
 */

/** xlsx 模块类型（懒加载单例） */
let xlsxPromise: Promise<typeof import('xlsx')> | null = null;

function loadXlsx(): Promise<typeof import('xlsx')> {
  xlsxPromise ??= import('xlsx');
  return xlsxPromise;
}

/** 单元格合并区域描述（与 xlsx 的 !merges 结构一致） */
export interface XlsxMergeCell {
  s: { r: number; c: number };
  e: { r: number; c: number };
}

export interface ExportXlsxOptions {
  /** 工作表名称，默认 'Sheet1' */
  sheetName?: string;
  /** 输出文件名（需含 .xlsx 后缀） */
  filename: string;
  /** 合并单元格列表（可选） */
  merges?: XlsxMergeCell[];
  /** 列宽配置（可选），如 [{ wch: 18 }, { wch: 14 }] */
  cols?: { wch?: number }[];
}

/** 将二维数组导出为 .xlsx 并触发浏览器下载 */
export async function exportAoaToXlsx(
  aoa: (string | number)[][],
  { sheetName = 'Sheet1', filename, merges, cols }: ExportXlsxOptions,
): Promise<void> {
  const XLSX = await loadXlsx();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (merges && merges.length > 0) ws['!merges'] = merges;
  if (cols && cols.length > 0) ws['!cols'] = cols;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/**
 * 读取 .xlsx 文件内容为按行排列的二维数组（header:1，空单元格为 ''）。
 * 表头行定位、字段校验等业务逻辑由调用方处理。
 */
export async function readXlsxToAoa(buf: ArrayBuffer): Promise<unknown[][]> {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
}
