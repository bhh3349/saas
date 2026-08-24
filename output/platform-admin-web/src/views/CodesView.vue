<template>
  <section class="page">
    <div class="page-head">
      <h2 class="page-title">激活码管理</h2>
      <p class="page-desc">管理 POS 收银终端的激活码，支持批量生成、作废与查询</p>
    </div>

    <div class="toolbar">
      <button class="btn btn-primary" @click="openBatch">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg>
        批量生成
      </button>
      <button class="btn btn-secondary" :disabled="exporting" @click="handleExport">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2V10.5M8 10.5L5 7.5M8 10.5L11 7.5"/><path d="M2.5 11.5V13A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13v-1.5"/></svg>
        导出
      </button>
      <div class="toolbar-spacer"></div>
      <input class="input w-200" id="codeBatchFilter" v-model="filters.batch_no" type="text" placeholder="批次号，如 BATCH001" @keyup.enter="handleSearch">
      <div class="dd w-140" :class="{ open: statusOpen }" id="codeStatusDD">
        <button class="dd-trigger" type="button" aria-haspopup="listbox" :aria-expanded="statusOpen" @click.stop="toggleStatus">
          <span class="dd-label">{{ statusLabel }}</span>
          <svg class="dd-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#8A8F99" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="dd-panel" role="listbox">
          <button v-for="opt in statusOptions" :key="opt.value" class="dd-option" :class="{ selected: filters.status === opt.value }" type="button" role="option" @click="selectStatus(opt.value)">{{ opt.label }}</button>
        </div>
      </div>
      <button class="btn btn-primary" @click="handleSearch">查询</button>
      <button class="btn btn-ghost" @click="handleReset">重置</button>
    </div>

    <div class="table-card">
      <div class="table-wrap" id="codesTableWrap">
        <div class="table-loading" v-if="loading">
          <div style="padding:8px 0;">
            <div v-for="i in 4" :key="i" class="skeleton-row">
              <div class="skeleton-bar" style="width:170px"></div>
              <div class="skeleton-bar" style="width:80px"></div>
              <div class="skeleton-bar" style="width:70px"></div>
              <div class="skeleton-bar" style="width:120px"></div>
              <div class="skeleton-bar" style="width:120px"></div>
              <div class="skeleton-bar" style="width:130px"></div>
              <div class="skeleton-bar" style="width:50px"></div>
            </div>
          </div>
        </div>

        <!-- 错误态 -->
        <div v-else-if="errorMsg" class="empty-inline">
          <div style="padding:56px 0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="#F04545" stroke-width="2"><circle cx="24" cy="24" r="21"/><path d="M24 13V28M24 33.5V33.51" stroke-linecap="round"/></svg>
            <div style="font-size:15px;font-weight:600;color:var(--ink);">加载数据失败</div>
            <div style="font-size:13px;color:var(--ink-subtle);">无法获取激活码列表，请检查网络后重试</div>
            <div style="margin-top:4px;"><button class="btn btn-secondary" @click="loadCodes(1)">重新加载</button></div>
          </div>
        </div>

        <!-- 空态 -->
        <div v-else-if="codes.length === 0" class="empty-inline">
          <div style="padding:56px 0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;">
            <svg width="44" height="44" viewBox="0 0 64 64" fill="none" stroke="#61666E" stroke-width="2"><rect x="12" y="16" width="40" height="36" rx="4"/><path d="M20 32H44M20 40H36"/></svg>
            <div style="font-size:15px;font-weight:600;color:var(--ink);">暂无激活码</div>
            <div style="font-size:13px;color:var(--ink-subtle);">当前筛选条件下没有数据，尝试调整批次号或状态</div>
          </div>
        </div>

        <table v-else class="table" id="codesTable">
          <thead>
            <tr>
              <th style="width:170px">激活码</th>
              <th style="width:90px">批次号</th>
              <th style="width:90px">状态</th>
              <th style="width:150px">绑定店铺</th>
              <th style="width:130px">绑定时间</th>
              <th style="width:140px">创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in codes" :key="c.code">
              <td class="cell-mono cell-strong">{{ c.code }}</td>
              <td><span class="cell-dim">{{ c.batch_no }}</span></td>
              <td>
                <span class="tag" :class="codeTagClass(c.status)"><span class="dot"></span>{{ codeTagText(c.status) }}</span>
              </td>
              <td v-if="c.status === 'used'"><span class="cell-strong">{{ c.shop_name || '—' }}</span></td>
              <td v-else><span class="cell-dim">—</span></td>
              <td v-if="c.status === 'used'"><span class="cell-dim">{{ c.bound_at ? formatDateTime(c.bound_at) : '—' }}</span></td>
              <td v-else><span class="cell-dim">—</span></td>
              <td><span class="cell-dim">{{ formatDateTime(c.created_at) }}</span></td>
              <td>
                <span v-if="c.status === 'void'" class="action-muted">已作废</span>
                <span v-else class="cell-action action-danger" @click="openVoid(c.code)">作废</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="pagination">
      <span class="page-info" id="codesPageInfo">{{ pageInfo }}</span>
      <div class="pager" id="codesPager">
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

    <!-- ==================== 批量生成弹窗 ==================== -->
    <div class="modal-backdrop" :class="{ open: showBatch }">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="batchTitle">
        <div class="modal-header">
          <span class="modal-title" id="batchTitle">批量生成激活码</span>
          <button class="modal-close" @click="showBatch = false">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3L11 11M11 3L3 11"/></svg>
          </button>
        </div>
        <div class="modal-divider"></div>
        <div class="modal-body">
          <div class="gen-format-hint">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 7V11M8 4.8V4.81"/></svg>
            <span>激活码为 12 位大小写字母 + 数字，无分隔符，注意区分大小写</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="genQty">生成数量 *</label>
            <input class="input" id="genQty" v-model.number="batchForm.count" type="number" min="1" max="1000" :class="{ 'has-error': batchErrors.count }" placeholder="请输入 1-1000 之间的数字">
            <div class="field-error" :class="{ show: batchErrors.count }">请输入 1-1000 之间的数字</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="genBatch">批次号</label>
            <input class="input" id="genBatch" v-model.trim="batchForm.batch_no" type="text" :class="{ 'has-error': batchErrors.batch_no }" placeholder="如 BATCH2026">
            <div class="field-error" :class="{ show: batchErrors.batch_no }">请输入批次号</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showBatch = false">取消</button>
          <button class="btn btn-primary" :class="{ loading: batchLoading }" id="genSubmitBtn" @click="confirmBatch">
            <span class="spinner"></span>
            <span class="btn-label">立即生成</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== 作废确认弹窗 ==================== -->
    <div class="modal-backdrop" :class="{ open: showVoid }">
      <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
        <div class="modal-header">
          <span class="modal-title" id="confirmTitle">作废激活码</span>
          <button class="modal-close" @click="showVoid = false">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3L11 11M11 3L3 11"/></svg>
          </button>
        </div>
        <div class="modal-divider"></div>
        <div class="modal-body">
          <div class="confirm-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 6V15M12 18.5V18.51"/></svg>
          </div>
          <p class="confirm-desc">确认作废激活码 <strong>{{ voidCode }}</strong>？</p>
          <div class="confirm-warn">作废后该激活码无法恢复，已绑定的店铺将无法正常使用收银服务。</div>
          <p class="confirm-hint">你可随时重新启用该店铺。</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showVoid = false">取消</button>
          <button class="btn btn-danger" :class="{ loading: voidLoading }" id="confirmOkBtn" @click="confirmVoid">
            <span class="spinner" style="border-color:rgba(255,255,255,.3);border-top-color:#fff;"></span>
            <span class="btn-label">确认作废</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { batchCreateApi, exportCodesApi, listCodesApi, voidCodeApi } from '@/api/codes'
