import { useCallback, useEffect, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import Toast, { type ToastData } from '../components/Toast';
import Pagination, { DEFAULT_PAGE_SIZE } from '../components/Pagination';
import {
  CREATE_ROLES,
  createStaff,
  deleteStaff,
  fetchStaffList,
  resetStaffPassword,
  ROLE_LABEL,
  setStaffStatus,
  type StaffItem,
  type StaffRole,
  type StaffStatus,
  updateStaff,
} from '../api/staff';

const INIT_PASSWORD = '123456';

/** 角色下拉展示 */
const ROLE_OPTIONS: { value: StaffRole; label: string }[] = CREATE_ROLES.map((r) => ({
  value: r,
  label: ROLE_LABEL[r],
}));

/** 编辑表单（姓名 + 角色） */
interface EditForm {
  name: string;
  role: StaffRole;
}

/** 创建表单 */
interface CreateForm {
  phone: string;
  name: string;
  role: StaffRole;
  password: string;
}

/** ISO 时间 → YYYY-MM-DD HH:mm:ss */
function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 状态 → UI 标签 */
function renderStatus(s: StaffStatus) {
  const active = s === 'active';
  return (
    <span className={`status-tag ${active ? 'status-on' : 'status-off'}`}>
      {active ? '启用' : '禁用'}
    </span>
  );
}

export default function StaffManage() {
  const [items, setItems] = useState<StaffItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [toast, setToast] = useState<ToastData | null>(null);

  // 弹窗控制
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<StaffItem | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', role: 'cashier' });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    phone: '',
    name: '',
    role: 'cashier',
    password: INIT_PASSWORD,
  });

  const [delTarget, setDelTarget] = useState<StaffItem | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStaffList({ page, page_size: pageSize });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const canToggleStatus = (s: StaffItem) => !s.is_primary; // 店主不可停用

  const canDelete = (s: StaffItem) => !s.is_primary; // 店主不可删

  const openEdit = (s: StaffItem) => {
    setEditing(s);
    setEditForm({ name: s.name, role: s.role });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editing) return;
    const name = editForm.name.trim();
    if (!name) {
      setToast({ type: 'warning', text: '姓名不能为空' });
      return;
    }
    // 店主账号角色永远是 boss，后端会再校验一次
    const role = editing.is_primary ? 'boss' : editForm.role;
    try {
      await updateStaff(editing.id, { name, role });
      setToast({ type: 'success', text: '修改成功' });
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '修改失败' });
    }
  };

  const openCreate = () => {
    setCreateForm({ phone: '', name: '', role: 'cashier', password: INIT_PASSWORD });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const phone = createForm.phone.trim();
    const name = createForm.name.trim();
    const { role, password } = createForm;
    if (!phone) { setToast({ type: 'warning', text: '请输入手机号' }); return; }
    if (!/^1\d{10}$/.test(phone)) { setToast({ type: 'warning', text: '手机号格式不正确' }); return; }
    if (!name) { setToast({ type: 'warning', text: '请输入姓名' }); return; }
    if (!password || password.length < 6) { setToast({ type: 'warning', text: '密码至少 6 位' }); return; }
    try {
      await createStaff({ phone, name, role, password });
      setToast({ type: 'success', text: `创建成功，初始密码 ${password}` });
      setCreateOpen(false);
      await load();
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '创建失败' });
    }
  };

  const toggleStatus = async (s: StaffItem) => {
    const next: StaffStatus = s.status === 'active' ? 'disabled' : 'active';
    try {
      await setStaffStatus(s.id, next);
      setToast({ type: 'success', text: `已${next === 'active' ? '启用' : '禁用'}` });
      await load();
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '操作失败' });
    }
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    try {
      await deleteStaff(delTarget.id);
      setToast({ type: 'success', text: '删除成功' });
      setDelTarget(null);
      await load();
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '删除失败' });
    }
  };

  const confirmReset = async () => {
    if (!resetTarget) return;
    try {
      await resetStaffPassword(resetTarget.id);
      setToast({ type: 'success', text: `密码已重置为 ${INIT_PASSWORD}` });
      setResetTarget(null);
    } catch (e) {
      setToast({ type: 'error', text: (e as Error).message || '重置失败' });
    }
  };

  return (
    <div className="page">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="page-head">
        <h1 className="page-title">员工档案</h1>
        <div className="page-head-actions">
          <button className="tm-btn tm-btn-primary" type="button" onClick={openCreate}>
            + 新建账号
          </button>
        </div>
      </div>

      <section className="panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel-head">
          <div className="panel-title">全部账号（{total}）</div>
        </div>
        <div className="panel-body">
          <div className="data-table table-list">
            <div className="area-table-scroll checkout-scroll">
              <table className="checkout-real-table">
                <colgroup>
                  <col style={{ width: 60 }} />
                  <col style={{ width: 220 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 180 }} />
                  <col style={{ width: 260 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="th-center">序号</th>
                    <th>姓名</th>
                    <th>手机号</th>
                    <th>角色</th>
                    <th className="th-center">状态</th>
                    <th className="th-center">创建时间</th>
                    <th className="th-sticky">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="checkout-empty-cell" colSpan={7}>加载中…</td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td className="checkout-empty-cell" colSpan={7}>暂无账号</td>
                    </tr>
                  ) : (
                    items.map((s, i) => (
                      <tr key={s.id}>
                        <td className="td-center">{(page - 1) * pageSize + i + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {s.is_primary ? (
                              /** 店主：绿色半身人像圆形头像 */
                              <span
                                aria-label="店主"
                                title="店主（激活码激活）"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: '#10b981',
                                  color: '#fff',
                                  flexShrink: 0,
                                }}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  {/* 头部 */}
                                  <circle cx="12" cy="8" r="4" fill="#fff" />
                                  {/* 肩膀/上半身 */}
                                  <path
                                    d="M4 22c0-4.418 3.582-8 8-8s8 3.582 8 8"
                                    fill="#fff"
                                  />
                                </svg>
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: 'var(--color-surface2)',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <span style={{ fontWeight: s.is_primary ? 600 : 'normal' }}>{s.name}</span>
                          </div>
                        </td>
                        <td>{s.phone}</td>
                        <td>{ROLE_LABEL[s.role]}</td>
                        <td className="td-center">{renderStatus(s.status)}</td>
                        <td className="td-center">{fmt(s.created_at)}</td>
                        <td className="td-sticky">
                          <div className="row-actions">
                            <button
                              className="action-link"
                              type="button"
                              onClick={() => openEdit(s)}
                            >
                              编辑
                            </button>
                            <button
                              className="action-link"
                              type="button"
                              onClick={() => setResetTarget(s)}
                            >
                              重置密码
                            </button>
                            {canToggleStatus(s) && (
                              <button
                                className={`action-link ${s.status === 'active' ? 'danger' : ''}`}
                                type="button"
                                onClick={() => toggleStatus(s)}
                              >
                                {s.status === 'active' ? '禁用' : '启用'}
                              </button>
                            )}
                            {canDelete(s) && (
                              <button
                                className="action-link danger"
                                type="button"
                                onClick={() => setDelTarget(s)}
                              >
                                删除
                              </button>
                            )}
                          </div>
                        </td>
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

      {/* 编辑账号（姓名 + 角色） */}
      {editOpen && editing && (
        <div className="modal-mask" onClick={() => setEditOpen(false)}>
          <div className="modal-card" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">编辑账号</div>
              <button className="modal-close" aria-label="关闭" type="button" onClick={() => setEditOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="dish-form-item">
                <label className="dish-form-item-label">姓名</label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    maxLength={32}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label">角色</label>
                <div className="dish-form-item-control">
                  <select
                    className="category-select"
                    value={editForm.role}
                    disabled={editing.is_primary}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as StaffRole })}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 4, color: 'var(--color-text-2)', fontSize: 12 }}>
                手机号由账号创建时确定，此处不可修改。店铺激活时的主账号由 is_primary 标记。
                {editing.is_primary && (
                  <span style={{ color: 'var(--color-warning)', marginLeft: 4 }}>店主账号角色不可修改</span>
                )}
              </div>
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setEditOpen(false)}>取消</button>
              <button className="tm-btn tm-btn-primary" type="button" onClick={submitEdit}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 新建账号 */}
      {createOpen && (
        <div className="modal-mask" onClick={() => setCreateOpen(false)}>
          <div className="modal-card" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">新建账号</div>
              <button className="modal-close" aria-label="关闭" type="button" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="dish-form-item">
                <label className="dish-form-item-label"><span className="required-mark">*</span>手机号</label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    placeholder="11 位手机号"
                    maxLength={11}
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label"><span className="required-mark">*</span>姓名</label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    placeholder="员工姓名"
                    maxLength={32}
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label"><span className="required-mark">*</span>角色</label>
                <div className="dish-form-item-control">
                  <select
                    className="category-select"
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as StaffRole })}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="dish-form-item">
                <label className="dish-form-item-label">初始密码</label>
                <div className="dish-form-item-control">
                  <input
                    type="text"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ marginTop: 4, color: 'var(--color-text-2)', fontSize: 12 }}>
                初始密码默认 123456，员工首次登录后可在收银机上修改。
                老板角色可查看全部报表、管理员工、配置系统，等同于合伙人权限。
              </div>
            </div>
            <div className="modal-foot">
              <button className="tm-btn tm-btn-default" type="button" onClick={() => setCreateOpen(false)}>取消</button>
              <button className="tm-btn tm-btn-primary" type="button" onClick={submitCreate}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除账号 */}
      <ConfirmModal
        open={!!delTarget}
        title="确认删除"
        message={`确定删除账号「${delTarget?.name ?? ''}」（${delTarget?.phone ?? ''}）？删除后该账号将无法登录，不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDelTarget(null)}
      />

      {/* 重置密码 */}
      <ConfirmModal
        open={!!resetTarget}
        title="重置密码"
        message={`确定将「${resetTarget?.name ?? ''}」的密码重置为 ${INIT_PASSWORD} 吗？该账号下次登录需使用新密码。`}
        confirmText="重置"
        cancelText="取消"
        onConfirm={confirmReset}
        onCancel={() => setResetTarget(null)}
      />
    </div>
  );
}
