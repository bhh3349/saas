# 收银 App（uni-app x）开发接手指南

> 核对日期：2026-08-28
> 适用读者：接手收银 App（cashier-app/）的 uni-app x 开发人员
> 关联文档：《开发人员接手指南.md》（全项目总览）、《收银App开发方向分析.md》（选型背景）

---

## 0. 一句话快速定位

| 项 | 值 |
|---|---|
| 工程路径 | `d:\c\saas\cashier-app` |
| 技术选型 | **uni-app x（UTS 原生渲染）**，不复用 merchant-web React 代码，仅复用接口契约 / 枚举 / 金额规则 |
| 目标平台 | Android（优先）；iOS 未配置（saas-printer 插件仅实现 Android） |
| AppID | `__UNI__539B9A9`（DCloud 分配，需登录对应账号；换账号需在 manifest.json 重新获取） |
| 包名 | `com.saas.cashier` |
| 应用名 | 「收银」 |
| 编译方式 | **本地 Gradle 编译**（推荐，不排队）；云打包用于正式发布 |
| 后端对接 | saas-service :3200（模拟器 10.0.2.2:3200 / 真机局域网 IP） |
| 响应契约 | `{ code, message, data }`，code = 0 成功；Bearer token 鉴权 |
| 自研原生插件 | `uni_modules/saas-printer`（蓝牙 SPP + WiFi TCP 发送 ESC/POS 指令） |

---

## 1. 环境搭建（首次接手必做）

### 1.1 工具清单与安装顺序

```
① HBuilderX 5.x（uni-app x 必需）
   → ✅ 2026-09-06 已安装：**5.24 绿色版**，位置 `D:\dev-tools\HBuilderX\HBuilderX`（含 cli.exe），cashier-app 已导入
   → 命令行验证 UTS（无需 GUI）：
       cd D:\dev-tools\HBuilderX\HBuilderX
       cli open                                                                            # 启动 IDE（CLI 依赖主程序在线）
       cli compile app-android --project D:\c\saas\cashier-app --uni_module saas-printer   # 插件整模块编译（已验证 ✅）
       cli compile app-android --project D:\c\saas\cashier-app --file utils/esc-pos.uts    # 单文件（不解析 uni_modules 导入）
   → 2026-09-06 已验证编译通过：saas-printer 插件、utils/config、utils/request、utils/esc-pos、
     api/devices、api/receipt-style、api/orders、api/printers（5.24 编译器全绿）
   → 5.24 编译器适配写法（新代码必须遵守，插件已按此改）：
     ① then 回调内不能 return 另一个 Promise（改 async 函数 + resolve/reject 传参）
     ② .catch((err) => ...) 参数不要标 : Error 类型（重载匹配失败）
     ③ OutputStream.write 只收 kotlin ByteArray（插件内 toKtBytes()：new ByteArray(len.toInt()) + 循环 toByte()）
     ④ UTS number 转平台类型用 toInt() / toByte()
     ⑤ kotlin Set 用 iterator() 遍历（不能下标访问 / toArray）
     ⑥ 可空判空用 == null（!x 编译报错）
   → 整项目编译 / 运行到模拟器需登录 DCloud 账号（cli user login，未登录报「此功能需要先登录」）；
     登录后执行 cli publish app-android --type appResource --project D:\c\saas\cashier-app 完成 .uvue 页面级编译验证
   → ✅ 2026-09-06 整项目编译已通过（`publish app-android --type appResource`，产物 unpackage/resources/app-android），
     编译中修掉两个页面问题：uvue 不支持 `max-height: 75%`（改 rpx 值）、methods 里内联对象字面量类型
     `{ amount: number; ... }` 不支持（改具名 type）
   → ⚠️ **本机无法运行 Android 模拟器**（实测三条路全断）：AEHD 驱动触发内核蓝屏重启（已弃用）、
     本机 Windows 为精简版（无 WHPX/虚拟机平台可选功能）、`-no-accel` 纯软模式 QEMU 段错误（0xC0000005）。
     **运行验证请用真机**（USB 调试 + BASE_URL 改局域网 IP）或另一台完整版 Windows/带虚拟化的电脑
   → 文件 → 打开目录 → 选择 d:\c\saas\cashier-app（已导入过）

② JDK 17 LTS
   → 推荐 Microsoft Build of OpenJDK 17
   → 解压到 D:\dev-tools\jdk17
   → 用户级环境变量：JAVA_HOME = D:\dev-tools\jdk17；PATH 追加 %JAVA_HOME%\bin

③ Android SDK（compileSdk 34）
   → 下载 cmdline-tools（Android Studio 官网 Command line tools only）
   → 解压到 D:\dev-tools\android-sdk\cmdline-tools\latest
   → 安装核心组件：
       sdkmanager --sdk_root=D:\dev-tools\android-sdk "platform-tools" "platforms;android-34" "build-tools;34.0.0"
   → 环境变量：ANDROID_HOME = D:\dev-tools\android-sdk；PATH 追加 platform-tools

④ Gradle 8.11.1
   → 从 services.gradle.org 下载 bin 版并解压到 D:\dev-tools\gradle-8.11.1
   → （也可让 HBuilderX 首次运行自动下载 Gradle wrapper，但国内网络建议手动安装提速）

⑤ MuMu 模拟器（或真机 + USB 调试线）
   → MuMu 64-bit 下载安装
   → 启动后确保开发者选项：系统设置 → 关于 → 连续点版本号 → 打开 USB 调试
   → adb 连接：adb connect 127.0.0.1:16384（或 127.0.0.1:7555，MuMu 双端口兼容）
```

