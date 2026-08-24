import { request } from './http'

/** 桌台（后端 GET /admin/tables 返回的条目） */
export interface TableItem {
  id: number
  name: string
  area: string
  capacity: number
  status: string
  created_at: string
  /** 用餐人数范围下限（可选） */
  seats_min?: number
  /** 用餐人数范围上限（可选） */
  seats_max?: number
  /** 数字助记码（可选） */
  mnemonic?: string
  /** 桌台类型：2=堂食 1=非堂食 */
  table_type?: number
  /** 管理预订支持渠道（1=预订台预订） */
  can_book_channels?: number[]
}

export interface TableListResult {
  total: number
  items: TableItem[]
}

export interface TablePayload {
  name: string
  area?: string
  capacity?: number
  seats_min?: number
  seats_max?: number
  mnemonic?: string
  table_type?: number
  can_book_channels?: number[]
}

/** GET /admin/tables 后台分页列表（老板） */
export function listTablesApi(
  params: {
    page?: number
    page_size?: number
    status?: string
    /** 按区域名精确过滤 */
    area?: string
    /** 按桌台名称模糊搜索 */
    name?: string
  } = {},
): Promise<TableListResult> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.page_size) q.set('page_size', String(params.page_size))
  if (params.status) q.set('status', params.status)
  if (params.area) q.set('area', params.area)
  if (params.name) q.set('name', params.name)
  const qs = q.toString()
  return request<TableListResult>(`/admin/tables${qs ? `?${qs}` : ''}`)
}

/** POST /admin/tables 新增桌台 */
export function createTableApi(data: TablePayload): Promise<TableItem> {
  return request<TableItem>('/admin/tables', { method: 'POST', body: data })
}

/** POST /admin/tables/import 批量导入桌台 */
export function importTablesApi(items: TablePayload[]): Promise<{ count: number }> {
  return request<{ count: number }>('/admin/tables/import', {
    method: 'POST',
    body: { items },
  })
}

/** GET /admin/tables/export 导出桌台（可按区域过滤，返回全量） */
export function exportTablesApi(area?: string): Promise<TableItem[]> {
  const qs = area ? `?area=${encodeURIComponent(area)}` : ''
  return request<TableItem[]>(`/admin/tables/export${qs}`)
}

/** PUT /admin/tables/:id 更新桌台 */
export function updateTableApi(id: number, data: Partial<TablePayload>): Promise<TableItem> {
  return request<TableItem>(`/admin/tables/${id}`, { method: 'PUT', body: data })
}

/** DELETE /admin/tables/:id 删除桌台（仅空闲） */
export function deleteTableApi(id: number): Promise<void> {
  return request<void>(`/admin/tables/${id}`, { method: 'DELETE' })
}

/** GET /tables 本店全部桌台（收银/聚合区域用） */
export function allTablesApi(): Promise<TableItem[]> {
  return request<TableItem[]>('/tables')
}
