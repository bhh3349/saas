import { request } from './http'

/** 分类条目（含菜品数） */
export interface CategoryItem {
  id: number
  parent_id: number | null
  name: string
  code: string
  show_on_mobile: boolean
  belong: string
  sort_order: number
  dish_count: number
  created_at: string
}

export interface CategoryPayload {
  name: string
  parent_id?: number | null
  code?: string
  show_on_mobile?: boolean
  belong?: string
  sort_order?: number
}

/** GET /admin/categories 本店全部分类 */
export function listCategoriesApi(): Promise<CategoryItem[]> {
  return request<CategoryItem[]>('/admin/categories')
}

/** POST /admin/categories 新增分类 */
export function createCategoryApi(data: CategoryPayload): Promise<CategoryItem> {
  return request<CategoryItem>('/admin/categories', { method: 'POST', body: data })
}

/** PUT /admin/categories/:id 更新分类 */
export function updateCategoryApi(
  id: number,
  data: Partial<CategoryPayload>,
): Promise<CategoryItem> {
  return request<CategoryItem>(`/admin/categories/${id}`, { method: 'PUT', body: data })
}

/** DELETE /admin/categories/:id 删除分类 */
export function deleteCategoryApi(id: number): Promise<void> {
  return request<void>(`/admin/categories/${id}`, { method: 'DELETE' })
}
