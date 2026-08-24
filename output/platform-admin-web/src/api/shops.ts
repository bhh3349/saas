import { request } from './http'
import type { PageResult, Shop, ShopStatus } from './types'

// 店铺列表
export interface ListShopsParams {
  keyword?: string
  status?: ShopStatus | ''
  page: number
  page_size: number
}

export function listShopsApi(params: ListShopsParams): Promise<PageResult<Shop>> {
  return request<PageResult<Shop>>('/admin/shops', { params })
}

// 停用 / 启用
export function updateShopStatusApi(id: number, status: ShopStatus): Promise<Shop> {
  return request<Shop>(`/admin/shops/${id}/status`, {
    method: 'POST',
    body: { status },
  })
}