### 1.2 HBuilderX 本地编译路径配置（避免每次手动选）

打开 HBuilderX → 设置 → 源码视图（settings.json），写入：

```json
{
  "uts-development-android": {
    "sdkDir": "D:\\dev-tools\\android-sdk",
    "gradleHome": "D:\\dev-tools\\gradle-8.11.1",
    "javaHome": "D:\\dev-tools\\jdk17"
  }
}
```

> 注：三个路径必须都是绝对路径且真实存在；settings.json 配置后重启 HBuilderX 才能生效。生效后 `运行 → 运行到 Android App 基座` 会自动使用本地 Gradle/JDK/SDK 编译，不走云端队列。

### 1.3 验证 adb 连接

```powershell
D:\dev-tools\android-sdk\platform-tools\adb.exe devices
# 期望输出：
# List of devices attached
# 127.0.0.1:16384    device
# 192.168.1.20:5555  device
```

MuMu 默认 NAT 模式内访问宿主机（本机 saas-service）的正确地址是 **`http://10.0.2.2:3200`**（Android 模拟器标准映射），已在 config.uts 写入。

当前回归使用 MuMu **桥接网络**：模拟器 IP 为 `192.168.1.20`，宿主机/后端为 `192.168.1.5`，连接命令是 `adb connect 192.168.1.20:5555`。此模式下 App 可直接使用 `http://192.168.1.5:3200`，与真机局域网联调路径一致。

---

## 2. 项目目录结构

```
cashier-app/
├── manifest.json                    # 应用配置：appid、包名、Android 权限（蓝牙/WiFi/网络）
├── pages.json                       # 路由表：11 个页面，全自定义导航栏
├── main.uts                         # 入口：createSSRApp(App)
├── App.uvue                         # 根组件（全局异常处理 / 页面生命周期挂点）
├── uni.scss                         # 样式变量：主色 $uni-color-primary: #FF6A00
│
├── api/                             # 9 个接口模块（调用 saas-service）
│   ├── auth.uts                     # 登录/注册/me（LoginUser 含 shopName/shopAddress）
│   ├── areas.uts                    # 获取全部区域（收银员可用）
│   ├── tables.uts                   # 桌台列表 / 详情
│   ├── dishes.uts                   # 菜品列表（含分类、沽清状态）
│   ├── orders.uts                   # 订单 CRUD：创建/追加/详情/结账/今日列表/重开/接单/拒单
│   ├── payments.uts                 # 支付方式列表
│   ├── reports.uts                  # 今日营业额 fetchToday（home 页唯一数据）
│   └── printers.uts                 # 打印机 CRUD（收银 App 打印管理页调用）
│
├── utils/                           # 工具层
│   ├── config.uts                   # BASE_URL（模拟器=10.0.2.2:3200）/ TIMEOUT
│   ├── request.uts                  # uni.request 封装：{code,message,data} 契约 + Bearer + 401 回登录
│   ├── esc-pos.uts                  # ESC/POS 指令生成：buildReceipt / buildTestReceipt → Uint8Array
│   └── print-manager.uts            # 打印管理器：getDefaultPrinter(60s缓存) / printReceipt / printTest
│
├── pages/                           # 11 个页面（全 uvue + 自定义导航栏 navigationStyle:custom）
│   ├── login/index.uvue             # 登录页（手机号 + 密码）
│   ├── register/index.uvue          # 注册店铺页（激活码 12 位 + 店铺信息）
│   ├── home/index.uvue              # 收银工作台（顶部自定义导航栏 + 今日营业额 + 五入口）
│   ├── tables/index.uvue            # 桌台点餐（搜索 + 已就餐tab + 区域tabs + 双列卡片）
│   ├── order/index.uvue             # 点菜（分类tabs + 菜品列表 + 搜索 + 购物车角标）
│   ├── cart/index.uvue              # 购物车（菜品操作 + 整单备注 + 立即下单/下单并支付）
│   ├── order-detail/index.uvue      # 订单详情（概览 + 菜品明细 + 底部按钮动态）
│   ├── settle/index.uvue            # 结账（应收/优惠/实收/找零 + 支付方式 + 打印结账单）
│   ├── orders/index.uvue            # 今日订单管理（状态tabs + 汇总条 + 订单卡片）
│   ├── print/index.uvue             # 打印管理（打印机列表 + 启用/默认/测试）
│   └── print/add.uvue               # 添加打印机（蓝牙/WiFi 两种方式 + 纸宽设置）
│
├── uni_modules/
│   └── saas-printer/                # ★ 自研 UTS 原生打印插件
│       ├── package.json             # 插件元数据：type=uts，platforms: app-android
│       └── utssdk/
│           ├── index.uts            # 跨平台入口：条件编译 APP-ANDROID，sendBytes/isBluetoothEnabled/getPairedBluetooth
│           └── app-android/
│               └── index.uts        # Android 原生实现：
│                                    #   · sendBluetooth() → BluetoothSocket(SPP) 子线程 connect+write + 超时保护
│                                    #   · sendTcp()       → java.net.Socket + InetSocketAddress + connectTimeout
│                                    #   · isBluetoothEnabled() → BluetoothAdapter.isEnabled()
│                                    #   · getPairedDevices()  → 获取已配对蓝牙设备列表
│
└── .hbuilderx/launch.json           # 运行配置（由 HBuilderX 管理）
└── unpackage/                       # 构建产物（忽略入库）
    ├── debug/android_debug.apk      # ★ 本地编译的自定义调试基座 APK（14.8MB，含 saas-printer 插件）
    ├── cache/.app-android/src/      # UTS→Kotlin 转译产物（index.kt 含完整编译代码）
    └── dist/build|dev/.uvue/app-android/  # LSP/编译器中间产物
```

