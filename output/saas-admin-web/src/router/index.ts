import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { collectLeaves, modules } from '@/config/menu'

// 由菜单配置生成叶子路由（后续各功能页逐步替换 component 即可）
const leafRoutes: RouteRecordRaw[] = collectLeaves().map((leaf) => {
  const module = modules.find((m) =>
    m.children.some(
      (e) =>
        (e.type === 'leaf' && e.path === leaf.path) ||
        (e.type === 'group' && e.children.some((l) => l.path === leaf.path)),
    ),
  )
  return {
    path: leaf.path,
    name: leaf.key,
    component: () => import('@/views/PlaceholderView.vue'),
    meta: {
      requiresAuth: true,
      title: leaf.label,
      desc: leaf.desc,
      module: module?.key ?? '',
    },
  }
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'app',
      component: () => import('@/views/AppView.vue'),
      redirect: '/ops/home',
      children: leafRoutes,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/ops/home',
    },
  ],
})

// 路由守卫：商家后台 Web 仅 boss 可用；未登录 / 非老板一律回登录页
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth) {
    if (!auth.token || !auth.user || auth.user.role !== 'boss') {
      return { path: '/login' }
    }
  }
  return true
})

export default router
