#!/bin/sh
# Backup do Postgres do CFTV-Design via pg_dump, rodando dentro do container `db`.
# Uso: ./scripts/backup-db.sh   (rodar da raiz do projeto, onde fica o docker-compose.yml)
set -e

cd "$(dirname "$0")/.."

POSTGRES_USER="${POSTGRES_USER:-cftv}"
POSTGRES_DB="${POSTGRES_DB:-cftv_design}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="backups"
OUT_FILE="$OUT_DIR/cftv-design-$TIMESTAMP.sql"

mkdir -p "$OUT_DIR"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$OUT_FILE"

echo "Backup salvo em: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"