---

## 3. 关键架构与数据流

### 3.1 业务分层

```
┌──────────────────────────────────────────────────────────────┐
│  pages/*.uvue（页面层）                                        │
│   负责：UI 布局、用户交互、页面状态、路由跳转（uni.navigateTo）    │
│   调用：api/*.uts（接口） + utils/print-manager.uts（打印）     │
└────────────────────────────┬─────────────────────────────────┘
                             │
       ┌─────────────────────┴──────────────────────┐
       │                                            │
┌──────▼──────────┐                       ┌─────────▼──────────┐
│  api/*.uts      │                       │ print-manager.uts  │
│ （接口契约层）   │                       │（打印业务管理层）    │
│ request<T>()    │                       │ · 60s 默认打印机缓存│
│ {code,message,  │                       │ · printReceipt/Test │
│  data} 契约     │                       │ · 统一错误转义      │
└──────┬──────────┘                       └─────────┬──────────┘
       │                                            │
┌──────▼──────────┐                       ┌─────────▼──────────┐
│ request.uts     │                       │ esc-pos.uts        │
│（HTTP 封装）     │                       │（ESC/POS 指令生成） │
│ BASE_URL +      │                       │ Uint8Array 字节流   │
│ Bearer token    │                       │ 58mm / 80mm 两种宽  │
│ 401 → 登录失效   │                       └─────────┬──────────┘
└──────┬──────────┘                                 │
       │ saas-service :3200                 ┌───────▼──────────┐
       │                                    │ saas-printer     │
       │                                    │ （UTS 原生插件）   │
       │                                    │ 蓝牙 SPP / TCP   │
       │                                    │ 子线程+超时保护    │
       ▼                                    └──────────────────┘
  双 SQLite 后端（saas.db + platform.db）
```

### 3.2 完整业务闭环（核心流程）

```
登录 → 收银工作台
        │
        ├─ 桌台入口 → 桌台列表（搜索 + 区域tabs + 已就餐）
        │     │
        │     ├─ 点击空闲桌台 → 弹窗开台（人数+备注）→ 创建订单(PENDING) → 跳点菜
        │     │     │
        │     │     └─ 点菜（选菜）→ 购物车（菜品+备注）
        │     │           │
        │     │           ├─【立即下单】→ POST /orders → 返回桌台列表
        │     │           │    │
        │     │           │    └─ 再次点击该桌台 → 订单详情
        │     │           │         │
        │     │           │         ├─ 【去加菜】→ 跳到点菜界面 → 加菜 → POST /items → 回详情
        │     │           │         └─ 【去结账】→ 跳到结账页面
        │     │           │
        │     │           └─【下单并支付】→ 直接跳结账页
        │     │
        │     └─ 已占用桌台 → 直接跳订单详情
        │
        ├─ 点餐入口 → 直接跳点菜界面（无桌台模式，后续扫码点餐扩展）
        │
        ├─ 接单入口 → 扫码点餐待确认订单（pending）→ 接单/拒单（扫码点餐二期）
        │
        ├─ 订单入口 → 今日订单列表（状态tabs）→ 订单详情 → 重新结账/结账
        │
        └─ 打印入口 → 打印机管理 + 添加打印机（蓝牙/WiFi）+ 测试打印
```

### 3.3 订单状态机

