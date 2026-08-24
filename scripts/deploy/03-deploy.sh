#!/usr/bin/env bash
# ============================================================
# 03-deploy.sh
# 用途：安装依赖 + 构建两个服务 + 生成 .env + pm2 启动
# 前提：代码已上传到 /opt/saas/output/{platform-service,saas-service}
#       （不含 node_modules / dist / data）
# ============================================================
set -euo pipefail

BASE=/opt/saas
P_SRC=$BASE/output/platform-service
S_SRC=$BASE/output/saas-service
mkdir -p "$BASE"/{backups,logs}

# 共享内网签名密钥：两端必须一致（三处）
SHARED_SECRET=$(openssl rand -hex 32)
# 平台运营初始密码（随机）
OP_PASSWORD=$(openssl rand -hex 8)

# ---------- 1. 平台端服务 ----------
if [[ ! -d "$P_SRC" ]]; then
  echo "错误：找不到 $P_SRC，请先上传代码"; exit 1
fi
cd "$P_SRC"
echo "==> 安装 platform-service 依赖（npmmirror）..."
npm install --no-audit --no-fund
echo "==> 构建 platform-service..."
npm run build
mkdir -p data

if [[ ! -f .env ]]; then
cat > .env <<EOF
PORT=3100
DB_PATH=data/platform.db
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=8h
INTERNAL_SHARED_SECRET=${SHARED_SECRET}
SAAS_INTERNAL_BASE_URL=http://127.0.0.1:3200
SAAS_INTERNAL_SECRET=${SHARED_SECRET}
SEED_OPERATOR_USERNAME=admin
SEED_OPERATOR_PASSWORD=${OP_PASSWORD}
EOF
echo "==> 已生成 platform-service/.env（运营初始密码：${OP_PASSWORD}，请立即保存）"
fi

# ---------- 2. 商家端服务 ----------
if [[ ! -d "$S_SRC" ]]; then
  echo "错误：找不到 $S_SRC，请先上传代码"; exit 1
fi
cd "$S_SRC"
echo "==> 安装 saas-service 依赖（npmmirror）..."
npm install --no-audit --no-fund
echo "==> 构建 saas-service..."
npm run build
mkdir -p data

if [[ ! -f .env ]]; then
cat > .env <<EOF
PORT=3200
DB_PATH=data/saas.db
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=8h
PLATFORM_INTERNAL_BASE_URL=http://127.0.0.1:3100
PLATFORM_INTERNAL_SECRET=${SHARED_SECRET}
DEFAULT_TABLE_COUNT=10
EOF
echo "==> 已生成 saas-service/.env"
fi

# ---------- 3. pm2 启动 / 重启 ----------
cd "$P_SRC"
pm2 delete platform-service >/dev/null 2>&1 || true
pm2 start npm --name platform-service -- start
cd "$S_SRC"
pm2 delete saas-service >/dev/null 2>&1 || true
pm2 start npm --name saas-service -- start

pm2 save
# 开机自启（输出提示复制执行即可；pm2 startup 需要 root）
pm2 startup systemd -u "$(whoami)" --hp "$HOME" >/dev/null 2>&1 || true

echo "==> 03 完成：两个服务已由 pm2 托管"
pm2 status
