#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/restore.sh /path/to/backup.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="${CONTAINER_NAME:-hexaattender_db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-hexaattender}"

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
else
  docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
fi

echo "Restore completed for $DB_NAME"
