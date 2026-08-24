<template>
  <div class="view app-view">
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.5L12 3.5L20 7.5V16.5L12 20.5L4 16.5V7.5Z"/><path d="M4 7.5L12 11.5L20 7.5M12 11.5V20.5"/></svg>
        </div>
        <span class="brand-name">收银云 · 平台后台</span>
      </div>
      <nav class="nav">
        <button class="nav-item" :class="{ active: isActive('/codes') }" @click="router.push('/codes')">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="4" width="11" height="9" rx="1.5"/><path d="M5 2.5h6M5.5 7h5M5.5 9.5h3"/></svg>
          激活码管理
        </button>
        <button class="nav-item" :class="{ active: isActive('/shops') }" @click="router.push('/shops')">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 6.5L4 3h8l1.5 3.5M2.5 6.5V12a1.5 1.5 0 0 0 1.5 1.5h8A1.5 1.5 0 0 0 13.5 12V6.5M2.5 6.5h11"/><circle cx="6" cy="9.5" r="1"/><circle cx="10" cy="9.5" r="1"/></svg>
          店铺管理
        </button>
      </nav>
      <div class="sidebar-footer">Platform Admin v0.1<br>© 2026 收银云</div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="topbar-title">{{ title }}</div>
        <div class="topbar-right">
          <button class="btn btn-secondary" style="height:32px;font-size:13px;padding:0 12px;" :disabled="exporting" @click="handleExport">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2V10.5M8 10.5L5 7.5M8 10.5L11 7.5"/><path d="M2.5 11.5V13A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13v-1.5"/></svg>
            {{ exporting ? '导出中…' : '导出' }}
          </button>
          <div class="topbar-divider"></div>

          <!-- 用户菜单：点击头像 / 用户名展开下拉 -->
          <div class="user-menu" :class="{ open: menuOpen }" ref="menuEl" @click="toggleMenu">
            <img v-if="auth.operator?.avatar" class="avatar avatar-img" :src="auth.operator.avatar" alt="头像" />
            <div v-else class="avatar">{{ avatarChar }}</div>
            <span class="user-name">{{ auth.operator?.username ?? '管理员' }}</span>

            <div class="dropdown" v-show="menuOpen" @click.stop>
              <button class="dropdown-item" @click="openProfile">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 8.5A2.75 2.75 0 1 0 8 3a2.75 2.75 0 0 0 0 5.5ZM2.5 13.5a5.5 5.5 0 0 1 11 0"/></svg>
                个人信息
              </button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item danger" @click="handleLogout">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 3.5H4A1.5 1.5 0 0 0 2.5 5v6A1.5 1.5 0 0 0 4 12.5h6.5M13.5 8h-8M13.5 8L11 5.5M13.5 8L11 10.5"/></svg>
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>

    <!-- ==================== 个人信息弹窗 ==================== -->
    <div class="modal-backdrop" :class="{ open: showProfile }">
      <div class="modal modal-profile" role="dialog" aria-modal="true" aria-labelledby="profileTitle">
        <div class="modal-header">
          <span class="modal-title" id="profileTitle">个人信息</span>
          <button class="modal-close" @click="closeProfile">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3L11 11M11 3L3 11"/></svg>
          </button>
        </div>
        <div class="modal-divider"></div>
        <div class="modal-body">
          <div class="profile-avatar-row">
            <img v-if="displayAvatar" class="profile-avatar" :src="displayAvatar" alt="头像" />
            <div v-else class="profile-avatar">{{ avatarChar }}</div>
            <div class="profile-avatar-actions">
              <button class="btn btn-secondary btn-sm" @click="pickAvatar">更换头像</button>
              <button class="btn btn-ghost btn-sm" @click="clearAvatar">移除头像</button>
              <p class="profile-avatar-hint">支持 JPG / PNG，建议 200KB 以内</p>
            </div>
            <input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp" style="display:none" @change="onAvatarChange" />
          </div>

          <div class="form-group">
            <label class="form-label" for="profileUsername">用户名</label>
            <input class="input" id="profileUsername" v-model.trim="profileForm.username" type="text" placeholder="请输入用户名" :class="{ 'has-error': !!profileErrors.username }" />
            <div class="field-error" :class="{ show: !!profileErrors.username }">{{ profileErrors.username }}</div>
          </div>

          <div class="modal-section-title">
            <span>修改密码</span>
            <span class="modal-section-sub">不修改请留空</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="oldPwd">原密码</label>
            <input class="input" id="oldPwd" v-model="profileForm.old_password" type="password" placeholder="请输入原密码" autocomplete="current-password" />
          </div>
          <div class="form-group">
            <label class="form-label" for="newPwd">新密码</label>
            <input class="input" id="newPwd" v-model="profileForm.new_password" type="password" placeholder="8-64 位，含字母和数字" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label class="form-label" for="confirmPwd">确认新密码</label>
            <input class="input" id="confirmPwd" v-model="profileForm.confirm_password" type="password" placeholder="再次输入新密码" autocomplete="new-password" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeProfile">取消</button>
          <button class="btn btn-primary" :class="{ loading: savingProfile }" @click="saveProfile">
            <span class="spinner"></span>
            <span class="btn-label">保存</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { changePasswordApi, updateProfileApi } from '@/api/auth'
