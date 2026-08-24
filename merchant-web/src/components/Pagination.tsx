import CommonSelect from './CommonSelect';

/** 统一每页条数选项：默认 10 条/页，可选 20 / 30 / 50 */
export const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 条/页' },
  { value: '20', label: '20 条/页' },
  { value: '30', label: '30 条/页' },
  { value: '50', label: '50 条/页' },
];

/** 统一默认每页条数 */
export const DEFAULT_PAGE_SIZE = 10;

interface PaginationProps {
  /** 总记录数 */
  total: number;
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数 */
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/** 紧凑页码窗口：首尾 + 当前页前后各 1 页，超长用省略号 */
function pageNumbers(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, 2, page - 1, page, page + 1, totalPages - 1, totalPages]);
  const nums = Array.from(set)
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

/** 系统统一分页条：共 N 条记录 + 页码 + 每页条数（默认 10，可选 20/30/50） */
export default function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="table-pagination">
      <span className="page-total">共 {total} 条记录</span>
      <div className="page-pages">
        <button
          className="page-btn"
          disabled={page <= 1}
          aria-label="上一页"
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          ‹
        </button>
        {pageNumbers(page, totalPages).map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className="page-ellipsis">…</span>
          ) : (
            <button
              key={n}
              className={`page-num ${page === n ? 'active' : ''}`}
              type="button"
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          ),
        )}
        <button
          className="page-btn"
          disabled={page >= totalPages}
          aria-label="下一页"
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          ›
        </button>
      </div>
      <CommonSelect
        className="page-size"
        value={String(pageSize)}
        align="right"
        width="auto"
        options={PAGE_SIZE_OPTIONS}
        onChange={(v) => onPageSizeChange(Number(v))}
      />
    </div>
  );
}