import { showToast } from '@/composables/useToast'
import type { ActivationCode, CodeStatus } from '@/api/types'
import { formatDateTime } from '@/utils/format'

const PAGE_SIZE = 20

const codes = ref<ActivationCode[]>([])
const total = ref(0)
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pageInfo = computed(() =>
  total.value ? `共 ${total.value} 条记录 · 第 ${page.value} / ${totalPages.value} 页` : '共 0 条记录',
)

const loading = ref(false)
const errorMsg = ref('')
const exporting = ref(false)

const filters = reactive<{ batch_no: string; status: CodeStatus | '' }>({
  batch_no: '',
  status: '',
})

// ---------- 状态自定义下拉 ----------
const statusOpen = ref(false)
const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'unused', label: '未使用' },
  { value: 'used', label: '已绑定' },
  { value: 'void', label: '已作废' },
] as const
const statusLabel = computed(() => statusOptions.find(o => o.value === filters.status)?.label ?? '全部状态')

function toggleStatus() {
  statusOpen.value = !statusOpen.value
}

function selectStatus(v: '' | CodeStatus) {
  filters.status = v
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

function codeTagClass(status: CodeStatus): string {
  if (status === 'unused') return 'tag-success'
  if (status === 'used') return 'tag-primary'
  return 'tag-muted'
}

function codeTagText(status: CodeStatus): string {
  if (status === 'unused') return '未使用'
  if (status === 'used') return '已绑定'
  return '已作废'
}

/** 请求序号：快速切换筛选/翻页时丢弃过期响应，避免旧数据覆盖新数据 */
let listSeq = 0

async function loadCodes(targetPage = 1) {
  const seq = ++listSeq
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await listCodesApi({
      batch_no: filters.batch_no || undefined,
      status: filters.status || undefined,
      page: targetPage,
      page_size: PAGE_SIZE,
    })
    if (seq !== listSeq) return // 已发出更新的请求，丢弃本次结果
    codes.value = res.items
    total.value = res.total
    page.value = targetPage
  } catch (err: unknown) {
    if (seq !== listSeq) return
    errorMsg.value = err instanceof Error ? err.message : '加载失败'
    codes.value = []
    total.value = 0
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

function handleSearch() {
  loadCodes(1)
}

function handleReset() {
  filters.batch_no = ''
  filters.status = ''
  loadCodes(1)
}

function goPage(p: number | string) {
  if (typeof p !== 'number') return
  if (p < 1 || p > totalPages.value || p === page.value) return
  loadCodes(p)
}

// ---------- 批量生成 ----------
const showBatch = ref(false)
const batchLoading = ref(false)
const batchForm = reactive({ count: 100, batch_no: '' })
const batchErrors = reactive({ count: false, batch_no: false })

function openBatch() {
  batchForm.count = 100
  batchForm.batch_no = ''
  batchErrors.count = false
  batchErrors.batch_no = false
  showBatch.value = true
}

async function confirmBatch() {
  if (batchLoading.value) return
  batchErrors.count = !Number.isInteger(batchForm.count) || batchForm.count < 1 || batchForm.count > 1000
  batchErrors.batch_no = !batchForm.batch_no
  if (batchErrors.count || batchErrors.batch_no) return

  batchLoading.value = true
  try {
    const res = await batchCreateApi({
      count: batchForm.count,
      batch_no: batchForm.batch_no,
    })
    showBatch.value = false
    showToast(`已生成 ${res.count} 个激活码，批次 ${res.batch_no}`)
    handleSearch()
  } catch (err: unknown) {
    showToast(err instanceof Error ? err.message : '生成失败')
  } finally {
    batchLoading.value = false
  }
}

// ---------- 作废 ----------
const showVoid = ref(false)
const voidCode = ref('')
const voidLoading = ref(false)

function openVoid(code: string) {
  voidCode.value = code
  showVoid.value = true
}

async function confirmVoid() {
  if (voidLoading.value) return
  voidLoading.value = true
  try {
    await voidCodeApi(voidCode.value)
    showVoid.value = false
    showToast('激活码已作废')
    handleSearch()
  } catch (err: unknown) {
    showToast(err instanceof Error ? err.message : '作废失败')
  } finally {
    voidLoading.value = false
  }
}

// ---------- 导出 ----------
async function handleExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    await exportCodesApi({
      batch_no: filters.batch_no || undefined,
      status: filters.status || undefined,
    })
    showToast('导出成功')
  } catch (err: unknown) {
    showToast(err instanceof Error ? err.message : '导出失败')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeDD)
  loadCodes(1)
})
onBeforeUnmount(() => document.removeEventListener('click', closeDD))
</script>
