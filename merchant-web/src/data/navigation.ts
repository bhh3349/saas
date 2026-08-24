export interface SubMenu {
  key: ViewKey;
  label: string;
  /** 三级子页（可选） */
  children?: SubMenu[];
}

export interface NavItem {
  /** 点击该菜单本身时进入的视图（有子菜单时取第一个子菜单） */
  key: ViewKey;
  label: string;
  /** 图标文件名（src/assets/svg 下的 SVG） */
  icon: string;
  sub?: SubMenu[];
}

export interface NavGroup {
  key: GroupKey;
  label: string;
  items: NavItem[];
}

export type GroupKey = 'ops' | 'rpt';
export type ViewKey =
  /* ===== 运营中心 ===== */
  | 'ops:home'
  /* 餐厅管理 */
  | 'ops:restaurant:table'
  | 'ops:checkout'
  | 'ops:checkout:coupon'
  | 'ops:checkout:discount'
  | 'ops:print:station'
  | 'ops:print:style'
  | 'ops:print:settings'
  | 'ops:print:assign'
  | 'ops:business:must'
  | 'ops:business:mode'
  /* 菜品管理 */
  | 'ops:dish:library'
  | 'ops:dish:category'
  | 'ops:dish:attribute'
  /* 档案管理 */
  | 'ops:archive:store'
  | 'ops:archive:role'
  | 'ops:archive:staff'
  /* 系统设置 */
  | 'ops:system:device'
  | 'ops:system:log'
  /* ===== 报表中心 ===== */
  | 'rpt:home'
  /* 营业数据 */
  | 'rpt:biz-stats'
  | 'rpt:promo-stats'
  | 'rpt:area-table-stats'
  | 'rpt:compare'
  /* 菜品销售 */
  | 'rpt:dish-sales'
  | 'rpt:dish-discount'
  | 'rpt:dish-detail'
  | 'rpt:dish-refund'
  /* 订单数据 */
  | 'rpt:in-store-orders'
  | 'rpt:sensitive-stats'
  | 'rpt:sensitive-detail'
  /* 收入数据 */
  | 'rpt:income-discount'
  | 'rpt:income-coupon'
  | 'rpt:income-discount-detail';

/** 根据视图 key 查找其菜单标签与所属分组（遍历全部菜单/子菜单） */
export function findViewMeta(key: ViewKey): { label: string; group: GroupKey } | null {
  const findInSub = (subs: SubMenu[]): string | null => {
    for (const s of subs) {
      if (s.key === key) return s.label;
      if (s.children) {
        const r = findInSub(s.children);
        if (r) return r;
      }
    }
    return null;
  };
  for (const g of NAV_GROUPS) {
    for (const item of g.items) {
      if (item.key === key) return { label: item.label, group: g.key };
      if (item.sub) {
        const label = findInSub(item.sub);
        if (label) return { label, group: g.key };
      }
    }
  }
  return null;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'ops',
    label: '运营中心',
    items: [
      { key: 'ops:home', label: '首页', icon: 'nav-home' },
      {
        key: 'ops:restaurant:table',
        label: '餐厅管理',
        icon: 'nav-restaurant',
        sub: [
          { key: 'ops:restaurant:table', label: '桌台管理' },
          {
            key: 'ops:checkout',
            label: '结账方式管理',
            children: [
              { key: 'ops:checkout', label: '结账方式管理' },
              { key: 'ops:checkout:coupon', label: '券类管理' },
              { key: 'ops:checkout:discount', label: '优惠折扣' },
            ],
          },
          {
            key: 'ops:print:station',
            label: '打印管理',
            children: [
              { key: 'ops:print:station', label: '档口管理' },
              { key: 'ops:print:style', label: '票据样式' },
              { key: 'ops:print:settings', label: '打印设置' },
              { key: 'ops:print:assign', label: '打印分配' },
            ],
          },
          {
            key: 'ops:business:must',
            label: '经营设置',
            children: [
              { key: 'ops:business:must', label: '必点菜设置' },
              { key: 'ops:business:mode', label: '营业模式设置' },
            ],
          },
        ],
      },
      {
        key: 'ops:dish:library',
        label: '菜品管理',
        icon: 'nav-dish',
        sub: [
          { key: 'ops:dish:library', label: '菜品库' },
          { key: 'ops:dish:category', label: '菜单分类' },
          { key: 'ops:dish:attribute', label: '菜品属性' },
        ],
      },
      {
        key: 'ops:archive:store',
        label: '档案管理',
        icon: 'nav-archive',
        sub: [
          { key: 'ops:archive:store', label: '门店档案' },
          { key: 'ops:archive:role', label: '角色档案' },
          { key: 'ops:archive:staff', label: '员工档案' },
        ],
      },
      {
        key: 'ops:system:device',
        label: '系统设置',
        icon: 'nav-settings',
        sub: [
          { key: 'ops:system:device', label: '设备监控' },
          { key: 'ops:system:log', label: '运行日志' },
        ],
      },
    ],
  },
  {
    key: 'rpt',
    label: '报表中心',
    items: [
      { key: 'rpt:home', label: '首页', icon: 'nav-report' },
      {
        key: 'rpt:biz-stats',
        label: '营业数据',
        icon: 'nav-revenue',
        sub: [
          { key: 'rpt:biz-stats', label: '综合营业统计' },
          { key: 'rpt:promo-stats', label: '促销活动统计' },
          { key: 'rpt:area-table-stats', label: '餐区/桌台营业统计' },
          { key: 'rpt:compare', label: '营业指标同环比' },
        ],
      },
      {
        key: 'rpt:dish-sales',
        label: '菜品销售',
        icon: 'nav-dish-sales',
        sub: [
          { key: 'rpt:dish-sales', label: '菜品销售统计' },
          { key: 'rpt:dish-discount', label: '菜品优惠统计' },
          { key: 'rpt:dish-detail', label: '菜品销售明细' },
          { key: 'rpt:dish-refund', label: '退菜统计' },
        ],
      },
      {
        key: 'rpt:in-store-orders',
        label: '订单数据',
        icon: 'nav-orders',
        sub: [
          { key: 'rpt:in-store-orders', label: '店内订单明细' },
          { key: 'rpt:sensitive-stats', label: '敏感操作统计' },
          { key: 'rpt:sensitive-detail', label: '菜品敏感操作明细' },
        ],
      },
      {
        key: 'rpt:income-discount',
        label: '收入数据',
        icon: 'nav-income',
        sub: [
          { key: 'rpt:income-discount', label: '收入优惠统计' },
          { key: 'rpt:income-coupon', label: '券收入统计' },
          { key: 'rpt:income-discount-detail', label: '收入优惠明细' },
        ],
      },
    ],
  },
];
