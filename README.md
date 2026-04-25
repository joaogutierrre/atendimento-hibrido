# Plataforma de Atendimento Multi-Canal Híbrido

SaaS multi-tenant de atendimento via Telegram (MVP) e WhatsApp (V2) com agente de IA + escalonamento humano.

- **service-gateway** — NestJS + Prisma + PostgreSQL + Redis + Socket.io
- **service-agent** — Python + FastAPI + LangChain/LangGraph + pgvector (Ollama local)
- **service-frontend** — slot estático servido por nginx (build do Lovable/qualquer SPA)

Especificação completa em [ARCHITECTURE_BACKEND.md](ARCHITECTURE_BACKEND.md).
PRD do painel de atendimento em [FRONTEND_PRD.md](FRONTEND_PRD.md).
Diretivas operacionais (gitflow, PRs, ordem de implementação) em [CLAUDE.md](CLAUDE.md).

## Quickstart

```bash
# Infra (DB + Redis)
docker compose up -d postgres redis

# Gateway
docker compose up -d gateway

# Agent (requer Ollama rodando no host com modelo gemma:4b)
docker compose --profile app up -d agent
```

## Subir o Frontend

1. Gere o build do seu frontend (Lovable, Vite, etc.) e coloque os arquivos em `service-frontend/dist/`
2. Suba o container:

```bash
docker compose --profile app up -d frontend
```

O painel estará disponível em `http://localhost:8080`.

As chamadas para `/api/*` são proxiadas para o gateway e `/socket.io/*` para o WebSocket — nenhuma configuração adicional necessária.

## Workflow

Este repositório segue **Gitflow**. Ver [CLAUDE.md](CLAUDE.md#workflow--gitflow) para o fluxo completo de branches, commits e PRs.

## Status

Em implementação incremental. Cada SPEC (01–15) é entregue em uma feature branch com PR dedicado para `develop`.
