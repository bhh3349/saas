import { request } from './http'

/** 员工角色（内部小写，UI 显示中文名） */
export type StaffRole = 'boss' | 'cashier' | 'finance'

/** 员工状态 */
export type StaffStatus = 'active' | 'disabled'

/** 账号列表项 */
export interface StaffItem {
  id: number
  phone: string
  name: string
  role: StaffRole
  /** 是否店主（激活码激活，拥有最高权限，UI 角色列显示"老板"并带店主徽标） */
  is_primary: boolean
  status: StaffStatus
  created_at: string
}

/** 创建账号请求体 */
export interface CreateStaffBody {
  phone: string
  password: string
  name: string
  role: StaffRole
}

/** 更新账号请求体（姓名 / 角色） */
export interface UpdateStaffBody {
  name?: string
  role?: StaffRole
}

/** 角色显示映射（后端 role → UI 中文名） */
export const ROLE_LABEL: Record<StaffRole, string> = {
  boss: '老板',
  cashier: '收银员',
  finance: '财务',
}

/** 可选创建角色（老板/收银员/财务） */
export const CREATE_ROLES: StaffRole[] = ['boss', 'cashier', 'finance']

/** GET /admin/staff 账号列表（含店主，店主排第一） */
export async function fetchStaffList(params?: { page?: number; page_size?: number }): Promise<{ total: number; items: StaffItem[] }> {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  const q = qs.toString()
  return request(`/admin/staff${q ? `?${q}` : ''}`)
}

/** POST /admin/staff 创建账号 */
export function createStaff(body: CreateStaffBody): Promise<StaffItem> {
  return request('/admin/staff', { method: 'POST', body })
}

/** PUT /admin/staff/:id 更新账号（姓名 / 角色） */
export function updateStaff(id: number, body: UpdateStaffBody): Promise<StaffItem> {
  return request(`/admin/staff/${id}`, { method: 'PUT', body })
}

/** POST /admin/staff/:id/status 停用/启用 */
export function setStaffStatus(id: number, status: StaffStatus): Promise<StaffItem> {
  return request(`/admin/staff/${id}/status`, { method: 'POST', body: { status } })
}

/** POST /admin/staff/:id/reset-password 重置密码（默认 123456） */
export function resetStaffPassword(id: number, new_password?: string): Promise<StaffItem> {
  return request(`/admin/staff/${id}/reset-password`, { method: 'POST', body: new_password ? { new_password } : {} })
}

/** DELETE /admin/staff/:id 删除账号 */
export function deleteStaff(id: number): Promise<{ message: string }> {
  return request(`/admin/staff/${id}`, { method: 'DELETE' })
}
