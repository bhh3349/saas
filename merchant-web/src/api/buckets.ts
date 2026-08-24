import { request } from './http'

/** 通用配置桶：GET/PUT /admin/buckets/:key，整包读写 */
export interface BucketResult {
  data: unknown
  updated_at?: string
}

/** 允许的配置键 */
export const BUCKET_KEYS = {
  PRINT: 'print',
  STALL: 'stall',
  VOUCHER: 'voucher',
  DISCOUNT: 'discount',
  MUSTDISH: 'mustdish',
  ROLE: 'role',
  STORE_PROFILE: 'store_profile',
  BUSINESS_SETTINGS: 'business_settings',
  STAFF: 'staff',
  PAYMENTS: 'payments',
} as const

/** GET /admin/buckets/:key 读取配置桶（未配置返回 null） */
export async function getBucket<T = unknown>(key: string): Promise<T | null> {
  const res = await request<BucketResult>(`/admin/buckets/${key}`)
  return (res?.data as T | null | undefined) ?? null
}

/** PUT /admin/buckets/:key 覆盖保存配置桶 */
export function putBucket<T = unknown>(key: string, data: T): Promise<BucketResult> {
  return request<BucketResult>(`/admin/buckets/${key}`, {
    method: 'PUT',
    body: { data },
  })
}
