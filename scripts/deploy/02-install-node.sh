#!/usr/bin/env bash
# ============================================================
# 02-install-node.sh
# 用途：安装 Node.js 22（npmmirror 国内镜像，不访问 nodejs.org）
#       并全局配置 npm 国内镜像
# 用法：NODE_VERSION=v22.14.0 bash 02-install-node.sh
# ============================================================
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-v22.14.0}"
ARCH=$(uname -m)
case "$ARCH" in
  x86_64) ARCH_DIR="linux-x64" ;;
  aarch64) ARCH_DIR="linux-arm64" ;;
  *) echo "不支持的架构：$ARCH"; exit 1 ;;
esac

# ---------- 1. 下载 Node（npmmirror 镜像） ----------
if command -v node >/dev/null 2>&1 && node -v | grep -q "v22"; then
  echo "==> Node 已存在：$(node -v)，跳过下载"
else
  FILE="node-${NODE_VERSION}-${ARCH_DIR}.tar.xz"
  URL="https://npmmirror.com/mirrors/node/${NODE_VERSION}/${FILE}"
  echo "==> 从 npmmirror 下载 ${FILE} ..."
  curl -fSL -o "/tmp/${FILE}" "$URL"
  tar -xJf "/tmp/${FILE}" -C /usr/local --strip-components=1
  rm -f "/tmp/${FILE}"
  echo "==> Node 安装完成：$(node -v) / $(npm -v)"
fi

# ---------- 2. 配置 npm 国内镜像 ----------
# 注意：npm 10.x 不允许 `npm config set` 写未知键（会报 not a valid npm option），
#       better-sqlite3 镜像必须直接写入 .npmrc
cat > "$HOME/.npmrc" <<'EOF'
registry=https://registry.npmmirror.com
better_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/better-sqlite3/
EOF
echo "==> npm registry 已指向 npmmirror"

# ---------- 3. 安装 pm2 ----------
npm i -g pm2
echo "==> pm2 已安装：$(pm2 -v)"

echo "==> 02 完成：Node ${NODE_VERSION} + 国内镜像 + pm2 就绪"
