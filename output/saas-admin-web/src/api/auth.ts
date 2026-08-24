import { request } from './http'
import type { LoginResult, MerchantUser, RegisterParams } from './types'

/** POST /auth/login 账号密码登录 */
export function loginApi(params: { phone: string; password: string }): Promise<LoginResult> {
  return request<LoginResult>('/auth/login', { method: 'POST', body: params })
}

/** POST /auth/register 注册新店铺（激活码） */
export function registerApi(params: RegisterParams): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/register', { method: 'POST', body: params })
}

/** POST /auth/forgot-password 忘记密码（统一提示，不暴露账号是否存在） */
export function forgotApi(params: { phone: string }): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: params })
}

/** GET /auth/me 当前登录用户（401 由 http.ts 统一处理清 token 回登录页） */
export function getMeApi(): Promise<MerchantUser> {
  return request<MerchantUser>('/auth/me')
}
