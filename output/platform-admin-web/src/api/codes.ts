import { request } from './http'
import type { ActivationCode, BatchCreateResult, CodeStatus, PageResult } from './types'

// 激活码列表
export interface ListCodesParams {
  batch_no?: string
  status?: CodeStatus | ''
  page: number
  page_size: number
}

export function listCodesApi(params: ListCodesParams): Promise<PageResult<ActivationCode>> {
  return request<PageResult<ActivationCode>>('/admin/codes', { params })
}

// 批量生成
export interface BatchCreateParams {
  count: number
  batch_no: string
}

export function batchCreateApi(params: BatchCreateParams): Promise<BatchCreateResult> {
  return request<BatchCreateResult>('/admin/codes/batch', {
    method: 'POST',
    body: params,
  })
}

// 作废
export function voidCodeApi(code: string): Promise<{ code: string; status: string }> {
  return request(`/admin/codes/${encodeURIComponent(code)}/void`, {
    method: 'POST',
  })
}

// 导出 CSV（带当前筛选条件，默认导出未使用）
export interface ExportCodesParams {
  batch_no?: string
  status?: CodeStatus | ''
}

export async function exportCodesApi(params: ExportCodesParams): Promise<void> {
  const blob = await request<Blob>('/admin/codes/export', { params, raw: true })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'activation_codes.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
