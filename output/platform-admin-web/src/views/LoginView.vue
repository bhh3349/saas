<template>
  <div class="view login-view">
    <div class="login-card">
      <div class="brand">
        <div class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.5L12 3.5L20 7.5V16.5L12 20.5L4 16.5V7.5Z"/><path d="M4 7.5L12 11.5L20 7.5M12 11.5V20.5"/></svg>
        </div>
        <span class="brand-name">收银云 · 平台后台</span>
      </div>
      <h1 class="login-title">登录管理后台</h1>
      <p class="login-sub">激活码与店铺的集中管理控制台</p>

      <div ref="errorEl" class="login-error" :class="{ show: error }">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 5V8.5M8 10.5V10.51"/></svg>
        <span>{{ errorText }}</span>
      </div>

      <form id="loginForm" novalidate @submit.prevent="handleLogin">
        <div class="form-group">
          <label class="form-label" for="username">账号</label>
          <div class="input-wrap">
            <svg class="input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="5.2" r="3"/><path d="M2.5 14C3.5 11.5 5.5 10.3 8 10.3C10.5 10.3 12.5 11.5 13.5 14"/></svg>
            <input class="input" id="username" v-model.trim="username" type="text" placeholder="请输入管理员账号" autocomplete="username">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="password">密码</label>
          <div class="input-wrap">
            <svg class="input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6.5" width="10" height="7" rx="2"/><path d="M5.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2"/></svg>
            <input class="input" id="password" v-model="password" type="password" placeholder="请输入密码" autocomplete="current-password">
          </div>
        </div>
        <button class="btn btn-primary btn-block login-btn" id="loginBtn" type="submit" :class="{ loading: loading }">
          <span class="spinner"></span>
          <span class="btn-label">登 录</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref(false)
const errorText = ref('账号或密码错误，请重新输入')
const errorEl = ref<HTMLElement | null>(null)

async function handleLogin() {
  if (loading.value) return
  if (!username.value || !password.value) {
    error.value = true
    setTimeout(() => (error.value = false), 400)
    return
  }
  loading.value = true
  error.value = false
  try {
    await auth.login(username.value, password.value)
    router.push('/codes')
  } catch (err: unknown) {
    error.value = true
    errorText.value =
      err instanceof Error && err.message && err.message !== '请求失败'
        ? err.message
        : '登录失败，请重试'
    const el = errorEl.value
    if (el) {
      el.classList.remove('shake')
      void el.offsetWidth
      el.classList.add('shake')
    }
    setTimeout(() => (error.value = false), 2600)
  } finally {
    loading.value = false
  }
}
</script>
