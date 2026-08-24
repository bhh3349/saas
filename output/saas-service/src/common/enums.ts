/** 商家端用户角色（固定三种，不开放自定义） */
export enum UserRole {
  /** 老板：收银工作台 + App 后台管理 + 商家后台 Web 全量管理 */
  Boss = 'boss',
  /** 收银员（员工）：仅收银工作台 */
  Cashier = 'cashier',
  /** 财务：仅看账 */
  Finance = 'finance',
}

/** 用户账号状态 */
export enum UserStatus {
  Active = 'active',
  Disabled = 'disabled',
}

/** 店铺状态（本地快照，权威在 platform-service；用于业务接口即时拦截） */
export enum ShopStatus {
  Active = 'active',
  Disabled = 'disabled',
}

/** 桌台状态 */
export enum TableStatus {
  /** 空闲 */
  Idle = 'idle',
  /** 占用 / 就餐中 */
  Occupied = 'occupied',
}

/** 点餐模式 */
export enum OrderMode {
  /** 桌台模式 */
  Table = 'table',
  /** 叫号模式 */
  Ticket = 'ticket',
}

/** 菜品上下架状态 */
export enum DishStatus {
  /** 在售 */
  OnSale = 'on_sale',
  /** 已下架 */
  OffSale = 'off_sale',
}

/**
 * 订单状态
 * 流转：pending → confirmed → completed / on_account / void
 * on_account（挂账）可再经 settle 补收 → completed
 */
export enum OrderStatus {
  /** 待接单 / 制作中 */
  Pending = 'pending',
  /** 已接单 */
  Confirmed = 'confirmed',
  /** 已结账 */
  Completed = 'completed',
  /** 挂账（未收钱，可补收） */
  OnAccount = 'on_account',
  /** 拒单 / 作废 */
  Void = 'void',
}
