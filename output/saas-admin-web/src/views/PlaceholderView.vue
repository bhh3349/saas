<template>
  <div class="app-body">
    <div class="placeholder">
      <div class="placeholder-icon">
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="4" y="5" width="24" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M9 27h14M11 12h10M10 16.5c2.5 1.2 5.5 1.2 8 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <h2>{{ title }}</h2>
      <p>{{ desc }}</p>
      <div class="tag"><b>●</b> {{ moduleLabel }} · 功能开发中，敬请期待</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { modules } from '@/config/menu'

const route = useRoute()

const title = computed(() => String(route.meta.title ?? '页面'))
const desc = computed(() => String(route.meta.desc ?? '该功能模块正在建设中'))
const moduleLabel = computed(() => {
  const key = String(route.meta.module ?? '')
  return modules.find((m) => m.key === key)?.label ?? '商家后台'
})
</script>