```
PENDING（待接单）
    │  POST /orders/:id/confirm（接单）
    ▼
CONFIRMED（进行中，桌台 occupied）
    │  POST /orders/:id/items（加菜，可多次）
    │  POST /orders/:id/settle（结账）
    ▼
COMPLETED（已结账，桌台释放为 idle）
    │  POST /orders/:id/reopen（重新结账）
    ▼
CONFIRMED（回到进行中，桌台恢复占用）

PENDING → REJECTED（拒单，pending → void，POST /orders/:id/reject）
CONFIRMED → ON_ACCOUNT（挂账，settle 时 payment_method_id 特殊处理）
ON_ACCOUNT → COMPLETED（后续补结账，reopen→confirmed→settle）
```

---

## 4. 后端接口契约（收银 App 实际用到）

**统一前缀**：saas-service :3200（模拟器 `http://10.0.2.2:3200`）

| 模块 | 方法 | URL | 说明 |
|---|---|---|---|
| auth | POST | `/auth/login` | 手机号+密码登录 → {token, user}；user 含 shopName/shopAddress/shopCreatedAt |
| auth | POST | `/auth/register` | 激活码 12 位 + 店铺 + 手机号 + 密码 → 建店+建老板账号 |
| auth | GET | `/auth/me` | 当前用户（token → user 对象，角色判定用） |
| areas | GET | `/areas` | 全部区域（收银员可用）；原 `/admin/areas` 仅老板 |
| tables | GET | `/tables` | 桌台列表（带 status=idle/occupied） |
| dishes | GET | `/dishes` | 菜品列表（含 specs 规格、库存、sort_order；沽清库存为 0） |
| orders | GET | `/orders?status=X&page_size=100` | 按状态拉订单；page_size 上限 100；加 start_date/end_date 做日期范围 |
| orders | GET | `/orders/:id` | 订单详情（含 items 明细） |
| orders | POST | `/orders` | 创建订单（mode=table + table_id + guests + items[] + remark）；items 空 = 纯开台 |
| orders | POST | `/orders/:id/items` | 追加菜品到已有订单（加菜流程） |
| orders | POST | `/orders/:id/settle` | 结账：payment_method_id + paid_amount + discount_amount + voucher_id + remark |
| orders | POST | `/orders/:id/reopen` | 重新结账：completed/on_account → confirmed，恢复桌台占用 |
| orders | POST | `/orders/:id/confirm` | 接单：pending → confirmed |
| orders | POST | `/orders/:id/reject` | 拒单：pending → void |
| payments | GET | `/payments` | 可用支付方式列表 |
| reports | GET | `/reports/today` | 今日营业额（仅 revenue 一个数，收银 App 首页不展示报表） |
| printers | GET | `/printers` | 打印机配置列表（收银 App 管理页） |
| printers | POST | `/printers` | 添加打印机：{name, type=bluetooth\|wifi, address, port=0, width_mm=58\|80, enabled, is_default} |
| printers | PUT | `/printers/:id` | 更新打印机 |
| printers | DELETE | `/printers/:id` | 删除打印机 |

> 收银员角色可访问：areas、tables、dishes、orders（创建/加菜/结账不行？需看后端 RolesGuard 具体配置，老板/收银员/财务权限见 saas-service 对应 controller 的 @Roles 装饰器）。

---

## 5. 编译与运行

### 5.1 日常开发：本地编译运行到 MuMu（推荐）

```
HBuilderX 菜单：
  运行 → 运行到手机或模拟器 → 运行到 Android App 基座
  弹出对话框勾选：
    ☑ 使用自定义基座运行（C）       ← 必勾：否则运行标准基座，不含 saas-printer 插件
    ☑ 本地基座                     ← 必勾：用本地 Gradle/JDK/SDK 编译，不走云打包队列
    ☑ 清理构建缓存                 ← 首次/改插件后必勾
  设备选：MuMu (127.0.0.1:16384)
  → 确定
```

首次编译 3-10 分钟（Gradle wrapper 下载依赖 + UTS→Kotlin 转译 + 打包）。成功后自动安装 APK 到 MuMu 并启动。

**确认基座包含 saas-printer 插件**：

```powershell
# 方法 1：看 APK 大小
(Get-Item d:\c\saas\cashier-app\unpackage\debug\android_debug.apk).Length
# 自定义基座 = ~14.8MB；标准基座 = ~10MB 左右

# 方法 2：aapt dump 包信息（有 Android SDK 时）
D:\dev-tools\android-sdk\build-tools\34.0.0\aapt.exe dump badging d:\c\saas\cashier-app\unpackage\debug\android_debug.apk

# 方法 3：直接在 App 里打开打印管理 → 添加打印机 → 选蓝牙
#   → 如果能列出已配对设备 = 插件生效
#   → 如果提示"当前平台暂不支持打印" = 运行了标准基座，没勾自定义基座
```

