import { request } from './http'

/** 属性条目（规格/做法/单位） */
export interface AttributeItem {
  id: number
  kind: 'spec' | 'method' | 'unit'
  name: string
  preset: boolean
  sort_order: number
  created_at: string
}

export interface AttributePayload {
  kind: 'spec' | 'method' | 'unit'
  name: string
  preset?: boolean
  sort_order?: number
}

/** GET /admin/attributes?kind= 按类型查询 */
export function listAttributesApi(kind?: string): Promise<AttributeItem[]> {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : ''
  return request<AttributeItem[]>(`/admin/attributes${qs}`)
}

/** POST /admin/attributes 新增属性 */
export function createAttributeApi(data: AttributePayload): Promise<AttributeItem> {
  return request<AttributeItem>('/admin/attributes', { method: 'POST', body: data })
}

/** PUT /admin/attributes/:id 更新属性 */
export function updateAttributeApi(
  id: number,
  data: Partial<AttributePayload>,
): Promise<AttributeItem> {
  return request<AttributeItem>(`/admin/attributes/${id}`, { method: 'PUT', body: data })
}

/** DELETE /admin/attributes/:id 删除属性 */
export function deleteAttributeApi(id: number): Promise<void> {
  return request<void>(`/admin/attributes/${id}`, { method: 'DELETE' })
}
