<template>
  <section class="page">
    <div class="page-head">
      <h2 class="page-title">系统设置</h2>
      <p class="page-desc">配置平台名称与品牌图标，保存后登录页、侧边栏、浏览器标签页全局生效</p>
    </div>

    <div class="settings-card">
      <!-- 系统名称 -->
      <div class="settings-field">
        <div class="settings-field-head">
          <label class="form-label" for="sysName">系统名称</label>
          <span class="settings-field-tip">建议 ≤ 12 个字符</span>
        </div>
        <input class="input settings-input" id="sysName" v-model.trim="form.system_name" type="text" maxlength="64" placeholder="请输入系统名称" />
      </div>

      <!-- 页面 Logo -->
      <div class="settings-field">
        <div class="settings-field-head">
          <span class="form-label" style="display:block">页面 Logo</span>
          <span class="settings-field-tip">建议 112×112 透明底 PNG / SVG，显示为圆角小图标</span>
        </div>
        <div class="settings-upload-row">
          <div class="settings-preview">
            <img v-if="form.logo" :src="form.logo" alt="Logo 预览" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.5L12 3.5L20 7.5V16.5L12 20.5L4 16.5V7.5Z"/><path d="M4 7.5L12 11.5L20 7.5M12 11.5V20.5"/></svg>
          </div>
          <div class="settings-upload-actions">
            <button class="btn btn-secondary btn-sm" @click="pick('logo')">更换 Logo</button>
            <button class="btn btn-ghost btn-sm" :disabled="!form.logo" @click="form.logo = ''">清除</button>
          </div>
          <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none" @change="onPick('logo', $event)" />
        </div>
      </div>

      <!-- Favicon -->
      <div class="settings-field">
        <div class="settings-field-head">
          <span class="form-label" style="display:block">浏览器标签图标（Favicon）</span>
          <span class="settings-field-tip">建议 512×512 PNG / SVG / ICO</span>
        </div>
        <div class="settings-upload-row">
          <div class="settings-preview preview-favicon">
            <img v-if="form.favicon" :src="form.favicon" alt="Favicon 预览" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.5L12 3.5L20 7.5V16.5L12 20.5L4 16.5V7.5Z"/><path d="M4 7.5L12 11.5L20 7.5M12 11.5V20.5"/></svg>
          </div>
          <div class="settings-upload-actions">
            <button class="btn btn-secondary btn-sm" @click="pick('favicon')">更换图标</button>
            <button class="btn btn-ghost btn-sm" :disabled="!form.favicon" @click="form.favicon = ''">清除</button>
          </div>
          <input ref="faviconInput" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" style="display:none" @change="onPick('favicon', $event)" />
        </div>
      </div>

      <!-- 操作 -->
      <div class="settings-actions">
        <button class="btn btn-primary" :class="{ loading: saving }" @click="handleSave">
          <span class="spinner"></span>
          <span class="btn-label">保存设置</span>
        </button>
        <button class="btn btn-ghost" @click="handleReset">清空恢复默认</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { updateSettingsApi } from '@/api/settings'
import { showToast } from '@/composables/useToast'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const saving = ref(false)

const MAX_SIZE = 1024 * 1024 // 单张图片上限 1MB

const form = reactive({
  system_name: '',
  logo: '',
  favicon: '',
})

const logoInput = ref<HTMLInputElement | null>(null)
const faviconInput = ref<HTMLInputElement | null>(null)

function pick(type: 'logo' | 'favicon') {
  if (type === 'logo') logoInput.value?.click()
  else faviconInput.value?.click()
}

function onPick(type: 'logo' | 'favicon', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > MAX_SIZE) {
    showToast(type === 'logo' ? 'Logo 图片不能超过 1MB' : 'Favicon 图片不能超过 1MB')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = String(reader.result ?? '')
    if (type === 'logo') form.logo = dataUrl
    else form.favicon = dataUrl
  }
  reader.readAsDataURL(file)
}

async function handleSave() {
  if (saving.value) return
  if (!form.system_name.trim()) {
    showToast('请输入系统名称')
    return
  }
  saving.value = true
  try {
    const res = await updateSettingsApi({
      system_name: form.system_name.trim(),
      logo: form.logo,
      favicon: form.favicon,
    })
    settings.setSettings(res)
    showToast('设置已保存并全局生效')
  } catch (err: unknown) {
    showToast(err instanceof Error ? err.message : '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

function handleReset() {
  form.system_name = ''
  form.logo = ''
  form.favicon = ''
  showToast('已清空表单，点击「保存设置」后生效')
}

onMounted(() => {
  form.system_name = settings.systemName
  form.logo = settings.logo || ''
  form.favicon = settings.favicon || ''
})
</script>
