#!/usr/bin/env bash
# ============================================================
# 01-apt-tencent.sh
# 用途：apt 源切换为腾讯云内网镜像 + 安装基础软件
# 环境：腾讯云服务器（北京等地域），Ubuntu 22.04 / 24.04
# 说明：mirrors.tencentyun.com 为腾讯云内网地址，不占公网带宽
# ============================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "请用 root 运行：sudo bash 01-apt-tencent.sh"
  exit 1
fi

# 读取系统版本
VERSION_ID=$(. /etc/os-release && echo "$VERSION_ID")
echo "==> 检测到 Ubuntu ${VERSION_ID}"

# ---------- 1. 备份原源 ----------
backup_sources() {
  local f="$1"
  [[ -f "$f" && ! -f "$f.bak-saas" ]] && cp "$f" "$f.bak-saas" && echo "已备份 $f"
}

# ---------- 2. 写入腾讯云内网源 ----------
if [[ "$VERSION_ID" == "24.04" ]]; then
  # Ubuntu 24.04 使用 deb822 格式
  CONF=/etc/apt/sources.list.d/ubuntu.sources
  backup_sources "$CONF"
  cat > "$CONF" <<'EOF'
Types: deb
URIs: http://mirrors.tencentyun.com/ubuntu/
Suites: noble noble-updates noble-backports noble-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF
  echo "==> 已写入 deb822 格式内网源 ($CONF)"

elif [[ "$VERSION_ID" == "22.04" ]]; then
  CONF=/etc/apt/sources.list
  backup_sources "$CONF"
  cat > "$CONF" <<'EOF'
deb http://mirrors.tencentyun.com/ubuntu/ jammy main restricted universe multiverse
deb http://mirrors.tencentyun.com/ubuntu/ jammy-updates main restricted universe multiverse
deb http://mirrors.tencentyun.com/ubuntu/ jammy-backports main restricted universe multiverse
deb http://mirrors.tencentyun.com/ubuntu/ jammy-security main restricted universe multiverse
EOF
  echo "==> 已写入内网源 ($CONF)"

else
  echo "不支持的系统版本：${VERSION_ID}（本方案支持 22.04 / 24.04）"
  exit 1
fi

# ---------- 3. 更新 + 安装基础软件 ----------
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential python3 \
  curl wget git unzip \
  nginx \
  sqlite3 \
  ca-certificates \
  ufw

# ---------- 4. 防火墙（默认放行 SSH + HTTP/HTTPS） ----------
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
# 如需直连调试后端可临时放开（调试完建议关闭）：
# ufw allow 3100/tcp; ufw allow 3200/tcp
echo "==> 防火墙规则已设置（未启用，可手动执行 ufw enable 开启）"

echo "==> 01 完成：apt 源已切换为腾讯云内网镜像，基础软件已安装"