### 5.2 制作独立 APK 文件（发给他人安装）

本地编译完就有 APK：`d:\c\saas\cashier-app\unpackage\debug\android_debug.apk`。直接 `adb install` 发给对方即可。

```powershell
# 安装到已连接的设备 / 模拟器
D:\dev-tools\platform-tools\adb.exe install -r d:\c\saas\cashier-app\unpackage\debug\android_debug.apk
```

### 5.3 正式发布：云打包（生产用）

HBuilderX → 发行 → 原生 App-云打包 → 填证书 → 提交 → DCloud 云端打包。需要 DCloud 额度；包名与 AppID 一致即可。生产发布时 BASE_URL 要改为真实公网地址（如 `http://140.143.201.204:3200`）。

### 5.4 常见编译错误修复

| 错误 | 原因 | 修复 |
|---|---|---|
| `UTS110111163: Object literals only support object types defined by construction type, and do not support interfaces` | UTS 不允许对象字面量赋给 interface | 所有类型定义用 `type`，不用 `interface`；见 §6.1 |
| `Found '{' where a key name was expected` | manifest.json 有 UTF-8 BOM 头 | 用 HBuilderX 重新保存 manifest.json，或 PowerShell 去 BOM：`[IO.File]::WriteAllText($path, [IO.File]::ReadAllText($path))` |
| `import / export cannot be used outside of module code` | 文件含 UTF-8 BOM（不是 manifest） | 同上，重写整个文件去除 BOM |
| `找不到名称 "OutputStream"` / Android 类名找不到 | 导入包路径错误 | 从 `java.io.OutputStream` 而不是 `java.net.OutputStream`；saas-printer 已修复 |
| 条件类型不匹配：`token ?` / `body &&` / `body.code` | UTS 强类型：String 不可做条件、可空对象不可直接判真假 | 改为 `token.length > 0 ?` / `body != null` / `body?.code`（或 `body != null && body.code`） |
| 运行时报"当前平台暂不支持打印" | 运行了标准基座，未包含 saas-printer 自定义插件 | 勾选「使用自定义基座运行」+「本地基座」再运行 |
| Gradle 编译报找不到 SDK/JDK/Gradle | settings.json 没生效或路径写错 | 检查 §1.2 三个路径是否正确，重启 HBuilderX 让配置生效 |
| APK 安装后白屏 / 闪退 | logcat 抓崩溃 | `adb logcat -s AndroidRuntime:E`；常见原因：权限未授予、BASE_URL 不通、saas-printer 在主线程做网络操作 |

---

## 6. UTS / uvue 编码硬约束

### 6.1 类型系统

| 写法 | 是否合法 | 说明 |
|---|---|---|
| `export type User = { id: number; name: string }` | ✅ | 必须全部用 `type` |
| `export interface User { id: number; name: string }` | ❌ | 对象字面量无法赋值给 interface |
| `const u: User = { id: 1, name: 'a' }` | ✅ | type 字面量赋值没问题 |
| `{ success: true, message: 'ok' } as SendResult` | ✅ | 函数返回值 / 变量 as 断言 |
| `let x: User | null = null; if (x) { }` | ❌ | 可空联合类型不可直接作布尔条件 |
| `if (x != null) { }` | ✅ | 显式判空 |
| `let s: string = ''; if (s) { }` | ❌ | String 不可作布尔条件 |
| `if (s.length > 0) { }` | ✅ | 显式判长度 |
| `body && body.code === 0` | ❌ | 可空对象短路求值的短路不可用 |
| `body != null && body.code === 0` | ✅ | 显式判空 |
| `body?.code === 0` | 视 uvue 版本而定 | 保守起见用显式判空 |

### 6.2 uvue 样式限制

- ❌ 不支持 CSS 选择器：元素选择器（`div { }`）、属性选择器、伪类（`:hover`）、伪元素（`::before`）
- ❌ 不支持 vh / deg 等 CSS 单位（可用 `px`、`rpx`、`%`）
- ❌ 不支持 `min-height: 100%`（用固定高度或 flex `flex:1` 替代）
- ✅ 支持类选择器 `.class-name`，id 选择器 `#id` 可用但不推荐
- ✅ 支持 flex 布局（`display: flex; flex-direction: column/row`）
- ✅ 支持 uni.scss 变量 `$uni-color-primary` 等

### 6.3 manifest.json / pages.json 规则

- manifest.json：**绝对禁止带 UTF-8 BOM**；Android 权限放在 `app-plus.distribute.android.permissions` 数组，每一项是完整的 `<uses-permission .../>` XML 字符串
- pages.json：页面路由注册后才可以 `navigateTo`；`navigationStyle: custom` 表示不使用系统导航栏，页面要自己实现头部（返回按钮、标题、右侧操作区），home / tables / order / cart / order-detail / settle / orders / print / print/add 都用了自定义导航栏

### 6.4 条件编译

