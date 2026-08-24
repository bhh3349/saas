import { ApiError } from './types'

export const TOKEN_KEY = 'merchant_token'
export const USER_KEY = 'merchant_user'
export const SHOP_KEY = 'merchant_shop'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function setStoredUser<T>(user: T): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredShop(): string {
  return localStorage.getItem(SHOP_KEY) || ''
}

export function setStoredShop(name: string): void {
  localStorage.setItem(SHOP_KEY, name)
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(SHOP_KEY)
}

export function handle401(): void {
  clearAuth()
  if (!window.location.pathname.endsWith('/login')) {
    window.location.href = '/login'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(-1, '网络错误，请检查网络后重试')
  }

  let json: { code: number; message: string; data: T }
  try {
    json = (await res.json()) as { code: number; message: string; data: T }
  } catch {
    throw new ApiError(res.status, `服务响应异常（HTTP ${res.status}）`)
  }

  // 401：token 失效，全局清 token 回登录页
  if (res.status === 401 || json.code === 401) {
    handle401()
    throw new ApiError(401, json.message || '登录已过期，请重新登录')
  }

  if (json.code !== 0) {
    throw new ApiError(json.code, json.message || '请求失败')
  }

  return json.data
}
