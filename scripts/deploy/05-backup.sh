#!/usr/bin/env bash
# ============================================================
# 05-backup.sh
# 用途：每日备份两个 SQLite 数据库（sqlite3 .backup 一致性备份）
#       压缩保存到 /opt/saas/backups，保留 30 天
# 可手动执行：bash 05-backup.sh
# 定时任务：本脚本末尾自动写入 crontab（每天 02:00）
# ============================================================
set -euo pipefail

BACKUP_DIR=/opt/saas/backups
RETENTION_DAYS=30
LOG_DIR=/opt/saas/logs
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

STAMP=$(date +%Y%m%d_%H%M%S)

# 格式: 库名|路径
DATABASES=(
  "platform|/opt/saas/output/platform-service/data/platform.db"
  "saas|/opt/saas/output/saas-service/data/saas.db"
)

for entry in "${DATABASES[@]}"; do
  NAME="${entry%%|*}"
  SRC="${entry##*|}"
  if [[ ! -f "$SRC" ]]; then
    echo "[$STAMP] 跳过 $NAME：数据库文件不存在 $SRC"
    continue
  fi
  DEST="$BACKUP_DIR/${NAME}_${STAMP}.db"
  sqlite3 "$SRC" ".backup '$DEST'"
  gzip -f "$DEST"
  echo "[$STAMP] 已备份 $NAME -> ${DEST}.gz"
done

# 清理超过保留期的旧备份
find "$BACKUP_DIR" -name '*.gz' -mtime +"$RETENTION_DAYS" -delete

# ---------- 写入 crontab（每天 02:00） ----------
CRON_LINE="0 2 * * * bash /opt/saas/scripts/05-backup.sh >> $LOG_DIR/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v "05-backup.sh" || true; echo "$CRON_LINE") | crontab -
echo "==> 已写入 crontab：$CRON_LINE"

echo "==> 05 完成：备份与定时任务就绪（保留 ${RETENTION_DAYS} 天）"