UTS 插件里常用 `// #ifdef APP-ANDROID` / `// #endif` 包裹平台特有代码，`// #ifndef APP-ANDROID` 包裹其他平台兜底（返回 false / 空数组 / "不支持"）。跨平台入口（utssdk/index.uts）必须写双分支，否则 iOS / H5 编译失败。

### 6.5 UTS / uni-app x 运行时桥接坑

这些坑在 TypeScript 语法检查时不一定暴露，但 Android 运行时会失败，已在本轮页面回归中确认：

1. **字符串、数字和可空值比较禁用 `===`**：统一使用 `==` / `!=`。模板表达式、computed、页面方法和 `<template>` 条件都要检查，否则状态筛选、按钮显隐等会在运行时不生效。
2. **接口返回数组必须 `raw:true` 后显式解析**：不要把桥接返回的数组或对象直接 cast 成业务 `type[]`。`api/orders.uts` 的 `parseOrder()` / `parseOrderList()` 是标准写法：读取 `UTSJSONObject`，逐字段转成本地 `OrderItem` / `OrderItemSnapshot`。
3. **Storage 数组读回也禁止直接 cast**：读回值可能是 `UTSReactiveJSONObject` 数组，直接 cast 会 `ClassCastException`。购物车、备注等持久化数据必须逐项解析后再放入 `ref`；清空数组用 `splice(0, length)`。
4. **可选字段不要直接 `JSON.stringify` DTO**：UTS 可能把可选字段序列化成 `null`，后端遇到空字符串枚举或 SQLite `NOT NULL` 字段会返回 400 / 500。结账 DTO 参照 `settleOrder()`，手动构建 `UTSJSONObject`，只包含必填和确实非空的可选字段。
5. **数组响应式使用 `splice(0, length)` 后 `push`**：仅重新赋值或只 push 新元素可能不触发子组件 / 列表刷新；areas、tables 已按此处理。
6. **警惕 `spec_index` 为 0 的 falsy 陷阱**：规格下标 0 也是有效值。构建点餐项时始终传递 `spec_index`，不要写 `if (specIdx)` 或 `if (specIdx > 0)`，否则第一档规格会被丢弃。

---

## 7. 打印链路详解（saas-printer 插件）

### 7.1 架构

```
收银 App（uvue）调用：
  printReceipt(数据) → print-manager.getDefaultPrinter() → esc-pos.buildReceipt(数据, 纸宽)
                                                            ↓ Uint8Array 指令
                                                      saas-printer.sendBytes(
                                                          type='bluetooth'|'wifi',
                                                          address=MAC|IP,
                                                          port=0|9100,
                                                          bytes=指令
                                                      )
                                                            ↓ APP-ANDROID
  ┌─ 蓝牙: adapter.getRemoteDevice(MAC).createInsecureRfcommSocketToServiceRecord(SPP_UUID)
  │   → 子线程 connect + OutputStream.write + flush + close
  │   → 3000ms connectTimeout（主线程 setTimeout 让阻塞 connect 抛异常）
  │
  └─ WiFi TCP: new Socket().connect(InetSocketAddress(IP, port), 3000)
      → OutputStream.write + flush + close
```

### 7.2 ESC/POS 指令流

esc-pos.uts 负责构建指令。一条完整的结账单指令包含：

```
ESC @                初始化打印机
ESC a 1              居中对齐
GS ! 0x11            倍高倍宽 + 粗体
"川香居餐厅"          店名
GS ! 0x00            恢复正常字号
"\n\n"
ESC a 0              左对齐
"桌台:4号桌   人数:3人\n"
"单号:2026082814300001\n"
"时间:2026-08-28 14:30\n"
"--------------------------------\n"
菜品明细行（每行 菜名 数量 单价 金额）
"--------------------------------\n"
ESC E 1              粗体开
"合计: ¥57.00"
ESC E 0              粗体关
"\n\n\n"
GS V 66 0            切纸（部分切）
```

纸宽差异通过字符宽度压缩（80mm = 48 字符/行，58mm = 32 字符/行），菜品明细的对齐由 esc-pos.uts 内部 padRight / padLeft 计算。

### 7.3 模拟器 vs 真机限制

| 场景 | 模拟器（MuMu） | 真机（Android 手机） |
|---|---|---|
| 蓝牙扫描/连接 | ❌ 无真实蓝牙硬件，sendBluetooth 抛"设备不支持蓝牙" | ✅ 正常工作（需权限授予） |
| WiFi TCP 打印 | ⚠ 仅当真实打印机与宿主机同网段，且模拟器通过桥接 IP 可达 | ✅ 打印机与手机同 WiFi 即可 |
| 打印流程 UI | ✅ 完整可走（打印机管理、添加、测试、错误提示） | ✅ 完整可走 + 真实出票 |
| 权限请求 UI | ⚠ 模拟器可能无真实权限授予弹窗 | ✅ 系统标准权限授予弹窗 |

