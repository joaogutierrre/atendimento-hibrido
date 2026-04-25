#!/bin/sh
set -e
echo "[entrypoint] Running prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy
echo "[entrypoint] Starting service-gateway..."
exec node dist/main.js
