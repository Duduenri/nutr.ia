#!/bin/sh
set -e
HOST=${1:?uso: scripts/deploy.sh usuario@host}
SSH="ssh -i $HOME/.ssh/nutri_vps -o StrictHostKeyChecking=accept-new"
cd "$(dirname "$0")/.."
rsync -az --delete -e "$SSH" \
  --exclude node_modules --exclude dist --exclude .env --exclude uploads \
  --exclude backups --exclude '*.log' \
  ./ "$HOST:/opt/nutri/"
$SSH "$HOST" 'cd /opt/nutri && docker compose --profile https up -d --build && docker compose --profile https ps'
