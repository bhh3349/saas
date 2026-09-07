import { request } from './http'

/** 收银端设备类型 */
export type DeviceType = 'POS' | 'Printer' | 'Tablet' | 'Scanner'

/** 收银端设备（商家后台只读监控） */
export interface DeviceItem {
  id: number
  shop_id: number
  device_id: string
  name: string
  type: DeviceType
  location: string
  ip: string
  mac: string
  os: string
  app_version: string
  /** 最后心跳时间 ISO 字符串 */
  last_seen_at: string
  created_at: string
  updated_at: string
  /** 是否在线（5 分钟内有心跳） */
  is_online: boolean
}

/** GET /admin/devices 设备列表（只读，由收银端心跳自动登记） */
export async function fetchDevices(): Promise<DeviceItem[]> {
  return request<DeviceItem[]>('/admin/devices')
}
