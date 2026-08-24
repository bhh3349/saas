import { request } from './http'

/** 区域（后端 GET /admin/areas 返回的条目） */
export interface AreaItem {
  id: number
  name: string
  sort: number
  /** 该区域下的桌台数量 */
  tableCount: number
}

/** GET /admin/areas 区域列表（含桌台数量） */
export function listAreasApi(): Promise<AreaItem[]> {
  return request<AreaItem[]>('/admin/areas')
}

/** POST /admin/areas 批量新增区域（names 自动去重） */
export function createAreasApi(names: string[]): Promise<AreaItem[]> {
  return request<AreaItem[]>('/admin/areas', { method: 'POST', body: { names } })
}

/** PUT /admin/areas/sort 区域排序 */
export function sortAreasApi(items: { id: number; sort: number }[]): Promise<AreaItem[]> {
  return request<AreaItem[]>('/admin/areas/sort', { method: 'PUT', body: { items } })
}

/** PUT /admin/areas/:id 编辑区域名称 */
export function updateAreaApi(id: number, name: string): Promise<AreaItem[]> {
  return request<AreaItem[]>(`/admin/areas/${id}`, { method: 'PUT', body: { name } })
}

/** DELETE /admin/areas/:id 删除区域（区域下有桌台时后端会拒绝） */
export function deleteAreaApi(id: number): Promise<void> {
  return request<void>(`/admin/areas/${id}`, { method: 'DELETE' })
}
