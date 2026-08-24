import { request } from './http'
import type {
  ChangePasswordParams,
  LoginResult,
  OperatorInfo,
  UpdateProfileParams,
} from './types'

export interface LoginParams {
  username: string
  password: string
}

export function loginApi(params: LoginParams): Promise<LoginResult> {
  return request<LoginResult>('/auth/login', {
    method: 'POST',
    body: params,
  })
}

/** 获取当前运营账号资料 */
export function getProfileApi(): Promise<OperatorInfo> {
  return request<OperatorInfo>('/auth/me')
}

/** 修改用户名 / 头像 */
export function updateProfileApi(params: UpdateProfileParams): Promise<OperatorInfo> {
  return request<OperatorInfo>('/auth/profile', {
    method: 'PUT',
    body: params,
  })
}

/** 修改密码 */
export function changePasswordApi(params: ChangePasswordParams): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/auth/password', {
    method: 'PUT',
    body: params,
  })
}
