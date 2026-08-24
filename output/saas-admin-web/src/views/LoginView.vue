<template>
  <div class="view login-view">
    <div class="auth-card">
      <!-- 品牌区 -->
      <div class="brand">
        <div class="brand-mark">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="5" y="6" width="22" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/>
            <path d="M10 26h12M12.5 13h7M11 18c3 1.3 7 1.3 10 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <div class="brand-name">餐饮收银 SaaS</div>
          <div class="brand-sub">商家管理后台 · 仅限老板使用</div>
        </div>
      </div>

      <!-- 双 Tab -->
      <div class="tabs" role="tablist">
        <button class="tab" :class="{ active: tab === 'login' }" role="tab" type="button" @click="switchTab('login')">登录</button>
        <button class="tab" :class="{ active: tab === 'register' }" role="tab" type="button" @click="switchTab('register')">注册新店铺</button>
      </div>

      <!-- 登录面板 -->
      <div class="panel login-panel" :class="{ active: tab === 'login' }">
        <div class="error-banner" :class="{ show: loginError }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V13"/><path d="M12 16.4h.01"/></svg>
          <span>{{ loginError }}</span>
        </div>

        <div class="form-group">
          <label class="form-label" for="loginPhone">手机号</label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>
            <input class="input with-icon" :class="{ 'has-error': err.loginPhone }" id="loginPhone" v-model="loginPhone" type="tel" inputmode="numeric" maxlength="11" autocomplete="username" placeholder="请输入 11 位手机号" @input="clearErr('loginPhone')" @keydown.enter="submitLogin">
          </div>
          <div class="field-error" :class="{ show: err.loginPhone }">请输入 11 位手机号</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="loginPwd">密码</label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            <input class="input with-icon with-suffix" :class="{ 'has-error': err.loginPwd }" id="loginPwd" v-model="loginPwd" :type="showLoginPwd ? 'text' : 'password'" autocomplete="current-password" placeholder="请输入密码" @input="clearErr('loginPwd')" @keydown.enter="submitLogin">
            <button class="suffix-btn" type="button" tabindex="-1" :aria-label="showLoginPwd ? '隐藏密码' : '显示密码'" @click="showLoginPwd = !showLoginPwd">
              <svg v-if="!showLoginPwd" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 6.5A10.5 10.5 0 0 0 12 5C5 5 2 12 2 12s1.2 2.5 3.2 4.4M6.5 17.5A10.5 10.5 0 0 0 12 19c7 0 10-7 10-7s-1.2-2.5-3.2-4.4"/><path d="m3 3 18 18"/></svg>
            </button>
          </div>
          <div class="field-error" :class="{ show: err.loginPwd }">请输入密码</div>
        </div>

        <div class="forgot-row">
          <button class="forgot-link" type="button" @click="forgotOpen = !forgotOpen">
            {{ forgotOpen ? '收起' : '忘记密码？' }}
          </button>
        </div>

        <div v-if="forgotOpen" class="forgot-panel">
          <div class="form-group">
            <label class="form-label" for="forgotPhone">手机号</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>
              <input class="input with-icon" id="forgotPhone" v-model="forgotPhone" type="tel" inputmode="numeric" maxlength="11" placeholder="请输入绑定手机号" @keydown.enter="submitForgot">
            </div>
          </div>
          <button class="btn btn-secondary" :class="{ loading: forgotLoading }" type="button" @click="submitForgot">
            <span class="spinner"></span><span class="btn-label">发送重置指引</span>
          </button>
          <div class="forgot-hint">如该手机号已注册，请联系客服重置密码</div>
        </div>

        <button class="btn btn-primary btn-block" :class="{ loading: loginLoading }" type="button" @click="submitLogin">
          <span class="spinner"></span><span class="btn-label">登 录</span>
        </button>
      </div>

      <!-- 注册面板 -->
      <div class="panel register-panel" :class="{ active: tab === 'register' }">
        <div class="error-banner" :class="{ show: regError }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V13"/><path d="M12 16.4h.01"/></svg>
          <span>{{ regError }}</span>
        </div>

        <div class="form-group">
          <label class="form-label" for="regCode">激活码 <span class="label-req">*</span> <span class="label-tag">12 位字母 + 数字</span></label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M11 12 19 4M15 8l2.5 2.5M17 6l1.5 1.5M6 15v4M8 17h4"/></svg>
            <input class="input with-icon mono" :class="{ 'has-error': err.regCode }" id="regCode" v-model="reg.code" type="text" maxlength="12" autocomplete="off" placeholder="请输入 12 位激活码" @input="clearErr('regCode')">
          </div>
          <div class="field-error" :class="{ show: err.regCode }">激活码为 12 位字母 + 数字组合</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="regShop">店铺名称 <span class="label-req">*</span></label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10c1.5 1.5 3 0 4.5 0S11 11 12.5 11s2-1.5 3.5 0 1 0 2 .5"/><path d="M4 10V20"/><path d="M20 10V20"/><path d="M6 20h12"/><path d="M3 20h18"/><path d="M6 10V6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4"/></svg>
            <input class="input with-icon" :class="{ 'has-error': err.regShop }" id="regShop" v-model="reg.shop" type="text" maxlength="30" autocomplete="off" placeholder="请输入店铺名称" @input="clearErr('regShop')">
          </div>
          <div class="field-error" :class="{ show: err.regShop }">请输入店铺名称</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="regAddr">店铺地址 <span class="label-opt">选填</span></label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
            <input class="input with-icon" id="regAddr" v-model="reg.addr" type="text" maxlength="60" autocomplete="off" placeholder="请输入店铺地址（可选）">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="regPhone">手机号 <span class="label-req">*</span></label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>
            <input class="input with-icon" :class="{ 'has-error': err.regPhone }" id="regPhone" v-model="reg.phone" type="tel" inputmode="numeric" maxlength="11" autocomplete="off" placeholder="请输入 11 位手机号" @input="clearErr('regPhone')">
          </div>
          <div class="field-error" :class="{ show: err.regPhone }">请输入 11 位手机号</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="regName">老板姓名 <span class="label-opt">选填</span></label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5"/></svg>
            <input class="input with-icon" id="regName" v-model="reg.name" type="text" maxlength="20" autocomplete="off" placeholder="请输入老板姓名（可选）">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="regPwd">登录密码 <span class="label-req">*</span></label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            <input class="input with-icon with-suffix" :class="{ 'has-error': err.regPwd }" id="regPwd" v-model="reg.pwd" :type="showRegPwd ? 'text' : 'password'" autocomplete="new-password" placeholder="至少 6 位" @input="clearErr('regPwd')">
            <button class="suffix-btn" type="button" tabindex="-1" :aria-label="showRegPwd ? '隐藏密码' : '显示密码'" @click="showRegPwd = !showRegPwd">
              <svg v-if="!showRegPwd" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 6.5A10.5 10.5 0 0 0 12 5C5 5 2 12 2 12s1.2 2.5 3.2 4.4M6.5 17.5A10.5 10.5 0 0 0 12 19c7 0 10-7 10-7s-1.2-2.5-3.2-4.4"/><path d="m3 3 18 18"/></svg>
            </button>
          </div>
          <div class="field-error" :class="{ show: err.regPwd }">密码至少 6 位</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="regPwd2">确认密码 <span class="label-req">*</span></label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><path d="m9 15.5 2 2 4-4"/></svg>
            <input class="input with-icon" :class="{ 'has-error': err.regPwd2 }" id="regPwd2" v-model="reg.pwd2" type="password" autocomplete="new-password" placeholder="请再次输入密码" @input="clearErr('regPwd2')" @keydown.enter="submitRegister">
          </div>
          <div class="field-error" :class="{ show: err.regPwd2 }">两次输入的密码不一致</div>
        </div>

        <button class="btn btn-primary btn-block" :class="{ loading: regLoading }" type="button" @click="submitRegister">
          <span class="spinner"></span><span class="btn-label">注册并创建店铺</span>
        </button>

        <div class="terms-hint">注册即代表同意<a href="javascript:void(0)">《服务协议》</a>与<a href="javascript:void(0)">《隐私政策》</a></div>
      </div>

      <div class="auth-footer">© 2026 餐饮收银 SaaS · 仅限已授权商家</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { forgotApi, registerApi } from '@/api/auth'
import { showToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const tab = ref<'login' | 'register'>('login')
const loginPhone = ref('')
const loginPwd = ref('')
const showLoginPwd = ref(false)
const forgotOpen = ref(false)
const forgotPhone = ref('')

const reg = reactive({ code: '', shop: '', addr: '', phone: '', name: '', pwd: '', pwd2: '' })
const showRegPwd = ref(false)

const loginLoading = ref(false)
const regLoading = ref(false)
const forgotLoading = ref(false)

const loginError = ref('')
const regError = ref('')
const err = reactive({
  loginPhone: false,
  loginPwd: false,
  regCode: false,
  regShop: false,
  regPhone: false,
  regPwd: false,
  regPwd2: false,
})

const isPhone = (v: string) => /^1\d{10}$/.test(v)
const isCode = (v: string) => /^[A-Za-z0-9]{12}$/.test(v)

function switchTab(t: 'login' | 'register'): void {
  if (tab.value === t) return
  tab.value = t
  loginError.value = ''
  regError.value = ''
}

function clearErr(key: keyof typeof err): void {
  err[key] = false
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

/* ---------- 登录 ---------- */
function validateLogin(): boolean {
  let ok = true
  if (!isPhone(loginPhone.value.trim())) {
    err.loginPhone = true
    ok = false
  }
  if (!loginPwd.value) {
    err.loginPwd = true
    ok = false
  }
  return ok
}

async function submitLogin(): Promise<void> {
  if (loginLoading.value) return
  loginError.value = ''
  if (!validateLogin()) return
  loginLoading.value = true
  try {
    const res = await auth.login(loginPhone.value.trim(), loginPwd.value)
    // 角色拦截：商家后台 Web 仅老板可用
    if (res.user.role !== 'boss') {
      const roleName = res.user.role === 'cashier' ? '收银员' : '财务'
      auth.logout()
      const msg = `该账号为${roleName}，无后台管理权限，请使用收银 App`
      loginError.value = msg
      showToast(msg, 'error')
      return
    }
    router.push('/')
  } catch (e: unknown) {
    const msg = errorMessage(e, '登录失败，请重试')
    loginError.value = msg
    showToast(msg, 'error')
  } finally {
    loginLoading.value = false
  }
}

/* ---------- 忘记密码 ---------- */
async function submitForgot(): Promise<void> {
  if (forgotLoading.value) return
  if (!isPhone(forgotPhone.value.trim())) {
    showToast('请输入正确的 11 位手机号', 'error')
    return
  }
  forgotLoading.value = true
  try {
    const res = await forgotApi({ phone: forgotPhone.value.trim() })
    showToast(res.message || '如该手机号已注册，请联系客服重置密码')
  } catch (e: unknown) {
    // 统一提示，不暴露账号是否存在
    showToast(errorMessage(e, '如该手机号已注册，请联系客服重置密码'))
  } finally {
    forgotLoading.value = false
  }
}

/* ---------- 注册新店铺 ---------- */
function validateRegister(): boolean {
  let ok = true
  if (!isCode(reg.code.trim())) {
    err.regCode = true
    ok = false
  }
  if (!reg.shop.trim()) {
    err.regShop = true
    ok = false
  }
  if (!isPhone(reg.phone.trim())) {
    err.regPhone = true
    ok = false
  }
  if (reg.pwd.length < 6) {
    err.regPwd = true
    ok = false
  }
  if (reg.pwd !== reg.pwd2) {
    err.regPwd2 = true
    ok = false
  }
  return ok
}

async function submitRegister(): Promise<void> {
  if (regLoading.value) return
  regError.value = ''
  if (!validateRegister()) return
  regLoading.value = true
  try {
    await registerApi({
      code: reg.code.trim(),
      shop_name: reg.shop.trim(),
      shop_address: reg.addr.trim() || undefined,
      phone: reg.phone.trim(),
      name: reg.name.trim() || undefined,
      password: reg.pwd,
    })
    showToast('注册成功，请登录', 'success')
    loginPhone.value = reg.phone.trim()
    loginPwd.value = ''
    reg.code = ''
    reg.shop = ''
    reg.addr = ''
    reg.phone = ''
    reg.name = ''
    reg.pwd = ''
    reg.pwd2 = ''
    switchTab('login')
  } catch (e: unknown) {
    const msg = errorMessage(e, '注册失败，请重试')
    regError.value = msg
    showToast(msg, 'error')
  } finally {
    regLoading.value = false
  }
}
</script>
