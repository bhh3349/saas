import { request } from './http'

/** 套餐分组内菜品（price 为分） */
export interface SetmealGroupDish {
  id: number
  name: string
  category: string
  price: number
  type: string
  weight?: number
}

/** 套餐分组 */
export interface SetmealGroup {
  name: string
  /** 组类型：固定 / 可选 / 2选1 等 */
  type: string
  min_choose?: number
  dishes: SetmealGroupDish[]
}

/** 套餐条目 */
export interface SetmealItem {
  id: number
  code: string
  name: string
  category: string
  /** 价格（分） */
  price: number
  groups: SetmealGroup[]
  print_enable: boolean
  print_dept: string
  status: string
  min_amount: number
  created_at: string
}

export interface SetmealPayload {
  code?: string
  name: string
  category?: string
  /** 价格（分） */
  price: number
  groups: SetmealGroup[]
  print_enable?: boolean
  print_dept?: string
  status?: string
  min_amount?: number
}

/** GET /admin/setmeals 本店套餐列表 */
export function listSetmealsApi(): Promise<SetmealItem[]> {
  return request<SetmealItem[]>('/admin/setmeals')
}

/** POST /admin/setmeals 新增套餐 */
export function createSetmealApi(data: SetmealPayload): Promise<SetmealItem> {
  return request<SetmealItem>('/admin/setmeals', { method: 'POST', body: data })
}

/** PUT /admin/setmeals/:id 更新套餐 */
export function updateSetmealApi(id: number, data: Partial<SetmealPayload>): Promise<SetmealItem> {
  return request<SetmealItem>(`/admin/setmeals/${id}`, { method: 'PUT', body: data })
}

/** DELETE /admin/setmeals/:id 删除套餐 */
export function deleteSetmealApi(id: number): Promise<void> {
  return request<void>(`/admin/setmeals/${id}`, { method: 'DELETE' })
}
