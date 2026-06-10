#!/bin/bash
# =====================================================================
# HexaAttender - Automated PostgreSQL Database Backup Script
# =====================================================================
# Set this script to run daily via cron:
# 0 2 * * * /var/www/hexaattender-ams/scripts/backup.sh >> /var/log/hexaattender_backup.log 2>&1

set -e

# Configuration
BACKUP_DIR="/var/backups/hexaattender"
CONTAINER_NAME="hexaattender_db"
DB_USER="postgres"
DB_NAME="hexaattender"
RETENTION_DAYS=30

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/hexaattender_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

echo "[$(date)] Starting database backup..."

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# 1. Execute pg_dump inside postgres container and stream directly to local file
if ! docker exec -i "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -F c > "${BACKUP_FILE}" 2>/dev/null; then
    # Fallback to standard backup format if custom format isn't required
    docker exec -i "${CONTAINER_NAME}" pg_dumpall -U "${DB_USER}" > "${BACKUP_FILE}"
fi

# 2. Compress the backup to save disk space
gzip -f "${BACKUP_FILE}"

echo "[$(date)] Backup completed successfully: ${COMPRESSED_FILE}"
echo "[$(date)] Compressed File Size: $(du -sh "${COMPRESSED_FILE}" | cut -f1)"

# 3. Clean up backups older than $RETENTION_DAYS days
echo "[$(date)] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "hexaattender_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Database maintenance cycle completed."
