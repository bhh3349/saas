import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useSettingsStore } from './stores/settings'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// 拉取品牌设置（系统名称 / logo / favicon），登录页与后台均生效
void useSettingsStore().load()
