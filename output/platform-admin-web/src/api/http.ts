import type { ApiResult } from './types'

const TOKEN_KEY = 'platform_admin_token'
const USER_KEY = 'platform_admin_user'

// ---------- token 持久化 ----------
export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getStoredUser(): unknown {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function setStoredUser(user: unknown): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// ---------- 请求封装 ----------
export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParamsRecord = Record<string, any>

interface RequestOptions {
  method?: string
  params?: ParamsRecord
  body?: unknown
  // 返回原始 blob（用于导出下载）
  raw?: boolean
  /** 请求超时（ms），默认 8000；传 0 表示不设超时 */
  timeout?: number
  /** 外部中止信号（组件卸载 / 竞态取消时使用） */
  signal?: AbortSignal
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', params, body, raw, timeout = 8000, signal } = options

  // 拼接 query
  let url = path
  if (params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        qs.set(k, String(v))
      }
    }
    const q = qs.toString()
    if (q) url += (url.includes('?') ? '&' : '?') + q
  }

  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  // 超时 / 外部中止：统一通过 AbortController 控制
  const controller = new AbortController()
  const onExternalAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onExternalAbort)
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  if (timeout > 0) {
    timer = setTimeout(() => controller.abort(), timeout)
  }

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err: unknown) {
    // 中止：超时或主动取消
    if (controller.signal.aborted) {
      throw new ApiError(-2, '请求超时或已取消，请重试')
    }
    throw err instanceof Error ? err : new ApiError(-1, '网络异常，请重试')
  } finally {
    if (timer) clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onExternalAbort)
  }

  // 401：token 失效，清空并跳登录
  if (res.status === 401) {
    clearAuth()
    if (!location.pathname.endsWith('/login')) {
      location.replace('/login')
    }
  }

  // 429：触发限流（登录 / 改密 / 全局限流），给出友好提示
  if (res.status === 429) {
    throw new ApiError(429, '操作过于频繁，请稍后再试')
  }

  if (raw) {
    if (!res.ok) {
      throw new ApiError(res.status, `请求失败 (${res.status})`)
    }
    return (await res.blob()) as T
  }

  const json = (await res.json().catch(() => null)) as ApiResult<T> | null
  if (!json) {
    throw new ApiError(-1, '服务器响应异常')
  }
  if (json.code !== 0) {
    throw new ApiError(json.code, json.message || '请求失败')
  }
  return json.data
}