**结论**：打印功能的真实联调必须上真机 + 真实 ESC/POS 热敏打印机。模拟器仅用于开发 UI 流程、验证异常处理、确认指令生成逻辑。

---

## 8. 开发流程（新增功能 checklist）

1. **明确需求是否与 PRD 一致**：任何需求改动先对齐 `餐饮收银SaaS-PRD.md`
2. **后端优先**：收银 App 只复用接口契约，新功能通常涉及 saas-service 改动（实体、DAL、Controller、权限）
3. **类型优先**：新增 API 先在 `api/xxx.uts` 定义 `type`（不用 interface），`request<T>()` 泛型化
4. **页面开发**：
   - 新建 `pages/<xxx>/index.uvue`
   - 在 `pages.json` 注册路由（`navigationStyle: custom` 如需自定义导航栏）
   - 自定义导航栏：顶部 `position: absolute; top:0; left:0; right:0; height: 88rpx` 的标题栏，下面用 `paddingTop: 88rpx` 避开状态栏
   - 跳转用 `uni.navigateTo`（保留返回栈）或 `uni.reLaunch`（清空登录场景）
5. **Lint 检查**：
   ```
   HBuilderX → 工具 → 插件开发 → LSP 命令行（或用 CLI）
   cli lsp lint --project d:\c\saas\cashier-app --platform app-android --file d:\c\saas\cashier-app\pages\xxx\index.uvue
   ```
   期望：无诊断信息（0 error / 0 warning）
6. **本地编译运行**：§5.1 步骤跑到 MuMu 手动点击验证
7. **文档同步**：更新本指南对应章节 + 《开发人员接手指南.md》对应条目

---

## 9. 当前未完成项（2026-09-06 更新：P0 / P2 大部分已落地）

| 优先级 | 项 | 说明 | 影响面 |
|---|---|---|---|
| ✅ 已完成 | 蓝牙动态权限请求 | saas-printer 新增 `requestBluetoothPermissions` / `ensureBluetoothReady`：API 31+ 运行时申请 `BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN`（含定位），低版本申请定位；sendBluetooth 与扫描前自动调用，失败返回可展示的引导文案 | —— |
| 🟠 P1 | 权限请求通用工具封装 | 现有实现绑定蓝牙场景；如需 GPS / 相机等再抽象为通用 requestPermissions 工具（失败跳系统设置） | 后续原生能力入口 |
| 🟠 P1 | 接单模块完整联调 | 收银端详情页已支持手工 pending 单的接单/拒单（confirmOrder/rejectOrder）；扫码点餐二期的 pending 订单推送 + 联调仍待二期。二期公开接口（顾客扫码点餐）的预留设计落档于 `output/saas-service/docs/scan-ordering-api.md`（由 Codex 撰写中） | 扫码点餐落地后 |
| ✅ 已完成 | 打印小票样式模板化 | 新增 `api/receipt-style.uts` 读 `GET /admin/buckets/print-style`（老板/收银员可读）取「结账单」配置；buildReceipt 支持区块开关 / 字号（small/medium/large → ESC 放大倍数）/ 页眉页脚；5 分钟缓存，读取失败回退默认样式。注意：中文 GBK 编码仍为占位（writeText 打 `??`），真机出票前先解决编码 | —— |
| ✅ 已完成 | 退出登录清除打印机缓存 | logout 调 `invalidatePrinterCache()`（默认打印机 + 票据样式缓存一并清除） | —— |
| ✅ 已完成 | BASE_URL 环境切换 | `utils/config.uts` 环境清单（dev 模拟器 / lan 真机 / prod 云服务器）+ 首页头像弹出层「环境切换」，选择持久化、下一请求生效 | —— |
| ✅ 已完成 | 打印失败重试 / 队列 | print-manager 串行队列（避免蓝牙/TCP 并发写冲突）+ 失败重试 2 次（间隔 1s），仍失败把最后一次错误返回调用方 | —— |
| ✅ 已完成 | 设备监控上报 | `api/devices.uts`（稳定 device_id 持久化 + 系统信息采集）；App.uvue onShow 启动 60s 心跳定时器、onHide 停止；未登录自动跳过；后端 `POST /devices/heartbeat` + `GET /admin/devices`；商家后台设备监控页已见真实数据（冒烟 11 用例 + 浏览器端到端验证） | —— |
| ✅ 已完成 | 打印管理页：主动扫描蓝牙设备 | 插件新增 `startBluetoothScan`（startDiscovery + BroadcastReceiver，DISCOVERY_FINISHED / 15s 兜底结束）；add 页「已配对 + 附近扫描」合并展示、未配对设备连接时触发系统配对；不再依赖 uni.* 蓝牙 API | —— |
| ✅ 已完成 | 结账收银键盘 | settle 页数字键盘 + 快捷面额（¥10/20/50/100）+ 找零实时计算 + 抹零（抹至元）+ 整单折扣（9/8.8/8 折 → discount_type=discount），paid_amount 下发 | —— |
| ✅ 已完成 | 菜品备注 | 购物车行弹窗「加备注」→ `items[].remark` 随单下发 → 订单详情 / 小票展示；同菜不同备注在后端分行 | —— |
| ✅ 已完成 | 退菜 | 订单详情「退菜」弹层（按行选份数 + 原因必填）→ `POST /orders/:id/refund`（后端原有） | —— |
| ✅ 已完成 | 撤单 / 补打小票 | 订单详情：confirmed 加「撤单」（reject → void 释放桌台，后端本轮扩展允许 confirmed）；「打印小票 / 打印预结单」接通 printReceipt（原为占位 toast） | —— |
| ✅ 已完成 | UTS 插件编译验证 | 2026-09-06 已安装 HBuilderX 5.24（`D:\dev-tools\HBuilderX\HBuilderX`，绿色版含 cli.exe）。**saas-printer 插件 `cli compile app-android --uni_module saas-printer` 编译成功**（仅废弃 API 警告）；utils/config、request、esc-pos 与 api/devices、receipt-style、orders、printers 全部单文件编译成功。为过 5.24 编译器，插件做了适配：Promise then 回调不能返回 Promise（改 async/resolve 传参）、catch 参数不加 Error 类型标注、`OutputStream.write` 需 kotlin ByteArray（新增 `toKtBytes()`：`new ByteArray(len.toInt())` + 循环 `toByte()`）、平台 `number.toInt()/toByte()`、kotlin Set 用 iterator 遍历、`!exists` 判空改 `== null` | 编译期 ✅ |
| ✅ 已完成 | .uvue 页面运行验证 | 2026-09-06 MuMu 桥接（`192.168.1.20:5555`）+ HBuilderX 5.24 自定义基座完成核心闭环回归：登录、首页、设备心跳、桌台开台、点餐、规格、购物车、下单、结账、订单列表、订单详情；订单 10 App 内结账 `33.50`，后端确认 `completed / cash`，桌台恢复未开台。UTS 桥接修复见 §6.5 | Android 真机 / 模拟器 |
| 🟡 P2 | 混合支付（多种收款方式组合） | 美团为多支付行叠加、各自可撤销、统一确认；我们 settle 是单支付方式。需后端订单支付行模型改造（order_payments），候选二期 | 收银灵活性 |
| 🟡 P2 | 数量直输面板 / 折扣原因自定义 | 参照美团：点菜页选中菜品弹数量面板直接输份数；整单折扣允许自定义原因入账单明细 | 操作效率 |
| 🟢 P3 | 多语言/主题切换 | 当前 uni.scss 单主色；是否支持夜间模式（跟进 merchant-web theme.ts） | UI 一致性 |
| 🟢 P3 | 离线收银（断网缓存 + 恢复网络批量提交） | 当前纯在线模式，餐厅网络差可能导致下单失败；可引入本地 SQLite 缓存订单 | 网络稳定性场景 |

