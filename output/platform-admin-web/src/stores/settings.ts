import { defineStore } from 'pinia'
import { getSettingsApi } from '@/api/settings'
import type { SystemSetting } from '@/api/types'

export const DEFAULT_SYSTEM_NAME = '收银云'

interface SettingsState {
  systemName: string
  logo: string | null
  favicon: string | null
  loaded: boolean
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    systemName: DEFAULT_SYSTEM_NAME,
    logo: null,
    favicon: null,
    loaded: false,
  }),

  actions: {
    /** 拉取品牌设置并全局生效（登录页/后台通用） */
    async load() {
      try {
        const s = await getSettingsApi()
        this.setSettings(s)
        this.loaded = true
      } catch {
        this.loaded = false
      }
    },

    /** 应用到 document.title 与 favicon */
    applyGlobal() {
      document.title = this.systemName ? `${this.systemName} · 平台后台` : '平台后台'
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = this.favicon || '/favicon.svg'
    },

    setSettings(s: SystemSetting) {
      this.systemName = s.system_name?.trim() || DEFAULT_SYSTEM_NAME
      this.logo = s.logo || null
      this.favicon = s.favicon || null
      this.applyGlobal()
    },
  },
})
