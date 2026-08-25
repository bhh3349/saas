import { request } from './http'
import type { SystemSetting, UpdateSystemSettingParams } from './types'

/** 公开读取品牌设置（登录页等未登录场景使用，无需 token） */
export function getSettingsApi(): Promise<SystemSetting> {
  return request<SystemSetting>('/settings')
}

/** 管理员更新系统设置 */
export function updateSettingsApi(params: UpdateSystemSettingParams): Promise<SystemSetting> {
  return request<SystemSetting>('/settings', { method: 'PUT', body: params })
}
