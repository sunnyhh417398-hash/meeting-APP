#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: bash deploy/restore.sh deploy/backups/<file.sql.gz>"
  exit 1
fi

FILE="$1"
if [ ! -f "$FILE" ]; then
  echo "File not found: $FILE"
  exit 1
fi

echo "[!] This will overwrite current DB data."
echo "[+] Restoring from $FILE"

gunzip -c "$FILE" | docker compose exec -T postgres psql -U meeting -d meeting
echo "[+] Done"
