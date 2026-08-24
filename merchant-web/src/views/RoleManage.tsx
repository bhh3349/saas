import { useEffect, useState } from 'react';
import SearchForm from '../components/SearchForm';
import Toast, { type ToastData } from '../components/Toast';
import { getBucket } from '../api/buckets';

/** 角色 / 员工配置桶 key */
const ROLE_BUCKET = 'role';
const STAFF_BUCKET = 'staff';

/** 角色状态 */
type RoleStatus = '启用' | '禁用';

/** 角色档案 */
interface RoleInfo {
  id: string;
  name: string;
  /** 权限项 */
  permissions: string[];
  status: RoleStatus;
}

/** 系统权限项清单 */
const PERMISSIONS = [
  '收银工作台（开台 / 点餐 / 接单 / 结账）',
  '菜品管理（菜品库 / 菜品分类 / 菜品属性）',
  '桌台管理',
  '结账方式管理',
  '门店档案',
  '员工档案',
  '角色档案',
  '营业数据查看',
];

/** 项目固定三种角色（不开放自定义） */
const DEFAULT_ROLES: RoleInfo[] = [
  {
    id: '1',
    name: '老板',
    permissions: [...PERMISSIONS],
    status: '启用',
  },
  {
    id: '2',
    name: '收银员',
    permissions: ['收银工作台（开台 / 点餐 / 接单 / 结账）'],
    status: '启用',
  },
  {
    id: '3',
    name: '财务',
    permissions: ['营业数据查看'],
    status: '启用',
  },
];

interface StaffLike {
  role: string;
}

/** 角色权限范围一句话描述 */
function roleScope(name: string): string {
  switch (name) {
    case '老板':
      return '全功能（收银 + 后台管理 + 看账）';
    case '收银员':
      return '仅收银工作台';
    case '财务':
      return '仅看账';
    default:
      return '';
  }
}

export default function RoleManage() {
  const [roles, setRoles] = useState<RoleInfo[]>(DEFAULT_ROLES);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [keyword, setKeyword] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  /** 从云端加载角色列表与各角色绑定账号数（员工数） */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getBucket<RoleInfo[]>(ROLE_BUCKET);
        if (active && Array.isArray(data) && data.length) setRoles(data);
      } catch {
        /* 忽略加载失败 */
      }
      try {
        const staffs = await getBucket<StaffLike[]>(STAFF_BUCKET);
        if (active && Array.isArray(staffs)) {
          const map: Record<string, number> = {};
          staffs.forEach((s) => {
            if (s && s.role) map[s.role] = (map[s.role] ?? 0) + 1;
          });
          setRoleCounts(map);
        }
      } catch {
        /* 忽略加载失败 */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = roles.filter((r) => !keyword || r.name.includes(keyword));

  const viewTarget = viewId ? roles.find((r) => r.id === viewId) ?? null : null;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">角色档案</h1>
        <div className="page-actions">
          <span className="checkout-form-desc">角色固定为老板 / 收银员 / 财务，不开放自定义</span>
        </div>
      </div>

      <div className="checkout-panel">
        {/* 查询栏 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <SearchForm
            fields={[{ key: 'name', label: '角色名称', placeholder: '请输入', width: 180 }]}
            values={{ name: keyword }}
            onChange={(_, v) => setKeyword(v)}
            onSearch={() => undefined}
            onReset={() => setKeyword('')}
          />
        </div>

        {/* 表格 */}
        <div className="data-table checkout-table">
          <div className="area-table-scroll checkout-scroll">
            <table className="checkout-real-table">
              <colgroup>
                <col style={{ width: 60 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 110 }} />
                <col />
                <col style={{ width: 90 }} />
                <col style={{ width: 120 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="th-center">序号</th>
                  <th>角色名称</th>
                  <th className="th-center">绑定账号数</th>
                  <th>权限范围</th>
                  <th className="th-center">状态</th>
                  <th className="th-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td className="checkout-empty-cell" colSpan={6}>暂无数据</td>
                  </tr>
                ) : (
                  filtered.map((r, i) => (
                    <tr key={r.id}>
                      <td className="td-center">{i + 1}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{r.name}</span>
                      </td>
                      <td className="td-center">{roleCounts[r.name] ?? 0}</td>
                      <td>{roleScope(r.name)}</td>
                      <td className="td-center">
                        <span className={`status-tag ${r.status === '启用' ? 'status-on' : 'status-off'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="td-center">
                        <a className="link" onClick={() => setViewId(r.id)}>查看权限</a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 查看权限弹窗 */}
      {viewTarget && (
        <div className="modal-overlay" onClick={() => setViewId(null)}>
          <div className="modal-content checkout-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{viewTarget.name} · 权限明细</h3>
              <button className="modal-close" onClick={() => setViewId(null)}>&times;</button>
            </div>
            <div className="modal-body checkout-form-lg">
              <div className="checkout-form-desc" style={{ marginBottom: 12 }}>
                以下为「{viewTarget.name}」角色可访问的功能范围（系统固定，不可修改）
              </div>
              {PERMISSIONS.map((p) => {
                const granted = viewTarget.permissions.includes(p);
                return (
                  <div className="checkout-form-row" key={p}>
                    <label style={{ fontWeight: granted ? 600 : 400 }}>
                      <input
                        type="checkbox"
                        checked={granted}
                        disabled
                        style={{ marginRight: 8, accentColor: 'var(--color-primary)' }}
                      />
                      {p}
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="modal-footer">
              <button className="saas-btn saas-btn-default" onClick={() => setViewId(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
