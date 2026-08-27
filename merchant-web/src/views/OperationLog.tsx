import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { DatePicker } from 'antd';
import { fetchSensitiveDetail, defaultRange, type SensitiveDetailRow } from '../api/reports';
import Toast, { type ToastData } from '../components/Toast';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/Pagination';

const ACTION_TEXT: Record<string, string> = {
  price_change: '改价',
  refund: '退菜',
  void_order: '作废订单',
  free_order: '免单',
  voucher: '券核销',
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = dayjs(iso);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : '—';
}

function formatAmount(n: number): string {
  return n ? `¥${n.toFixed(2)}` : '—';
}

export default function OperationLog() {
  const range = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState({ from: range.from, to: range.to, keyword: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [items, setItems] = useState<SensitiveDetailRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSensitiveDetail({
        from: query.from,
        to: query.to,
        page,
        page_size: pageSize,
        keyword: query.keyword.trim() || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const handleQuery = () => {
    setQuery({ from, to, keyword });
    setPage(1);
  };

  const handleReset = () => {
    const r = defaultRange();
    setFrom(r.from);
    setTo(r.to);
    setKeyword('');
    setQuery({ from: r.from, to: r.to, keyword: '' });
    setPage(1);
  };

  return (
    <div className="page">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="page-head">
        <h1 className="page-title">操作日志</h1>
      </div>

      <section className="panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel-head">
          <div className="panel-title">操作记录</div>
        </div>
        <div className="panel-body">
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <DatePicker.RangePicker
              value={from && to ? [dayjs(from), dayjs(to)] : null}
              onChange={(dates) => {
                setFrom(dates?.[0]?.format('YYYY-MM-DD') ?? '');
                setTo(dates?.[1]?.format('YYYY-MM-DD') ?? '');
              }}
              placeholder={['开始日期', '结束日期']}
              style={{ width: 260 }}
            />
            <input
              type="text"
              className="ant-input"
              placeholder="搜索关键字"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuery();
              }}
              style={{ width: 220, height: 32 }}
            />
            <button className="tm-btn tm-btn-primary" type="button" onClick={handleQuery}>
              查询
            </button>
            <button className="tm-btn tm-btn-default" type="button" onClick={handleReset}>
              重置
            </button>
          </div>

          <div className="data-table">
            <div className="area-table-scroll checkout-scroll">
              <table className="checkout-real-table">
                <colgroup>
                  <col style={{ width: 60 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 120 }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th className="th-center">序号</th>
                    <th className="th-center">时间</th>
                    <th className="th-center">操作人</th>
                    <th className="th-center">操作类型</th>
                    <th className="th-center">目标类型</th>
                    <th className="th-center">目标ID</th>
                    <th className="th-center">涉及金额(元)</th>
                    <th>详情描述</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td className="checkout-empty-cell" colSpan={8}>
                        {loading ? '加载中…' : '暂无操作日志'}
                      </td>
                    </tr>
                  ) : (
                    items.map((r, i) => (
                      <tr key={r.id}>
                        <td className="td-center">{(page - 1) * pageSize + i + 1}</td>
                        <td className="td-center">{formatTime(r.time)}</td>
                        <td className="td-center">{r.operator}</td>
                        <td className="td-center">
                          {ACTION_TEXT[r.action] ?? r.action_name ?? r.action}
                        </td>
                        <td className="td-center">{r.target_type || '—'}</td>
                        <td className="td-center">{r.target_id ?? '—'}</td>
                        <td className="td-center">{formatAmount(r.amount)}</td>
                        <td>{r.detail || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </div>
      </section>
    </div>
  );
}
