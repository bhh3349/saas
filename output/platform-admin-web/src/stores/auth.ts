import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loginApi } from '@/api/auth'
import { clearAuth, getStoredUser, getToken, setStoredUser, setToken } from '@/api/http'
import type { OperatorInfo } from '@/api/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(getToken())
  const operator = ref<OperatorInfo | null>(getStoredUser() as OperatorInfo | null)

  async function login(username: string, password: string) {
    const res = await loginApi({ username, password })
    token.value = res.token
    operator.value = res.operator
    setToken(res.token)
    setStoredUser(res.operator)
    return res
  }

  /** 更新本地运营账号信息（改头像 / 用户名后调用） */
  function setOperator(info: OperatorInfo) {
    operator.value = info
    setStoredUser(info)
  }

  function logout() {
    token.value = ''
    operator.value = null
    clearAuth()
  }

  return { token, operator, login, setOperator, logout }
})
