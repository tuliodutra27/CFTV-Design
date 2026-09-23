#!/bin/sh
# Restaura um backup do Postgres do CFTV-Design a partir de um arquivo .sql (gerado por
# backup-db.sh). ATENÇÃO: sobrescreve os dados atuais do banco.
# Uso: ./scripts/restore-db.sh backups/cftv-design-20260923-143000.sql
set -e

cd "$(dirname "$0")/.."

FILE="$1"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Uso: ./scripts/restore-db.sh <arquivo.sql>"
  echo "Arquivos disponiveis em backups/:"
  ls -1 backups 2>/dev/null || echo "  (nenhum)"
  exit 1
fi

POSTGRES_USER="${POSTGRES_USER:-cftv}"
POSTGRES_DB="${POSTGRES_DB:-cftv_design}"

echo "Isso vai SOBRESCREVER o banco atual ($POSTGRES_DB) com o conteudo de $FILE."
printf "Confirma? (digite 'sim' para continuar): "
read -r CONFIRM
if [ "$CONFIRM" != "sim" ]; then
  echo "Cancelado."
  exit 1
fi

docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB" < "$FILE"
echo "Restaurado a partir de $FILE"
