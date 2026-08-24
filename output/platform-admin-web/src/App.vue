<template>
  <RouterView />
  <div class="toast" :class="{ show: visible }">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8.5L6 12L13.5 4.5"/></svg>
    <span>{{ message }}</span>
  </div>
</template>

<script setup lang="ts">
import { useToastState } from '@/composables/useToast'

const { visible, message } = useToastState()
</script>
