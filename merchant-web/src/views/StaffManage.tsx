import { useEffect, useMemo, useState } from 'react';
import SearchForm from '../components/SearchForm';
import ConfirmModal from '../components/ConfirmModal';
import Toast, { type ToastData } from '../components/Toast';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/Pagination';
import { getBucket, putBucket } from '../api/buckets';

/** 员工配置桶 key */
const BUCKET_KEY = 'staff';

/** 员工状态 */
type StaffStatus = '启用' | '禁用';

/** 员工档案 */
interface Staff {
  id: string;
  staffNo: string;
  name: string;
  phone: string;
  account: string;
  role: string;
  status: StaffStatus;
  createdAt: string;
}

/** 新增/编辑表单 */
interface StaffForm {
  id: string | null;
  name: string;
  phone: string;
  account: string;
  role: string;
  status: StaffStatus;
}

/** 项目固定三种角色（不开放自定义） */
const ROLES = ['老板', '收银员', '财务'];

/** 新建员工初始密码 */
const INIT_PASSWORD = '123456';

const emptyForm: StaffForm = {
  id: null,
  name: '',
  phone: '',
  account: '',
  role: '收银员',
  status: '启用',
};

/** 生成员工编号 */
function genStaffNo(list: Staff[]): string {
  const maxNo = list.reduce((m, s) => {
    const n = Number(s.staffNo);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return String(maxNo + 1).padStart(5, '0');
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function StaffManage() {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState({ name: '', phone: '', account: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [resetId, setResetId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const filtered = useMemo(() => {
    return staffs.filter((s) => {
      if (search.name && !s.name.includes(search.name)) return false;
      if (search.phone && !s.phone.includes(search.phone)) return false;
      if (search.account && !s.account.includes(search.account)) return false;
      return true;
    });
  }, [staffs, search]);

  const pageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  /** 从云端加载员工列表 */
  useEffect(() => {
    let active = true;
    getBucket<Staff[]>(BUCKET_KEY)
      .then((data) => {
        if (active && Array.isArray(data)) setStaffs(data);
      })
      .catch(() => {
        /* 忽略加载失败 */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /** 保存员工列表到云端 */
  const persist = async (next: Staff[]) => {
    setStaffs(next);
    try {
      await putBucket(BUCKET_KEY, next);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '保存失败' });
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSearchChange = (key: string, value: string) => {
    setSearch((prev) => ({ ...prev, [key]: value }));
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({ id: s.id, name: s.name, phone: s.phone, account: s.account, role: s.role, status: s.status });
    setModalOpen(true);
  };

  const updateForm = <K extends keyof StaffForm>(key: K, value: StaffForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitForm = async () => {
    const name = form.name.trim();
    const phone = form.phone.trim();
    const account = form.account.trim();
    if (!name) {
      setToast({ type: 'warning', text: '请输入姓名' });
      return;
    }
    if (!phone) {
      setToast({ type: 'warning', text: '请输入手机号' });
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      setToast({ type: 'warning', text: '请输入正确的 11 位手机号' });
      return;
    }
    if (!account) {
      setToast({ type: 'warning', text: '请输入登录账号' });
      return;
    }
    if (staffs.some((s) => s.account === account && s.id !== editing?.id)) {
      setToast({ type: 'warning', text: '该账号已被使用' });
      return;
    }
    if (editing) {
      await persist(
        staffs.map((s) =>
          s.id === editing.id ? { ...s, name, phone, account, role: form.role, status: form.status } : s,
        ),
      );
      setToast({ type: 'success', text: '修改成功' });
    } else {
      await persist([
        ...staffs,
        {
          id: `s_${Date.now()}`,
          staffNo: genStaffNo(staffs),
          name,
          phone,
          account,
          role: form.role,
          status: form.status,
          createdAt: today(),
        },
      ]);
      setToast({ type: 'success', text: `创建成功，初始密码 ${INIT_PASSWORD}` });
    }
    setModalOpen(false);
  };

  const toggleStatus = async (s: Staff) => {
    const next: StaffStatus = s.status === '启用' ? '禁用' : '启用';
    await persist(staffs.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
    setToast({ type: 'success', text: `已${next}` });
  };

  const confirmReset = () => {
    if (!resetId) return;
    setToast({ type: 'success', text: `密码已重置为 ${INIT_PASSWORD}` });
    setResetId(null);
  };

  const confirmDelete = async () => {
    if (!delId) return;
    await persist(staffs.filter((s) => s.id !== delId));
    setToast({ type: 'success', text: '删除成功' });
    setDelId(null);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">员工档案</h1>
        <div className="page-actions">
          <button className="saas-btn saas-btn-primary" onClick={openAdd}>
            创建员工账号
          </button>
        </div>
      </div>

      <div className="checkout-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 查询栏 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <SearchForm
            fields={[
              { key: 'name', label: '姓名', placeholder: '请输入', width: 130 },
              { key: 'phone', label: '手机号', placeholder: '请输入', width: 140 },
              { key: 'account', label: '账号', placeholder: '请输入', width: 140 },
            ]}
            values={search}
            onChange={handleSearchChange}
            onSearch={() => setCurrentPage(1)}
            onReset={() => setSearch({ name: '', phone: '', account: '' })}
          />
        </div>

        {/* 表格 */}
        <div className="data-table checkout-table" style={{ flex: 1 }}>
          <div className="area-table-scroll checkout-scroll">
            <table className="checkout-real-table">
              <colgroup>
                <col style={{ width: 80 }} />
                <col />
                <col style={{ width: 140 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 210 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="th-center">员工编号</th>
                  <th>姓名</th>
                  <th>手机号</th>
                  <th>账号</th>
                  <th className="th-center">角色</th>
                  <th className="th-center">状态</th>
                  <th className="th-sticky">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td className="checkout-empty-cell" colSpan={7}>
                      {loading ? '加载中…' : '暂无数据'}
                    </td>
                  </tr>
                ) : (
                  pageData.map((s) => (
                    <tr key={s.id}>
                      <td className="td-center">{s.staffNo}</td>
                      <td>{s.name}</td>
                      <td>{s.phone}</td>
                      <td>{s.account}</td>
                      <td className="td-center">{s.role}</td>
                      <td className="td-center">
                        <span className={`status-tag ${s.status === '启用' ? 'status-on' : 'status-off'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="td-sticky">
                        <div className="row-actions">
                          <button className="action-link" onClick={() => openEdit(s)}>编辑</button>
                          <button className="action-link" onClick={() => setResetId(s.id)}>重置密码</button>
                          <button
                            className={`action-link ${s.status === '启用' ? 'danger' : ''}`}
                            onClick={() => toggleStatus(s)}
                          >
                            {s.status === '启用' ? '禁用' : '启用'}
                          </button>
                          <button className="action-link danger" onClick={() => setDelId(s.id)}>删除</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 分页 */}
        <Pagination
          total={filtered.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* 新增/编辑弹窗 */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content checkout-modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? '编辑员工' : '创建员工账号'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body checkout-form-lg">
              <div className="checkout-form-row">
                <label><span className="required-mark">*</span>姓名：</label>
                <input
                  className="ant-input"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="请输入姓名"
                />
              </div>
              <div className="checkout-form-row">
                <label><span className="required-mark">*</span>手机号：</label>
                <input
                  className="ant-input"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  placeholder="请输入 11 位手机号"
                />
              </div>
              <div className="checkout-form-row">
                <label><span className="required-mark">*</span>账号：</label>
                <input
                  className="ant-input"
                  value={form.account}
                  onChange={(e) => updateForm('account', e.target.value)}
                  placeholder="登录账号，用于收银机登录"
                />
              </div>
              <div className="checkout-form-row">
                <label><span className="required-mark">*</span>角色：</label>
                <div className="checkout-form-control">
                  <select
                    className="ant-input"
                    style={{ width: 200 }}
                    value={form.role}
                    onChange={(e) => updateForm('role', e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-ink-tertiary)' }}>
                    收银员仅收银，财务仅看账
                  </span>
                </div>
              </div>
              <div className="checkout-form-row">
                <label>状态：</label>
                <div className="checkout-form-control">
                  <div className="radio-group">
                    {(['启用', '禁用'] as const).map((st) => (
                      <label key={st} className="radio-item">
                        <input
                          type="radio"
                          name="staffStatus"
                          checked={form.status === st}
                          onChange={() => updateForm('status', st)}
                        />
                        <span>{st}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {!editing && (
                <div className="checkout-form-desc" style={{ marginTop: 4 }}>
                  新建员工初始密码为 {INIT_PASSWORD}，首次登录后可在收银机上修改
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="saas-btn saas-btn-default" onClick={() => setModalOpen(false)}>取消</button>
              <button className="saas-btn saas-btn-primary" onClick={submitForm}>保存</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!resetId}
        title="重置密码"
        message={`确定将「${staffs.find((s) => s.id === resetId)?.name ?? ''}」的密码重置为初始密码 ${INIT_PASSWORD} 吗？`}
        confirmText="重置"
        onConfirm={confirmReset}
        onCancel={() => setResetId(null)}
      />
      <ConfirmModal
        open={!!delId}
        title="确认删除"
        message="确定删除该员工吗？删除后该账号将无法登录收银机。"
        onConfirm={confirmDelete}
        onCancel={() => setDelId(null)}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
