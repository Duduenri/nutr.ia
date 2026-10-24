#!/bin/sh
set -e
cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M)
mkdir -p backups
docker compose exec -T db pg_dump -U nutri nutri | gzip > "backups/db-$STAMP.sql.gz"
docker compose run --rm --no-deps -v "$PWD/backups:/backups" --entrypoint sh api \
  -c "tar czf /backups/uploads-$STAMP.tgz -C /data uploads"
find backups -type f -mtime +30 -delete
echo "Backup salvo em backups/*-$STAMP.*"
