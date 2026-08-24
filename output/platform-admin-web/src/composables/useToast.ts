import { ref } from 'vue'

// 模块级状态，供 toast 组件与任意业务组件共享
const visible = ref(false)
const message = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

export function showToast(msg: string): void {
  message.value = msg
  visible.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = false
  }, 2200)
}

export function useToastState() {
  return { visible, message }
}
