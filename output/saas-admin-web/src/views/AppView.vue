<template>
  <div class="view app-view">
    <!-- 一级模块栏 -->
    <aside class="module-bar">
      <div class="module-brand">
        <div class="brand-mark">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="5" y="6" width="22" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/>
            <path d="M10 26h12M12.5 13h7M11 18c3 1.3 7 1.3 10 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
      <nav class="module-nav">
        <button
          v-for="m in modules"
          :key="m.key"
          class="module-item"
          :class="{ active: currentModule === m.key }"
          type="button"
          @click="switchModule(m)"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" v-html="m.icon"></svg>
          <span>{{ m.label }}</span>
        </button>
      </nav>
      <div class="module-footer">v0.1</div>
    </aside>

    <!-- 二级 / 三级菜单 -->
    <aside class="menu-panel">
      <div class="menu-panel-head">{{ currentMenu?.label }}</div>
      <nav class="menu-tree">
        <template v-for="entry in currentMenu?.children" :key="entry.key">
          <button
            v-if="entry.type === 'leaf'"
            class="menu-leaf"
            :class="{ active: isActive(entry.path) }"
            type="button"
            @click="router.push(entry.path)"
          >
            {{ entry.label }}
          </button>
          <div v-else class="menu-group" :key="entry.key">
            <div class="menu-group-title">{{ entry.label }}</div>
            <button
              v-for="leaf in entry.children"
              :key="leaf.key"
              class="menu-leaf"
              :class="{ active: isActive(leaf.path) }"
              type="button"
              @click="router.push(leaf.path)"
            >
              {{ leaf.label }}
            </button>
          </div>
        </template>
      </nav>
    </aside>

    <!-- 主区域 -->
    <div class="main">
      <header class="topbar">
        <div class="topbar-title">{{ breadcrumb }}</div>
        <div class="topbar-right">
          <span v-if="auth.shopName" class="shop-name">{{ auth.shopName }}</span>
          <div class="avatar">{{ avatarChar }}</div>
          <span class="user-name">{{ auth.user?.name || '老板' }}</span>
          <span class="role-tag">{{ roleName }}</span>
          <div class="topbar-divider"></div>
          <button class="logout-btn" type="button" @click="handleLogout">退出登录</button>
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { firstLeafPath, modules, type MenuModule } from '@/config/menu'
import { showToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const currentModule = computed(() => String(route.meta.module ?? modules[0].key))
const currentMenu = computed(() => modules.find((m) => m.key === currentModule.value) ?? modules[0])
const currentModuleLabel = computed(() => currentMenu.value?.label ?? '')

const breadcrumb = computed(() => {
  const title = String(route.meta.title ?? '')
  return title ? `${currentModuleLabel.value} / ${title}` : currentModuleLabel.value
})

const avatarChar = computed(() => (auth.user?.name || '老板').charAt(0))
const roleName = computed(() => {
  const map: Record<string, string> = { boss: '老板', cashier: '收银员', finance: '财务' }
  return map[auth.user?.role ?? ''] ?? ''
})

function isActive(path: string): boolean {
  return route.path === path
}

function switchModule(m: MenuModule): void {
  router.push(firstLeafPath(m))
}

onMounted(() => {
  // 会话恢复校验：GET /auth/me 刷新用户信息；401 由 http.ts 统一清 token 跳登录
  if (auth.token) void auth.refresh()
})

function handleLogout(): void {
  auth.logout()
  showToast('已退出登录')
  router.replace('/login')
}
</script>