import { exportCodesApi } from '@/api/codes'
import { showToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import type { UpdateProfileParams } from '@/api/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const titleMap: Record<string, string> = {
  codes: '激活码管理',
  shops: '店铺管理',
}

const title = computed(() => titleMap[String(route.name)] ?? '平台后台')

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}

const avatarChar = computed(() => (auth.operator?.username?.[0] ?? '管').toUpperCase())

// ---------- 下拉菜单 ----------
const menuOpen = ref(false)
const menuEl = ref<HTMLElement | null>(null)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function onDocClick(e: MouseEvent) {
  if (menuEl.value && !menuEl.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function handleLogout() {
  menuOpen.value = false
  auth.logout()
  router.replace('/')
}

const exporting = ref(false)

async function handleExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    await exportCodesApi({})
    showToast('已导出激活码 CSV')
  } catch {
    showToast('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

// ---------- 个人信息弹窗 ----------
const showProfile = ref(false)
const savingProfile = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
/** 头像草稿：undefined=未变更；string=dataURL；null=移除 */
const avatarDraft = ref<string | null | undefined>(undefined)

const profileForm = reactive({
  username: '',
  old_password: '',
  new_password: '',
  confirm_password: '',
})
const profileErrors = reactive<{ username: string }>({ username: '' })

const displayAvatar = computed(() => {
  if (avatarDraft.value === undefined) return auth.operator?.avatar ?? null
  return avatarDraft.value
})

function openProfile() {
  menuOpen.value = false
  profileForm.username = auth.operator?.username ?? ''
  profileForm.old_password = ''
  profileForm.new_password = ''
  profileForm.confirm_password = ''
  profileErrors.username = ''
  avatarDraft.value = undefined
  showProfile.value = true
}

function closeProfile() {
  showProfile.value = false
  avatarDraft.value = undefined
}

function pickAvatar() {
  avatarInput.value?.click()
}

function onAvatarChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 200 * 1024) {
    showToast('图片不能超过 200KB')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    avatarDraft.value = String(reader.result ?? '')
  }
  reader.readAsDataURL(file)
}

function clearAvatar() {
  avatarDraft.value = null
}

async function saveProfile() {
  if (savingProfile.value) return

  if (!profileForm.username.trim()) {
    profileErrors.username = '请输入用户名'
    return
  }
  profileErrors.username = ''

  const pwdChanged = !!(profileForm.old_password || profileForm.new_password || profileForm.confirm_password)
  if (pwdChanged) {
    if (!profileForm.old_password) {
      showToast('请输入原密码')
      return
    }
    if (profileForm.new_password.length < 8) {
      showToast('新密码至少 8 位')
      return
    }
    if (!/[A-Za-z]/.test(profileForm.new_password) || !/[0-9]/.test(profileForm.new_password)) {
      showToast('新密码需同时包含字母和数字')
      return
    }
    if (profileForm.new_password !== profileForm.confirm_password) {
      showToast('两次输入的新密码不一致')
      return
    }
  }

  savingProfile.value = true
  try {
    const profileChanged =
      profileForm.username.trim() !== auth.operator?.username || avatarDraft.value !== undefined
    if (profileChanged) {
      const payload: UpdateProfileParams = { username: profileForm.username.trim() }
      if (avatarDraft.value !== undefined) payload.avatar = avatarDraft.value ?? ''
      const updated = await updateProfileApi(payload)
      auth.setOperator(updated)
      showToast('资料已更新')
    }
    if (pwdChanged) {
      await changePasswordApi({
        old_password: profileForm.old_password,
        new_password: profileForm.new_password,
      })
      // 改密后后端使当前 token 立即失效，主动退出并引导重新登录
      showToast('密码已更新，请重新登录')
      auth.logout()
      closeProfile()
      router.replace('/login')
      return
    }
    closeProfile()
  } catch (err: unknown) {
    showToast(err instanceof Error ? err.message : '保存失败，请重试')
  } finally {
    savingProfile.value = false
  }
}
</script>
