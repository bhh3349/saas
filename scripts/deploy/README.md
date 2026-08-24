# 部署到腾讯云服务器（Ubuntu）

## 前提

- 云服务器：腾讯云，Ubuntu 24.04 / 22.04，建议 2C2G+（本方案在 4H4G 下绰绰有余）
- 已开通安全组：放行 `80` / `443`（如需直连调试可临时放行 `3100` / `3200`）
- 本机（Windows）能通过 SSH 连上服务器

> 本方案**不安装面板**（宝塔 / 1Panel）。原因：本项目无 MySQL / Redis，面板核心能力用不上；
> 且腾讯云北京访问外网慢，面板安装脚本要拉外网资源，反而不如纯国内源直接。
> 全部软件源已适配腾讯云（内网镜像 + npmmirror），**不依赖国际网络**。

## 目录结构（服务器上）

```
/opt/saas/
├── scripts/              ← 本目录上传过去
├── output/
│   ├── platform-service/ ← 平台端服务源码（不含 node_modules / dist / data）
│   └── saas-service/     ← 商家端服务源码（不含 node_modules / dist / data）
├── backups/              ← 每日备份（脚本自动创建）
└── logs/                 ← 运行日志（脚本自动创建）
```

## 执行步骤

### 1. 上传代码到服务器

方式 A：scp（PowerShell，在仓库根目录执行）

```powershell
# 先创建目录
ssh user@YOUR_IP "sudo mkdir -p /opt/saas && sudo chown -R $USER:$USER /opt/saas"

# 上传部署脚本
scp -r d:\c\saas\scripts\deploy user@YOUR_IP:/opt/saas/scripts

# 上传两个服务源码（排除 node_modules / dist / data）
scp -r d:\c\saas\output\platform-service user@YOUR_IP:/opt/saas/output/
scp -r d:\c\saas\output\saas-service user@YOUR_IP:/opt/saas/output/
```

方式 B：git（如果代码在远程仓库）

```bash
cd /opt/saas
git clone <你的仓库> .
```

### 2. 在服务器上依次执行

```bash
cd /opt/saas/scripts

# ① apt 换腾讯云内网源 + 装基础软件（含 nginx、sqlite3、编译工具）
bash 01-apt-tencent.sh

# ② 安装 Node.js 22（从 npmmirror 国内镜像下载，不用官网）
bash 02-install-node.sh
node -v   # 应输出 v22.x

# ③ 安装依赖 + 构建 + 生成 .env + pm2 启动两个服务
bash 03-deploy.sh

# ④ 配置 Nginx（反代 3100/3200 + 托管前端静态文件）
bash 04-nginx.sh

# ⑤ 配置每日备份（crontab，凌晨 2 点，保留 30 天）
bash 05-backup.sh
```

### 3. 验证

```bash
pm2 status                       # 两个进程 online
curl -s http://127.0.0.1:3100/auth/login -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"<你设置的密码>"}'
curl -s http://127.0.0.1:3200/auth/login -X POST -H "Content-Type: application/json" -d '{"username":"...","password":"..."}'
```

- 平台后台访问：`http://你的域名/`（默认账号 `admin`，密码见 `/opt/saas/output/platform-service/.env` 中 `SEED_OPERATOR_PASSWORD`，首次登录后可自行改，或改 `.env` 后 `pm2 restart platform-service`）
- 两个服务开机自启：`pm2 startup` 已在 03 脚本执行，重启服务器后自动拉起

## 生产环境必改项

| 项 | 位置 | 说明 |
|---|---|---|
| JWT 密钥 | 两个 `.env` 的 `JWT_SECRET` | 03 脚本已自动生成随机值，勿改回默认 |
| 内部签名密钥 | 三个 `*_SECRET` 字段 | 03 脚本已生成**同一个随机值**写入三处，两端一致才能互通 |
| 运营初始密码 | `platform-service/.env` 的 `SEED_OPERATOR_PASSWORD` | 03 脚本生成随机值，部署后立即用该密码登录 |
| HTTPS | Nginx | 建议申请免费 SSL（腾讯云 SSL 证书 + certbot） |

## 脚本与腾讯云网络适配对照

| 外网瓶颈 | 适配方案 | 对应脚本 |
|---|---|---|
| apt 国际源慢 | 换腾讯云**内网**镜像 `mirrors.tencentyun.com`（不占公网带宽） | 01 |
| nodejs.org 下载慢 | Node 从 npmmirror 国内镜像下载 | 02 |
| npm registry 慢 | 全局 registry 指向 `registry.npmmirror.com` | 02 |
| better-sqlite3 预编译二进制在 GitHub | 指向 npmmirror 的 binary mirror；装 build-essential 兜底本地编译 | 02 / 03 |
| 无数据库管理需求 | 不装面板，纯 systemd / pm2 | 全部 |
