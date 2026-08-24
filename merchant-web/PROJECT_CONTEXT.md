# 项目交接文档（换电脑无缝接手用）

> 本文件是唯一交接入口。新电脑上的 CodeBuddy 打开本项目后，先读本文件 + `D:\c\Users\Administrator\Documents\设置.txt`（页面清单与美团链接），即可无缝接手。

## 一、项目是什么

餐饮收银 SaaS 商户后台 Web 端，用 **React 18 + TypeScript + Vite**，无 UI 组件库，样式全部自写在 `src/styles/global.css`。设计稿 1600×900 按视口缩放适配。

## 二、关键目录

- `src/App.tsx` — 路由中心，按菜单 key 用 `switch` 渲染页面组件
- `src/data/navigation.ts` — 左侧菜单（全部 9 个目标页面的 key/label 已定义好，勿改）
- `src/views/` — 页面组件（每个 .tsx 一个页面）
- `src/components/` — 共享组件（见下）
- `src/styles/global.css` — 全局样式（含全部已完成页面用到的 class）

## 三、共享组件与样式约定（新页面必须复用）

| 组件 | 用途 |
|---|---|
| `SearchForm` | 查询栏。props: `fields`（key/label/type/placeholder/width/options）、`values`、`onChange(k,v)`、`onSearch`、`onReset` |
| `ConfirmModal` | 删除确认弹窗。props: `open/title/message/onConfirm/onCancel` |
| `Toast` | 提示。props: `data`（`{type:'success'|'warning', message}`）、`onClose` |

**样式 class（global.css 中已有）：**
- 页面骨架：`.page` > `.page-head`（`.page-title` + `.page-actions`）+ `.checkout-panel`
- 表格：`.data-table.checkout-table` > `.table-head`（`.th`）+ `.table-body`（`.table-row`，每行是 `.td`，列宽用 inline `style={{width}}`，弹性列用 `flex:1`）；空态 `.table-empty-row`
- 左右布局（分类树 + 列表）：`.print-assign-body` 内放 `.category-sidebar`（`.category-tree`/`.category-item.active`/`.category-name`/`.category-count`）+ 右侧面板
- 弹窗：`.modal-overlay` > `.modal-content`（`checkout-modal-md`=400px / `checkout-modal-lg`）+ `.modal-header`/`.modal-body`/`.modal-footer`；表单行 `.checkout-form-row`（label + `.checkout-form-control`，多选项用 `.radio-group`/`.radio-item`）；只读详情 `.checkout-view`/`.checkout-view-row`/`.checkout-view-label`/`.checkout-view-value`
- 状态标签：`.status-tag` + `.status-on`（绿）/`.status-off`（灰）
- 开关：`.setting-switch`（checkbox + `.setting-switch-track`/`.setting-switch-thumb`）
- 按钮：`.saas-btn` / `.saas-btn-primary` / `.saas-btn-default`；行内操作 `.link`；分页 `.table-pagination`/`.page-total`/`.page-nav`

## 四、页面清单与进度（9 个）

| # | 页面 | 美团链接 | 状态 |
|---|---|---|---|
| 1 | 打印分配 | https://pos.meituan.com/web/operation/dish-print-config-list#/rms-printer/dish-print-config-list | ✅ 已完成 `src/views/PrintAssign.tsx` |
| 2 | 必点菜设置 | https://pos.meituan.com/web/operation/rms-table/mandatory-dishes#/rms-table/mandatory-dishes | ✅ 已完成 `src/views/MustDish.tsx` |
| 3 | 营业模式设置 | https://pos.meituan.com/web/operation/rms-merchant-business-switch-config#/rms-merchant-business-switch-config/config-list/business | ✅ 已完成 `src/views/BusinessMode.tsx` |
| 4 | 菜品库 | https://pos.meituan.com/web/operation/goods/list#/rms-goods/goods/list | ⬜ 待做（列表结构已抓取：左侧分类+查询栏+表格，列=菜品名称/分类/类型/价格/编码/规格编码/会员价/状态；操作=编辑/停售/删除；批量在售/停售） |
| 5 | 菜品分类 | https://pos.meituan.com/web/operation/goods/category#/rms-goods/goods/category/list | ⬜ 待做 |
| 6 | 菜品属性 | https://pos.meituan.com/web/operation/goodsv2/attribute#/rms-goods-attributes/goods/attribute/list | ⬜ 待做 |
| 7 | 门店档案 | https://pos.meituan.com/web/operation/rms-merchant-store-profile#/rms-merchant-store-profile/info/detail | ⬜ 待做 |
| 8 | 员工档案 | https://pos.meituan.com/web/operation/rms-merchant-staff-manage#/rms-merchant-staff/staff/list | ⬜ 待做 |
| 9 | 角色档案 | https://pos.meituan.com/web/operation/rms-merchant-role/roleManage#/rms-merchant-role/roles | ⬜ 待做 |

**路由 key（App.tsx 的 switch case）与菜单一致：** `ops:print:assign` / `ops:business:must` / `ops:business:mode` / `ops:dish:library` / `ops:dish:category` / `ops:dish:attribute` / `ops:archive:store` / `ops:archive:staff` / `ops:archive:role`。未实现的 key 目前落到 `PlaceholderView`，实现后替换。

## 五、已完成页面的实现模式（照抄即可对齐）

1. **数据**：页面内定义 TypeScript interface + mock 数组；用 localStorage 持久化（key 前缀 `merchant.*`，统一 `load<T>(key,fallback)` / `save<T>(key,data)` 工具函数写在页面内）。
2. **交互**：新增/编辑共用一个受控 form 弹窗；行操作=查看/编辑/删除/启用停用（用 `.link`）；弹窗里 `checkout-form-row` 布局。
3. **路由注册**：在 `App.tsx` 顶部 `import` 页面，在 switch 中加 `case 'ops:xxx': return <Xxx />;`。
4. 参考实现：`PrintAssign.tsx`（分类树+列表）、`MustDish.tsx`（弹窗表单+查看详情）、`BusinessMode.tsx`（分组设置+开关）。

## 六、工作方法（务必遵守）

1. **先抓美团原页面**：用 browser-skill（bsk CLI 打开美团管家对应链接，登录态需浏览器已登录）`document.body.innerText` 提取页面结构、列名、按钮、弹窗字段。
2. **再改造成我们的页面**：套用第五节风格，字段/功能与美团对齐但**去掉我们系统用不着的**（如美团特有的外卖、团购、宴会、排队、寄存、订金、效期等模块，只保留店内收银核心场景）。
3. **审查原则**：保留通用的、店内收银必要的功能；删掉明显用不着的（比如菜品库里美团外卖/淘宝闪购相关 tab、宴会类开关）。
4. 完成一个页面就编译检查一次：`cd d:/c/saas/merchant-web && npx tsc --noEmit -p tsconfig.json`，0 错误后才算完成。

## 七、当前状态说明

- 编译当前应通过（0 错误）。
- 修改过的文件：`src/App.tsx`（+3 页面路由）、`src/views/{PrintAssign,MustDish,BusinessMode}.tsx`、`src/styles/global.css`（追加了 `print-assign-*`、`category-*`、`setting-switch` 等样式）、`src/data/navigation.ts`。
- 下一步：从第 4 项「菜品库」开始，按第六节方法依次完成 5~9。
