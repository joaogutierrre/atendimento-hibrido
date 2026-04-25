#!/usr/bin/env bash
# Re-registra o webhook do Telegram apontando para a URL atual do túnel
# (service `tunnel` do docker-compose). Quick tunnels têm URL nova a cada
# start, então este script é a maneira oficial de sincronizar Telegram
# após `docker compose --profile tunnel up -d tunnel`.
#
# Uso:
#   bash infra/setup-telegram-webhook.sh                     # canal único ativo
#   CHANNEL_ID=cmob... bash infra/setup-telegram-webhook.sh  # canal específico
#
# Variáveis (todas opcionais):
#   PROJECT      — project name do compose (default: platform)
#   CHANNEL_ID   — ID do MessagingChannel TELEGRAM (default: único ativo)
#   TIMEOUT_SECS — quanto esperar pela URL aparecer nos logs (default: 60)

set -euo pipefail

PROJECT="${PROJECT:-platform}"
TIMEOUT_SECS="${TIMEOUT_SECS:-60}"
TUNNEL_CTN="${PROJECT}-tunnel-1"
GATEWAY_CTN="${PROJECT}-gateway-1"
POSTGRES_CTN="${PROJECT}-postgres-1"

err() { echo "ERRO: $*" >&2; exit 1; }
log() { echo "[setup-telegram-webhook] $*"; }

# 1. Conferir que tudo está rodando.
docker inspect "$TUNNEL_CTN" >/dev/null 2>&1 \
  || err "Container $TUNNEL_CTN não existe. Rode antes: docker compose --profile tunnel up -d tunnel"
docker inspect "$GATEWAY_CTN" >/dev/null 2>&1 \
  || err "Container $GATEWAY_CTN não existe. Rode antes: docker compose up -d gateway"
docker inspect "$POSTGRES_CTN" >/dev/null 2>&1 \
  || err "Container $POSTGRES_CTN não existe."

# 2. Esperar a URL do quick tunnel aparecer nos logs.
log "Aguardando URL do túnel em $TUNNEL_CTN (até ${TIMEOUT_SECS}s)..."
URL=""
for ((i=0; i<TIMEOUT_SECS; i++)); do
  URL=$(docker logs "$TUNNEL_CTN" 2>&1 \
        | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)
  [[ -n "$URL" ]] && break
  sleep 1
done
[[ -z "$URL" ]] && err "URL não encontrada nos logs do $TUNNEL_CTN. Está rodando? Tem internet?"
log "Túnel: $URL"

# 3. Pegar o secret esperado pelo gateway.
SECRET=$(docker exec "$GATEWAY_CTN" sh -c 'printf "%s" "$TELEGRAM_WEBHOOK_SECRET"' 2>/dev/null || true)
[[ -z "$SECRET" ]] && err "TELEGRAM_WEBHOOK_SECRET não está definido no gateway."

# 4. Descobrir o canal Telegram a usar.
if [[ -z "${CHANNEL_ID:-}" ]]; then
  ROW=$(docker exec "$POSTGRES_CTN" psql -U user -d platform -tAF '|' -c \
    "SELECT id, identifier FROM \"MessagingChannel\" WHERE type='TELEGRAM' AND \"isActive\"=true;")
  ROW_COUNT=$(printf "%s" "$ROW" | grep -c . || true)
  [[ "$ROW_COUNT" -eq 0 ]] && err "Nenhum canal TELEGRAM ativo. Cadastre via /tenant/channels primeiro."
  [[ "$ROW_COUNT" -gt 1 ]] && err "Mais de um canal TELEGRAM ativo. Defina CHANNEL_ID=... explicitamente."
  CHANNEL_ID="${ROW%%|*}"
  BOT_TOKEN="${ROW##*|}"
else
  BOT_TOKEN=$(docker exec "$POSTGRES_CTN" psql -U user -d platform -tAc \
    "SELECT identifier FROM \"MessagingChannel\" WHERE id='$CHANNEL_ID' AND type='TELEGRAM' AND \"isActive\"=true;")
  [[ -z "$BOT_TOKEN" ]] && err "Canal $CHANNEL_ID não existe / inativo / não é TELEGRAM."
fi
log "Canal: $CHANNEL_ID"

# 5. Registrar o webhook.
WEBHOOK="${URL}/telegram/webhook/${CHANNEL_ID}"
log "Registrando webhook: $WEBHOOK"
RESP=$(curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"${WEBHOOK}\",\"secret_token\":\"${SECRET}\"}")
echo "$RESP" | grep -q '"ok":true' \
  || err "Telegram rejeitou o setWebhook: $RESP"
log "OK. getWebhookInfo:"
curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" \
  | python -c 'import sys, json
d = json.load(sys.stdin)["result"]
print("  url:", d.get("url"))
print("  pending:", d.get("pending_update_count", 0))
print("  last_error:", d.get("last_error_message", "(none)"))'
