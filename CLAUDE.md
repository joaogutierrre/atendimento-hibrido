# CLAUDE.md — Plataforma de Atendimento Multi-Canal Híbrido

Documento de diretivas operacionais para o Claude Code neste repositório.
A especificação técnica completa está em `ARCHITECTURE_BACKEND.md`.

---

## Workflow — Gitflow

Este repositório segue **Gitflow**. As branches permanentes são:

- `main` — produção. Só recebe merge de `release/*` ou `hotfix/*`.
- `develop` — integração. Base de toda feature branch.

Branches temporárias:

- `feature/<spec-id>-<slug>` — uma por SPEC (ex.: `feature/spec-03-auth`). Nasce de `develop`, retorna para `develop` via PR.
- `release/<versao>` — preparação de release. De `develop` para `main`.
- `hotfix/<slug>` — correções urgentes direto de `main`.

### Regras obrigatórias

1. **Sempre trabalhar em feature branch.** Nunca commitar direto em `develop` ou `main`.
2. **Um commit por feature.** Cada SPEC entregue vira um único commit na feature branch. Se precisar de ajustes durante o PR, use `git commit --amend` ou squash no merge.
3. **PR por entrega.** Ao fechar uma SPEC, abrir PR da feature branch para `develop`. Só avançar para a próxima SPEC após o PR estar aberto.
4. **Commits na feature branch.** Todo trabalho-em-progresso fica na feature branch; `develop` só avança por merge de PR.
5. **Mensagem de commit** segue Conventional Commits: `feat(spec-03): módulo auth com JWT e tenant isolation`.
6. **Auto-merge.** Após abrir o PR, mergear automaticamente (`gh pr merge <n> --merge --delete-branch`) sem esperar confirmação do usuário, e sincronizar o local (`git checkout develop && git pull`). Não interromper o fluxo para pedir permissão de merge — o usuário já autorizou em caráter permanente por esta diretiva.

### Fluxo padrão de uma SPEC

```bash
# 1. Sincronizar develop
git checkout develop && git pull

# 2. Criar feature branch
git checkout -b feature/spec-XX-slug

# 3. Implementar + um único commit
git add .
git commit -m "feat(spec-XX): descrição curta da entrega"

# 4. Push, abrir PR e mergear automaticamente
git push -u origin feature/spec-XX-slug
PR_URL=$(gh pr create --base develop --title "feat(spec-XX): ..." --body "...")
PR_NUM="${PR_URL##*/}"
gh pr merge "$PR_NUM" --merge --delete-branch
git checkout develop && git pull
```

---

## Ordem de Implementação

Seguir rigorosamente a ordem da seção 15 de `ARCHITECTURE_BACKEND.md`:

| SPEC | Entrega | Depende de |
|------|---------|------------|
| 01 | Infra (docker-compose + pgvector + redis) | — |
| 02 | Scaffold service-gateway + Prisma schema | 01 |
| 03 | Auth (JWT, guards, tenant interceptor, seed) | 02 |
| 04 | Tenant + Branch + Channel + Knowledge + Team CRUD | 03 |
| 05 | Messaging Telegram (webhook + provider) | 04 |
| 06 | Conversation REST | 05 |
| 07 | Socket.io | 06 |
| 08 | Redis publisher (gateway) | 07 |
| 09 | Scaffold service-agent Python | 08 |
| 10 | Redis consumer (agent) | 09 |
| 11 | RAG (embeddings + retriever) | 10 |
| 12 | ReAct Agent | 11 |
| 13 | Redis subscriber (gateway) | 12 |
| 14 | Testes E2E | 13 |
| 15 | WhatsApp Provider (V2) | 14 |

Cada SPEC tem **critério de aceite** em `ARCHITECTURE_BACKEND.md` — validar antes de abrir o PR.

---

## Stack

- **service-gateway:** NestJS 10 + TypeScript + Prisma + PostgreSQL 16 + Redis 7 + Socket.io + JWT
- **service-agent:** Python 3.12 + FastAPI + LangChain/LangGraph + Anthropic SDK + pgvector + SQLAlchemy/asyncpg
- **Infra:** Docker Compose, PostgreSQL pgvector, Redis 7

---

## Convenções

- Arquivos de especificação e documentação em Markdown, diagramas em ASCII ou Mermaid.
- Variáveis de ambiente sempre via `.env` — nunca commitar segredos. `.env.example` é o contrato.
- Migrations Prisma são imutáveis depois de commitadas em `develop`.
- Testes junto ao código: `*.spec.ts` no gateway, `test_*.py` no agent.
- Prefira editar arquivos existentes a criar novos. Não criar documentação fora do necessário.

---

## Pendências Conhecidas

### Email único por tenant (não global)

Hoje `User.email` é `@unique` globalmente — um e-mail só pode existir em um tenant.
Para suportar o mesmo e-mail em múltiplos tenants bastaria mudar para `@@unique([tenantId, email])` no schema.

**Por que não foi feito:** o endpoint `POST /auth/login` recebe apenas `{ email, password }` sem `tenantId`.
Com email não-global, seria necessário também receber `tenantSlug` no login, o que muda o contrato da API
e o formulário do frontend. Decisão de produto pendente antes de implementar.

---

## Referências

- `ARCHITECTURE_BACKEND.md` — especificação técnica completa, contratos, schema, specs 01–15.
- Canais Redis, rotas REST, eventos Socket.io: consultar seções 6, 7 e 8 do documento de arquitetura.