---

## 10. 排障速查

### 10.1 App 启动后请求全部失败

1. 确认 saas-service 已启动：`curl http://127.0.0.1:3200/auth/me` → 401（正常）
2. MuMu：`adb shell nc -w 2 -z 10.0.2.2 3200` → OK（网络通）
3. 真机：手机浏览器访问宿主机 IP + 3200 → 看是否返回
4. 否则：config.uts 的 BASE_URL 写错了，或 saas-service 绑定 127.0.0.1 不是 0.0.0.0

### 10.2 登录后跳登录页（循环 401）

token 未写入：看 request.uts 第 32-33 行 `setToken()`；或 saas-service 签发的 token 格式不对。抓 request 响应：

```powershell
adb logcat | findstr /i "saas cash"
# 或 HBuilderX 控制台开 debug
```

### 10.3 打印测试打印不出票（真机 + 蓝牙打印机）

1. 手机蓝牙是否配对到打印机
2. 打印机是否处于可打印状态
3. 在打印管理 → 添加打印机，选「已配对设备」列表里的那个
4. 测试打印：logcat 过滤 `saas-printer / sendBytes / BluetoothSocket`
5. 常见错误：
   - 未授权 `BLUETOOTH_CONNECT` → 手机设置 → App → 权限 → 附近设备授权
   - 打印机 UUID 不是标准 SPP → 找打印机厂商手册确认 SPP UUID，替换 saas-printer 的 SPP_UUID 常量
   - 发送成功但乱码 → ESC/POS 指令集不兼容（CPCL 指令打印机不可用，必须是 ESC/POS 兼容热敏机）

### 10.4 修改代码后 App 没更新

1. 取消勾选「自定义基座」再勾一次，强制重编
2. 删掉整个 `unpackage/` 目录（清构建缓存）
3. adb uninstall com.saas.cashier（彻底卸载再重装）
