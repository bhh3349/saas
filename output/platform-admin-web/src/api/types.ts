// 统一响应格式：{ code: 0 成功; 非 0 失败, message, data }
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

// 分页列表
export interface PageResult<T> {
  total: number
  items: T[]
}

// ---------- 激活码 ----------
// 后端状态枚举：unused 未使用 / used 已绑定 / void 已作废
export type CodeStatus = 'unused' | 'used' | 'void'

export interface ActivationCode {
  code: string
  batch_no: string
  status: CodeStatus
  bound_shop_id: number | null
  bound_at: string | null
  created_at: string
  /** 后端 leftJoin 返回的绑定店铺名 */
  shop_name?: string | null
}

export interface BatchCreateResult {
  batch_no: string
  count: number
  codes: string[]
}

// ---------- 店铺 ----------
// 后端状态枚举：active 正常 / disabled 已停用
export type ShopStatus = 'active' | 'disabled'

export interface Shop {
  id: number
  name: string
  address: string
  /** 设计稿有联系人列，后端当前无此字段，预留可选 */
  contact?: string | null
  phone: string
  activation_code: string | null
  status: ShopStatus
  created_at: string
}

// ---------- 登录 / 运营账号 ----------
export interface OperatorInfo {
  id: number
  username: string
  role: string
  /** 头像（data URL / 图片地址），可为空 */
  avatar?: string | null
}

export interface UpdateProfileParams {
  username?: string
  avatar?: string
}

export interface ChangePasswordParams {
  old_password: string
  new_password: string
}

export interface LoginResult {
  token: string
  operator: OperatorInfo
}
