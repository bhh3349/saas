#!/usr/bin/env bash
# ============================================================
# 04-nginx.sh
# 用途：Nginx 配置
#   1) 反代 platform-service(3100) 到 平台后台域名/路径
#   2) 反代 saas-service(3200)（商家后台/收银 App 接口）
#   3) 托管前端静态文件（将来）
# 用法：DOMAIN=admin.example.com bash 04-nginx.sh
#       DOMAIN 省略时用服务器 IP（不支持 HTTPS，仅测试用）
# ============================================================
set -euo pipefail

DOMAIN="${DOMAIN:-_}"
P_SRC=/opt/saas/output/platform-service

# 前端静态目录（当前不存在，创建占位；前端做好后把 dist 传上来即可）
mkdir -p /opt/saas/www/platform-admin-web

if [[ "$DOMAIN" == "_" ]]; then
  SERVER_NAME="_"
  echo "==> 未指定 DOMAIN，使用 IP 直访（仅 HTTP 测试）"
else
  SERVER_NAME="$DOMAIN"
  echo "==> 使用域名 $DOMAIN（HTTPS 需另行配置证书）"
fi

cat > /etc/nginx/sites-available/saas <<EOF
# 平台后台（项目一）——静态文件 + 反代后端
server {
    listen 80;
    server_name $SERVER_NAME;

    # 前端静态文件（平台后台 Web，将来）
    location / {
        root /opt/saas/www/platform-admin-web;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # 平台端 API（激活码 / 店铺）
    location /auth/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    location /admin/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    location /internal/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}

# 商家端 API（项目二：商家后台 Web + 收银 App）——预留
# 上线商家端时，取消下面注释并配置对应域名/路径
# server {
#     listen 80;
#     server_name saas.example.com;
#     location / {
#         root /opt/saas/www/saas-admin-web;
#         index index.html;
#         try_files \$uri \$uri/ /index.html;
#     }
#     location /api/ {
#         proxy_pass http://127.0.0.1:3200;
#         proxy_set_header Host \$host;
#         proxy_set_header X-Real-IP \$remote_addr;
#         proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
#     }
# }
EOF

ln -sf /etc/nginx/sites-available/saas /etc/nginx/sites-enabled/saas
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> 04 完成：Nginx 已配置并 reload"
echo "    平台后台：http://\${DOMAIN:-<服务器IP>}/  （静态文件尚未构建，可先直接访问 /admin/ 验证 API）"
