import type { CSSProperties, ReactNode } from 'react';
import EmptyState from '../EmptyState';
import Pagination from '../Pagination';

export interface ReportColumn<T> {
  key: string;
  title: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => ReactNode;
  strong?: boolean;
}

interface ReportTableProps<T> {
  columns: ReportColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  /** 合计行（与 columns 对齐；null 表示该列不输出） */
  summary?: (ReactNode | null)[];
  empty?: { title?: string; desc?: string };
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const centerTh: CSSProperties = { textAlign: 'center' };

/** 通用报表表格：列头 + 数据行 + 合计行 + 空态/加载 + 分页 */
export default function ReportTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  summary,
  empty,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ReportTableProps<T>) {
  return (
    <>
      <div className="data-table table-list report-list">
        <div className="area-table-scroll checkout-scroll">
          <table className="checkout-real-table report-real-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={{ width: c.width, textAlign: c.align ?? 'left' }}
                  >
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} style={{ height: 220, textAlign: 'center', padding: 0 }}>
                    <EmptyState title="加载中" desc="正在统计报表数据…" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ height: 220, textAlign: 'center', padding: 0 }}>
                    <EmptyState
                      title={empty?.title ?? '暂无数据'}
                      desc={empty?.desc ?? '当前查询条件下没有统计数据'}
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={rowKey(row)}>
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        style={{
                          textAlign: c.align ?? 'left',
                          fontWeight: c.strong ? 600 : undefined,
                        }}
                      >
                        {c.render
                          ? c.render(row, i)
                          : ((row as Record<string, unknown>)[c.key] as ReactNode) ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {!loading && rows.length > 0 && summary && (
              <tfoot>
                <tr className="report-summary-row">
                  {summary.map((cell, i) => (
                    <td key={i} style={columns[i]?.align === 'center' ? centerTh : undefined}>
                      {cell ?? ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <Pagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </>
  );
}
