import { request } from './http'

/** 菜品规格（加价，元） */
export interface DishSpecItem {
  name: string
  price_delta: number
}

/** 后端菜品条目 */
export interface DishItem {
  id: number
  name: string
  category: string
  /** 单价（元） */
  price: number
  specs: DishSpecItem[]
  code: string
  spec_code: string
  /** 普通菜 / 称重菜 */
  type: string
  sort_order: number
  status: string
  sold_out: boolean
  created_at: string
}

export interface DishListResult {
  total: number
  items: DishItem[]
}

export interface DishPayload {
  name: string
  category?: string
  /** 单价（元） */
  price: number
  specs?: DishSpecItem[]
  code?: string
  spec_code?: string
  type?: string
  sort_order?: number
}

/** GET /admin/dishes 分页列表 */
export function listDishesApi(params: {
  page?: number
  page_size?: number
  category?: string
  status?: string
} = {}): Promise<DishListResult> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.page_size) q.set('page_size', String(params.page_size))
  if (params.category) q.set('category', params.category)
  if (params.status) q.set('status', params.status)
  const qs = q.toString()
  return request<DishListResult>(`/admin/dishes${qs ? `?${qs}` : ''}`)
}

/** POST /admin/dishes 新增菜品 */
export function createDishApi(data: DishPayload): Promise<DishItem> {
  return request<DishItem>('/admin/dishes', { method: 'POST', body: data })
}

/** POST /admin/dishes/import 批量导入菜品 */
export function importDishesApi(items: DishPayload[]): Promise<{ count: number }> {
  return request<{ count: number }>('/admin/dishes/import', {
    method: 'POST',
    body: { items },
  })
}

/** POST /admin/dishes/sort 批量保存排序（ids 顺序即排序） */
export function sortDishesApi(ids: number[]): Promise<void> {
  return request<void>('/admin/dishes/sort', { method: 'POST', body: { ids } })
}

/** PUT /admin/dishes/:id 更新菜品 */
export function updateDishApi(id: number, data: Partial<DishPayload>): Promise<DishItem> {
  return request<DishItem>(`/admin/dishes/${id}`, { method: 'PUT', body: data })
}

/** 分页循环拉取本店全量菜品（供打印分配 / 券 / 折扣等页面选用） */
export async function listAllDishesApi(): Promise<DishItem[]> {
  const all: DishItem[] = [];
  let page = 1;
  const pageSize = 1000;
  let total = Number.POSITIVE_INFINITY;
  while (all.length < total) {
    const res = await listDishesApi({ page, page_size: pageSize });
    all.push(...res.items);
    total = res.total;
    if (res.items.length === 0) break;
    page++;
  }
  return all;
}

/** POST /admin/dishes/:id/status 更新上下架 / 沽清 */
export function updateDishStatusApi(
  id: number,
  data: { status?: string; sold_out?: boolean },
): Promise<DishItem> {
  return request<DishItem>(`/admin/dishes/${id}/status`, { method: 'POST', body: data })
}

/** DELETE /admin/dishes/:id 删除菜品 */
export function deleteDishApi(id: number): Promise<void> {
  return request<void>(`/admin/dishes/${id}`, { method: 'DELETE' })
}
