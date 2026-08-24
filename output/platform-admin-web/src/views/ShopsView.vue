<template>
  <section class="page">
    <div class="page-head">
      <h2 class="page-title">店铺管理</h2>
      <p class="page-desc">管理已激活的收银店铺，支持停用 / 启用与搜索</p>
    </div>

    <div class="toolbar">
      <input class="input w-260" id="shopSearch" v-model.trim="keyword" type="text" placeholder="搜索店铺名 / 手机号" @keyup.enter="handleSearch">
      <div class="dd w-140" :class="{ open: statusOpen }" id="shopStatusDD">
        <button class="dd-trigger" type="button" aria-haspopup="listbox" :aria-expanded="statusOpen" @click.stop="toggleStatus">
          <span class="dd-label">{{ statusLabel }}</span>
          <svg class="dd-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#8A8F99" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="dd-panel" role="listbox">
          <button v-for="opt in statusOptions" :key="opt.value" class="dd-option" :class="{ selected: status === opt.value }" type="button" role="option" @click="selectStatus(opt.value)">{{ opt.label }}</button>
        </div>
      </div>
      <button class="btn btn-primary" @click="handleSearch">查询</button>
      <button class="btn btn-ghost" @click="handleReset">重置</button>
    </div>

    <div class="table-card">
      <div class="table-wrap" id="shopsTableWrap">
        <div class="table-loading" v-if="loading">
          <div style="padding:8px 0;">
            <div v-for="i in 4" :key="i" class="skeleton-row">
              <div class="skeleton-bar" style="width:220px"></div>
              <div class="skeleton-bar" style="width:80px"></div>
              <div class="skeleton-bar" style="width:130px"></div>
              <div class="skeleton-bar" style="width:160px"></div>
              <div class="skeleton-bar" style="width:140px"></div>
              <div class="skeleton-bar" style="width:90px"></div>
              <div class="skeleton-bar" style="width:50px"></div>
            </div>
          </div>
        </div>

        <!-- 错误态 -->
        <div v-else-if="errorMsg" class="empty-inline">
          <div style="padding:56px 0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="#F04545" stroke-width="2"><circle cx="24" cy="24" r="21"/><path d="M24 13V28M24 33.5V33.51" stroke-linecap="round"/></svg>
            <div style="font-size:15px;font-weight:600;color:var(--ink);">加载数据失败</div>
            <div style="font-size:13px;color:var(--ink-subtle);">无法获取店铺列表，请检查网络后重试</div>
            <div style="margin-top:4px;"><button class="btn btn-secondary" @click="loadShops(1)">重新加载</button></div>
          </div>
        </div>

        <!-- 空态 -->
        <div v-else-if="shops.length === 0" class="empty-inline">
          <div style="padding:56px 0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;">
            <svg width="44" height="44" viewBox="0 0 64 64" fill="none" stroke="#61666E" stroke-width="2"><rect x="12" y="16" width="40" height="36" rx="4"/><path d="M20 32H44M20 40H36"/></svg>
            <div style="font-size:15px;font-weight:600;color:var(--ink);">暂无店铺</div>
            <div style="font-size:13px;color:var(--ink-subtle);">当前筛选条件下没有数据，尝试调整关键词或状态</div>
          </div>
        </div>

        <table v-else class="table" id="shopsTable">
          <thead>
            <tr>
              <th style="width:220px">店铺名称</th>
              <th style="width:80px">联系人</th>
              <th style="width:130px">联系方式</th>
              <th style="width:160px">激活码</th>
              <th style="width:140px">注册时间</th>
              <th style="width:90px">状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in shops" :key="s.id">
              <td class="cell-strong">{{ s.name }}</td>
              <td>{{ s.contact || '—' }}</td>
              <td class="cell-mono" style="font-size:13px;">{{ s.phone || '—' }}</td>
              <td class="cell-mono" style="font-size:13px;">{{ s.activation_code || '—' }}</td>
              <td><span class="cell-dim">{{ formatDateTime(s.created_at) }}</span></td>
              <td>
                <span class="tag" :class="s.status === 'active' ? 'tag-success' : 'tag-danger'"><span class="dot"></span>{{ s.status === 'active' ? '正常' : '已停用' }}</span>
              </td>
              <td>
                <span v-if="s.status === 'disabled'" class="cell-action action-ok" @click="askToggleShop(s, 'enable')">启用</span>
                <span v-else class="cell-action action-danger" @click="askToggleShop(s, 'disable')">停用</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="pagination">
      <span class="page-info" id="shopsPageInfo">{{ pageInfo }}</span>
      <div class="pager" id="shopsPager">
        <button class="pager-btn" :disabled="page <= 1" @click="goPage(page - 1)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4L6 8L10 12"/></svg>
        </button>
        <template v-for="p in pageList" :key="p">
          <span v-if="p === '…'" class="pager-ellipsis">…</span>
          <button v-else class="pager-btn" :class="{ active: p === page }" @click="goPage(p)">{{ p }}</button>
        </template>
        <button class="pager-btn" :disabled="page >= totalPages" @click="goPage(page + 1)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4L10 8L6 12"/></svg>
        </button>
      </div>
    </div>

    <!-- ==================== 停用 / 启用确认弹窗 ==================== -->
    <div class="modal-backdrop" :class="{ open: showConfirm }">
      <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="shopConfirmTitle">
        <div class="modal-header">
          <span class="modal-title" id="shopConfirmTitle">{{ confirmMode === 'disable' ? '确认停用店铺' : '确认启用店铺' }}</span>
          <button class="modal-close" @click="showConfirm = false">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3L11 11M11 3L3 11"/></svg>
          </button>
        </div>
        <div class="modal-divider"></div>
        <div class="modal-body">
          <div class="confirm-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 6V15M12 18.5V18.51"/></svg>
          </div>
          <p class="confirm-desc">确认{{ confirmMode === 'disable' ? '停用' : '启用' }}店铺「<strong>{{ confirmShop?.name }}</strong>」？</p>
          <div class="confirm-warn">
            {{ confirmMode === 'disable' ? '停用后该店所有员工无法登录、无法使用收银业务（立即生效）。' : '启用后该店所有员工可立即恢复登录与收银业务。' }}
          </div>
          <p class="confirm-hint">你可随时重新启用该店铺。</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showConfirm = false">取消</button>
          <button class="btn btn-danger" :class="{ loading: confirmLoading }" id="shopConfirmOkBtn" @click="confirmToggle">
            <span class="spinner" style="border-color:rgba(255,255,255,.3);border-top-color:#fff;"></span>
            <span class="btn-label">{{ confirmMode === 'disable' ? '确认停用' : '确认启用' }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { listShopsApi, updateShopStatusApi } from '@/api/shops'
import { showToast } from '@/composables/useToast'
import type { Shop, ShopStatus } from '@/api/types'
import { formatDateTime } from '@/utils/format'

const PAGE_SIZE = 20

const shops = ref<Shop[]>([])
const total = ref(0)
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pageInfo = computed(() =>
  total.value ? `共 ${total.value} 条记录 · 第 ${page.value} / ${totalPages.value} 页` : '共 0 条记录',
)

const loading = ref(false)
const errorMsg = ref('')
const keyword = ref('')
const status = ref<'' | ShopStatus>('')

// ---------- 状态自定义下拉 ----------
const statusOpen = ref(false)
const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '正常' },
  { value: 'disabled', label: '已停用' },
] as const
const statusLabel = computed(() => statusOptions.find(o => o.value === status.value)?.label ?? '全部状态')

