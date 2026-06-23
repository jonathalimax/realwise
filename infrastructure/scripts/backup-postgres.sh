#!/usr/bin/env bash
set -euo pipefail

# Required environment variables:
# DATABASE_URL     — postgres connection string
# BACKUP_DIR       — local directory to write backup files
# RCLONE_REMOTE    — rclone remote name (e.g. "hetzner-box:backups/postgres")
#                    leave empty to skip rclone upload

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/realwise_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] dumping database to ${BACKUP_FILE}"
pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_FILE}"
echo "[backup] dump complete: $(du -sh "${BACKUP_FILE}" | cut -f1)"

# Prune local backups older than 7 days
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +7 -delete
echo "[backup] pruned local backups older than 7 days"

# Upload to remote if configured
if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  echo "[backup] syncing to ${RCLONE_REMOTE}"
  rclone copy "${BACKUP_FILE}" "${RCLONE_REMOTE}"
  echo "[backup] sync complete"
fi

echo "[backup] done"
