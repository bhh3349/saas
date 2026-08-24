/** 菜单叶子：对应一个可路由页面 */
export interface MenuLeaf {
  type: 'leaf'
  key: string
  label: string
  path: string
  desc: string
}

/** 菜单分组：容纳多个叶子页面 */
export interface MenuGroup {
  type: 'group'
  key: string
  label: string
  children: MenuLeaf[]
}

export type MenuEntry = MenuLeaf | MenuGroup

/** 一级模块（侧边最左栏） */
export interface MenuModule {
  key: string
  label: string
  /** 图标（16x16 viewBox 内联 path，stroke 风格） */
  icon: string
  children: MenuEntry[]
}

/** 主框架导航结构：运营中心 + 报表中心（与 PRD / UI 设计输入文档一致） */
export const modules: MenuModule[] = [
  {
    key: 'ops',
    label: '运营中心',
    icon: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
    children: [
      { type: 'leaf', key: 'ops-home', label: '首页', path: '/ops/home', desc: '当日营业概览 · 当日订单 · 快捷入口' },
      {
        type: 'group',
        key: 'restaurant',
        label: '餐厅管理',
        children: [
          { type: 'leaf', key: 'tables', label: '桌台管理', path: '/ops/restaurant/tables', desc: '桌台区域 · 桌台管理' },
          { type: 'leaf', key: 'payments', label: '结账方式管理', path: '/ops/restaurant/payments', desc: '结账方式 · 券类管理 · 优惠折扣' },
          { type: 'leaf', key: 'print', label: '打印管理', path: '/ops/restaurant/print', desc: '档口管理 · 票据样式 · 打印设置 · 打印分配' },
          { type: 'leaf', key: 'business', label: '经营设置', path: '/ops/restaurant/business', desc: '必点菜设置 · 营业模式设置' },
        ],
      },
      {
        type: 'group',
        key: 'dishes',
        label: '菜品管理',
        children: [
          { type: 'leaf', key: 'dishes', label: '菜品库', path: '/ops/dishes', desc: '菜品档案 · 上下架 · 价格维护' },
          { type: 'leaf', key: 'dish-categories', label: '菜单分类', path: '/ops/dishes/categories', desc: '分类结构 · 排序 · 展示设置' },
          { type: 'leaf', key: 'dish-attributes', label: '菜品属性', path: '/ops/dishes/attributes', desc: '规格 · 做法 · 口味属性' },
        ],
      },
      {
        type: 'group',
        key: 'archive',
        label: '档案管理',
        children: [
          { type: 'leaf', key: 'shop-profile', label: '门店档案', path: '/ops/archive/shop', desc: '门店信息 · 营业时间 · 联系方式' },
          { type: 'leaf', key: 'role-profile', label: '角色档案', path: '/ops/archive/roles', desc: '老板 / 收银员 / 财务 固定角色' },
          { type: 'leaf', key: 'staff-profile', label: '员工档案', path: '/ops/archive/staff', desc: '员工账号 · 角色分配 · 启用停用' },
        ],
      },
      {
        type: 'group',
        key: 'system',
        label: '系统设置',
        children: [
          { type: 'leaf', key: 'devices', label: '设备监控', path: '/ops/system/devices', desc: '收银终端 · 在线状态 · 绑定管理' },
          { type: 'leaf', key: 'run-logs', label: '运行日志', path: '/ops/system/logs', desc: '操作日志 · 系统日志' },
        ],
      },
    ],
  },
  {
    key: 'report',
    label: '报表中心',
    icon: '<path d="M3 13.5V8.5M8 13.5V4.5M13 13.5V10.5"/><path d="M2 13.5h12"/>',
    children: [
      { type: 'leaf', key: 'report-home', label: '首页', path: '/report/home', desc: '营业概览（日 · 周 · 月） · 收入构成' },
      {
        type: 'group',
        key: 'sales',
        label: '营业数据',
        children: [
          { type: 'leaf', key: 'sales-overview', label: '综合营业统计', path: '/report/sales/overview', desc: '营业额 · 订单数 · 客单价综合统计' },
          { type: 'leaf', key: 'sales-promo', label: '促销活动统计', path: '/report/sales/promo', desc: '促销活动参与与效果统计' },
          { type: 'leaf', key: 'sales-area', label: '餐区/桌台营业统计', path: '/report/sales/area', desc: '按餐区 / 桌台的营业维度统计' },
          { type: 'leaf', key: 'sales-trend', label: '营业指标同环比', path: '/report/sales/trend', desc: '营业指标同比 / 环比趋势' },
        ],
      },
      {
        type: 'group',
        key: 'dishes-report',
        label: '菜品销售',
        children: [
          { type: 'leaf', key: 'dish-stats', label: '菜品销售统计', path: '/report/dishes/stats', desc: '菜品销量 / 销售额统计' },
          { type: 'leaf', key: 'dish-discount', label: '菜品优惠统计', path: '/report/dishes/discount', desc: '菜品维度优惠统计' },
          { type: 'leaf', key: 'dish-detail', label: '菜品销售明细', path: '/report/dishes/detail', desc: '菜品销售流水明细' },
          { type: 'leaf', key: 'dish-refund', label: '退菜统计', path: '/report/dishes/refund', desc: '退菜原因 · 退菜金额统计' },
        ],
      },
      {
        type: 'group',
        key: 'orders-report',
        label: '订单数据',
        children: [
          { type: 'leaf', key: 'order-detail', label: '店内订单明细', path: '/report/orders/detail', desc: '店内订单流水明细' },
          { type: 'leaf', key: 'order-sensitive', label: '敏感操作统计', path: '/report/orders/sensitive', desc: '敏感操作（改价 / 删单等）统计' },
          { type: 'leaf', key: 'order-dish-sensitive', label: '菜品敏感操作明细', path: '/report/orders/dish-sensitive', desc: '菜品维度敏感操作明细' },
        ],
      },
      {
        type: 'group',
        key: 'income-report',
        label: '收入数据',
        children: [
          { type: 'leaf', key: 'income-discount', label: '收入优惠统计', path: '/report/income/discount', desc: '优惠金额 / 优惠方式统计' },
          { type: 'leaf', key: 'income-coupon', label: '券收入统计', path: '/report/income/coupon', desc: '券核销与收入统计' },
          { type: 'leaf', key: 'income-detail', label: '收入优惠明细', path: '/report/income/detail', desc: '收入优惠流水明细' },
        ],
      },
    ],
  },
]

/** 递归收集所有叶子（用于生成路由） */
export function collectLeaves(): MenuLeaf[] {
  const leaves: MenuLeaf[] = []
  for (const m of modules) {
    for (const entry of m.children) {
      if (entry.type === 'leaf') leaves.push(entry)
      else leaves.push(...entry.children)
    }
  }
  return leaves
}

/** 取模块内第一个可路由页面路径（模块切换用） */
export function firstLeafPath(module: MenuModule): string {
  for (const entry of module.children) {
    if (entry.type === 'leaf') return entry.path
    if (entry.children.length > 0) return entry.children[0].path
  }
  return module.children[0] && module.children[0].type === 'group'
    ? module.children[0].children[0].path
    : '/'
}
