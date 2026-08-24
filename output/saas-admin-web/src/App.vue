<template>
  <RouterView />
  <div class="toast-wrap">
    <div v-if="visible" class="toast" :class="type">
      <span>{{ message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useToastState } from '@/composables/useToast'

const { visible, message, type } = useToastState()
</script>
