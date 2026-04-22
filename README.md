# Plataforma de Atendimento Multi-Canal Híbrido

SaaS multi-tenant de atendimento via Telegram (MVP) e WhatsApp (V2) com agente de IA + escalonamento humano.

- **service-gateway** — NestJS + Prisma + PostgreSQL + Redis + Socket.io
- **service-agent** — Python + FastAPI + LangChain/LangGraph + Anthropic Claude + pgvector

Especificação completa em [ARCHITECTURE_BACKEND.md](ARCHITECTURE_BACKEND.md).
Diretivas operacionais (gitflow, PRs, ordem de implementação) em [CLAUDE.md](CLAUDE.md).

## Quickstart

```bash
# Infra (DB + Redis)
docker compose up -d postgres redis

# Gateway (após SPEC-02)
docker compose up -d gateway

# Agent (após SPEC-09)
docker compose up -d agent
```

## Workflow

Este repositório segue **Gitflow**. Ver [CLAUDE.md](CLAUDE.md#workflow--gitflow) para o fluxo completo de branches, commits e PRs.

## Status

Em implementação incremental. Cada SPEC (01–15) é entregue em uma feature branch com PR dedicado para `develop`.
