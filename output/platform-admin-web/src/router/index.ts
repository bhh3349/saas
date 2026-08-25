import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '@/api/http'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/',
      component: () => import('@/views/AppView.vue'),
      children: [
        {
          path: '',
          redirect: '/codes',
        },
        {
          path: 'codes',
          name: 'codes',
          component: () => import('@/views/CodesView.vue'),
        },
        {
          path: 'shops',
          name: 'shops',
          component: () => import('@/views/ShopsView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
        },
      ],
    },
  ],
})

// 全局守卫：未登录跳登录页
router.beforeEach((to) => {
  if (to.name !== 'login' && !getToken()) {
    return { name: 'login' }
  }
  if (to.name === 'login' && getToken()) {
    return { path: '/codes' }
  }
  return true
})

export default router
