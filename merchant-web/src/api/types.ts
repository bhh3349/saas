/** 统一响应结构 */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

/** 商家角色：老板 / 收银员 / 财务 */
export type MerchantRole = 'boss' | 'cashier' | 'finance'

export interface MerchantUser {
  id: number
  shop_id: number
  phone: string
  name: string
  role: MerchantRole
  status: string
  /** 店铺名称（登录 / me 下发，TopBar 展示真实店名） */
  shopName?: string
}

export interface LoginResult {
  token: string
  user: MerchantUser
}

/** 注册新店铺：7 字段（地址 / 姓名选填） */
export interface RegisterParams {
  code: string
  shop_name: string
  shop_address?: string
  phone: string
  name?: string
  password: string
}

export class ApiError extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}
