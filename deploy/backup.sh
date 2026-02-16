#!/usr/bin/env bash
set -euo pipefail

TS=$(date +"%Y%m%d_%H%M%S")
OUT="deploy/backups/meeting_${TS}.sql.gz"
mkdir -p deploy/backups

echo "[+] Backing up postgres to $OUT"
docker compose exec -T postgres pg_dump -U meeting -d meeting | gzip > "$OUT"
echo "[+] Done"