function toggleStatus() {
  statusOpen.value = !statusOpen.value
}

function selectStatus(v: '' | ShopStatus) {
  status.value = v
  statusOpen.value = false
  handleSearch()
}

function closeDD() {
  statusOpen.value = false
}

/** 页码序列：总页数 > 7 时省略中间，保留当前页前后各 2 页，可直达任意页 */
const pageList = computed<(number | string)[]>(() => {
  const last = totalPages.value
  const cur = page.value
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const pages = new Set<number>([1, last])
  for (let p = cur - 2; p <= cur + 2; p++) {
    if (p >= 2 && p <= last - 1) pages.add(p)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const out: (number | string)[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
})

/** 请求序号：快速切换筛选/翻页时丢弃过期响应，避免旧数据覆盖新数据 */
let listSeq = 0

async function loadShops(targetPage = 1) {
  const seq = ++listSeq
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await listShopsApi({
      keyword: keyword.value || undefined,
      status: status.value || undefined,
      page: targetPage,
      page_size: PAGE_SIZE,
    })
    if (seq !== listSeq) return // 已发出更新的请求，丢弃本次结果
    shops.value = res.items
    total.value = res.total
    page.value = targetPage
  } catch (err: unknown) {
    if (seq !== listSeq) return
    errorMsg.value = err instanceof Error ? err.message : '加载失败'
    shops.value = []
    total.value = 0
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

function handleSearch() {
  loadShops(1)
}

function handleReset() {
  keyword.value = ''
  status.value = ''
  loadShops(1)
}

function goPage(p: number | string) {
  if (typeof p !== 'number') return
  if (p < 1 || p > totalPages.value || p === page.value) return
  loadShops(p)
}

// ---------- 停用 / 启用 ----------
const showConfirm = ref(false)
const confirmLoading = ref(false)
const confirmShop = ref<Shop | null>(null)
const confirmMode = ref<'disable' | 'enable'>('disable')

function askToggleShop(shop: Shop, mode: 'disable' | 'enable') {
  confirmShop.value = shop
  confirmMode.value = mode
  showConfirm.value = true
}

async function confirmToggle() {
  if (confirmLoading.value || !confirmShop.value) return
  confirmLoading.value = true
  try {
    await updateShopStatusApi(confirmShop.value.id, confirmMode.value === 'disable' ? 'disabled' : 'active')
    showConfirm.value = false
    showToast(confirmMode.value === 'disable' ? '店铺已停用' : '店铺已启用')
    handleSearch()
  } catch (err: unknown) {
    showToast(err instanceof Error ? err.message : '操作失败')
  } finally {
    confirmLoading.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeDD)
  loadShops(1)
})
onBeforeUnmount(() => document.removeEventListener('click', closeDD))
</script>
