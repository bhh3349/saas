/** 激活码状态：unused → used（注册绑定）/ void（作废），used / void 不可再变更 */
export enum CodeStatus {
  Unused = 'unused',
  Used = 'used',
  Void = 'void',
}

/** 店铺状态 */
export enum ShopStatus {
  Active = 'active',
  Disabled = 'disabled',
}

/** 平台运营角色 */
export enum Role {
  Admin = 'admin',
}
