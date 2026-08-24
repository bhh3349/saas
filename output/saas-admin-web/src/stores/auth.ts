import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getMeApi, loginApi } from '@/api/auth'
import {
  clearAuth,
  getStoredShop,
  getStoredUser,
  getToken,
  setStoredShop,
  setStoredUser,
  setToken,
} from '@/api/http'
import type { LoginResult, MerchantUser } from '@/api/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(getToken())
  const user = ref<MerchantUser | null>(getStoredUser<MerchantUser>())
  const shopName = ref<string>(getStoredShop())

  /** 登录：成功后持久化 token + user + 店铺名（角色分流由页面处理） */
  async function login(phone: string, password: string): Promise<LoginResult> {
    const res = await loginApi({ phone, password })
    token.value = res.token
    user.value = res.user
    shopName.value = res.shopName ?? ''
    setToken(res.token)
    setStoredUser(res.user)
    setStoredShop(shopName.value)
    return res
  }

  /** 会话恢复校验：GET /auth/me 刷新用户信息；401 由 http.ts 统一清 token 跳登录 */
  async function refresh(): Promise<boolean> {
    if (!token.value) return false
    try {
      const me = await getMeApi()
      user.value = me
      setStoredUser(me)
      return true
    } catch {
      return false
    }
  }

  function logout(): void {
    token.value = ''
    user.value = null
    shopName.value = ''
    clearAuth()
  }

  return { token, user, shopName, login, refresh, logout }
})
