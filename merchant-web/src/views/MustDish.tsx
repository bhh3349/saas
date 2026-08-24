import { useEffect, useMemo, useState } from 'react';
import SearchForm from '../components/SearchForm';
import ConfirmModal from '../components/ConfirmModal';
import Toast, { type ToastData } from '../components/Toast';
import { getBucket, putBucket } from '../api/buckets';
import { listAllDishesApi } from '../api/dishes';

/** 必点菜方案桶 key */
const BUCKET_KEY = 'mustdish';

/** 必点菜方案 */
interface MustDishScheme {
  id: string;
  name: string;
  channels: string[];
  type: '每人必点' | '每笔订单必点';
  rule: '固定菜品' | '可选菜品';
  count: number;
  status: '启用' | '停用';
  areas: string[];
  source: '门店自建';
  dishes: string[];
}

const CHANNEL_OPTIONS = [
  '店内收银（桌台点餐模式）',
  '店内收银（直接点餐模式）',
  '扫码点餐（桌台点餐模式）',
];

const AREA_OPTIONS = ['大厅', '包间', '卡座', '露台'];

export default function MustDish() {
  const [schemes, setSchemes] = useState<MustDishScheme[]>([]);
  /** 后端菜品名称（关联菜品选择用） */
  const [dishNames, setDishNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState({ name: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MustDishScheme | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const empty: MustDishScheme = {
    id: '',
    name: '',
    channels: [],
    type: '每笔订单必点',
    rule: '固定菜品',
    count: 1,
    status: '启用',
    areas: ['全部'],
    source: '门店自建',
    dishes: [],
  };
  const [form, setForm] = useState<MustDishScheme>(empty);

  /** 从云端加载必点菜方案与菜品名 */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getBucket<MustDishScheme[]>(BUCKET_KEY);
        if (active && Array.isArray(data)) setSchemes(data);
      } catch {
        /* 忽略加载失败 */
      }
      try {
        const dishes = await listAllDishesApi();
        if (active) setDishNames(dishes.map((d) => d.name));
      } catch {
        /* 忽略加载失败 */
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  /** 保存方案到云端 */
  const persist = async (next: MustDishScheme[]) => {
    setSchemes(next);
    try {
      await putBucket(BUCKET_KEY, next);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  const filtered = useMemo(() => {
    return schemes.filter((s) => {
      if (search.name && !s.name.includes(search.name)) return false;
      return true;
    });
  }, [schemes, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...empty, id: Date.now().toString() });
    setModalOpen(true);
  };

  const openEdit = (s: MustDishScheme) => {
    setEditing(s);
    setForm({ ...s });
    setModalOpen(true);
  };

  const openView = (s: MustDishScheme) => {
    setEditing(s);
    setViewOpen(true);
  };

  const toggleStatus = async (s: MustDishScheme) => {
    const next = s.status === '启用' ? '停用' : '启用';
    await persist(schemes.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
    setToast({ type: 'success', text: `已${next}「${s.name}」` });
  };

  const confirmDelete = async () => {
    if (!delId) return;
    await persist(schemes.filter((x) => x.id !== delId));
    setToast({ type: 'success', text: '删除成功' });
    setDelId(null);
  };

  const submitForm = async () => {
    if (!form.name.trim()) {
      setToast({ type: 'warning', text: '请输入方案名称' });
      return;
    }
    if (editing) {
      await persist(schemes.map((x) => (x.id === editing.id ? form : x)));
      setToast({ type: 'success', text: '修改成功' });
    } else {
      await persist([...schemes, form]);
      setToast({ type: 'success', text: '添加成功' });
    }
    setModalOpen(false);
  };

  const updateForm = <K extends keyof MustDishScheme>(key: K, value: MustDishScheme[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleChannel = (ch: string) => {
    setForm((prev) => {
      const has = prev.channels.includes(ch);
      return { ...prev, channels: has ? prev.channels.filter((c) => c !== ch) : [...prev.channels, ch] };
    });
  };

  const toggleDish = (d: string) => {
    setForm((prev) => {
      const has = prev.dishes.includes(d);
      return { ...prev, dishes: has ? prev.dishes.filter((x) => x !== d) : [...prev.dishes, d] };
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">必点菜设置</h1>
        <div className="page-actions">
          <button className="saas-btn saas-btn-primary" onClick={openAdd}>
            添加必点菜方案
          </button>
        </div>
      </div>

      <div className="checkout-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <SearchForm
            fields={[{ key: 'name', label: '方案名称', placeholder: '请输入', width: 200 }]}
            values={search}
            onChange={(k, v) => setSearch((p) => ({ ...p, [k]: v }))}
            onSearch={() => {}}
            onReset={() => setSearch({ name: '' })}
          />
        </div>

        <div className="data-table checkout-table">
          <div className="area-table-scroll checkout-scroll">
            <table className="checkout-real-table">
              <colgroup>
                <col style={{ width: 140 }} />
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 180 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>方案名称</th>
                  <th>方案适用渠道</th>
                  <th>必点类型</th>
                  <th>必点规则</th>
                  <th className="th-center">启用状态</th>
                  <th>桌台区域</th>
                  <th className="th-center">来源</th>
                  <th className="th-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td className="checkout-empty-cell" colSpan={8}>
                      {loading ? '加载中…' : '暂无数据'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.channels.join('，')}</td>
                      <td>{s.type}{s.count}份</td>
                      <td>{s.rule}</td>
                      <td className="td-center">
                        <span className={`status-tag ${s.status === '启用' ? 'status-on' : 'status-off'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>{s.areas.join('，')}</td>
                      <td className="td-center">{s.source}</td>
                      <td className="td-center">
                        <a className="link" onClick={() => openView(s)}>查看</a>
                        <a className="link" onClick={() => toggleStatus(s)}>{s.status === '启用' ? '停用' : '启用'}</a>
                        <a className="link" onClick={() => setDelId(s.id)}>删除</a>
                        <a className="link" onClick={() => openEdit(s)}>编辑</a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 新增/编辑弹窗 */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content checkout-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? '编辑必点菜方案' : '添加必点菜方案'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body checkout-form-lg">
              <div className="checkout-form-row">
                <label><span className="required-mark">*</span>方案名称：</label>
                <input
                  className="ant-input"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="请输入方案名称"
                />
              </div>
              <div className="checkout-form-row">
                <label>适用渠道：</label>
                <div className="checkout-form-control">
                  <div className="radio-group">
                    {CHANNEL_OPTIONS.map((ch) => (
                      <label key={ch} className="radio-item">
                        <input
                          type="checkbox"
                          checked={form.channels.includes(ch)}
                          onChange={() => toggleChannel(ch)}
                        />
                        <span>{ch}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="checkout-form-row">
                <label>必点类型：</label>
                <div className="checkout-form-control">
                  <div className="radio-group">
                    {(['每人必点', '每笔订单必点'] as const).map((t) => (
                      <label key={t} className="radio-item">
                        <input
                          type="radio"
                          name="mustType"
                          checked={form.type === t}
                          onChange={() => updateForm('type', t)}
                        />
                        <span>{t}</span>
                      </label>
                    ))}
                  </div>
                  <input
                    className="ant-input"
                    style={{ width: 80, marginLeft: 12 }}
                    type="number"
                    min={1}
                    value={form.count}
                    onChange={(e) => updateForm('count', Number(e.target.value))}
                  />
                  <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--color-ink-muted)' }}>份</span>
                </div>
              </div>
              <div className="checkout-form-row">
                <label>必点规则：</label>
                <div className="checkout-form-control">
                  <div className="radio-group">
                    {(['固定菜品', '可选菜品'] as const).map((r) => (
                      <label key={r} className="radio-item">
                        <input
                          type="radio"
                          name="mustRule"
                          checked={form.rule === r}
                          onChange={() => updateForm('rule', r)}
                        />
                        <span>{r}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="checkout-form-row">
                <label>关联菜品：</label>
                <div className="checkout-form-control">
                  <div className="radio-group">
                    {dishNames.map((d) => (
                      <label key={d} className="radio-item">
                        <input
                          type="checkbox"
                          checked={form.dishes.includes(d)}
                          onChange={() => toggleDish(d)}
                        />
                        <span>{d}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="checkout-form-row">
                <label>桌台区域：</label>
                <div className="checkout-form-control">
                  <div className="radio-group">
                    {AREA_OPTIONS.map((a) => (
                      <label key={a} className="radio-item">
                        <input
                          type="checkbox"
                          checked={form.areas.includes(a) || form.areas.includes('全部')}
                          onChange={() => {
                            const has = form.areas.includes(a);
                            updateForm('areas', has ? form.areas.filter((x) => x !== a) : [...form.areas, a]);
                          }}
                        />
                        <span>{a}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="saas-btn saas-btn-default" onClick={() => setModalOpen(false)}>取消</button>
              <button className="saas-btn saas-btn-primary" onClick={submitForm}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 查看弹窗 */}
      {viewOpen && editing && (
        <div className="modal-overlay" onClick={() => setViewOpen(false)}>
          <div className="modal-content checkout-modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>方案详情</h3>
              <button className="modal-close" onClick={() => setViewOpen(false)}>&times;</button>
            </div>
            <div className="modal-body checkout-view">
              <div className="checkout-view-row"><span className="checkout-view-label">方案名称：</span><span className="checkout-view-value">{editing.name}</span></div>
              <div className="checkout-view-row"><span className="checkout-view-label">适用渠道：</span><span className="checkout-view-value">{editing.channels.join('，')}</span></div>
              <div className="checkout-view-row"><span className="checkout-view-label">必点类型：</span><span className="checkout-view-value">{editing.type}{editing.count}份</span></div>
              <div className="checkout-view-row"><span className="checkout-view-label">必点规则：</span><span className="checkout-view-value">{editing.rule}</span></div>
              <div className="checkout-view-row"><span className="checkout-view-label">关联菜品：</span><span className="checkout-view-value">{editing.dishes.join('，') || '-'}</span></div>
              <div className="checkout-view-row"><span className="checkout-view-label">桌台区域：</span><span className="checkout-view-value">{editing.areas.join('，')}</span></div>
              <div className="checkout-view-row"><span className="checkout-view-label">启用状态：</span><span className="checkout-view-value">{editing.status}</span></div>
              <div className="checkout-view-row"><span className="checkout-view-label">来源：</span><span className="checkout-view-value">{editing.source}</span></div>
            </div>
            <div className="modal-footer">
              <button className="saas-btn saas-btn-default" onClick={() => setViewOpen(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!delId}
        title="确认删除"
        message="确定删除该必点菜方案吗？删除后不可恢复。"
        onConfirm={confirmDelete}
        onCancel={() => setDelId(null)}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
