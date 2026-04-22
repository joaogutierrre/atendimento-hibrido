# Arquitetura de Software — Plataforma de Atendimento Multi-Canal Híbrido

> Documento gerado backend.md + frontend_prd.md. Cada seção descreve responsabilidades, contratos e estrutura esperada de cada parte do sistema.

---

## 1. Visão Geral do Produto

Plataforma SaaS multi-tenant de atendimento via mensageria (Telegram e WhatsApp) com modelo híbrido IA + humano.

- **Clientes da plataforma (tenants):** empresas que contratam o serviço
- **Atendedores:** funcionários do tenant, acessam o painel via login
- **Usuários finais:** clientes do tenant, interagem via Telegram ou WhatsApp
- **Agente de IA:** responde automaticamente e escalona para humano quando necessário

### Estratégia de canais

- **MVP:** Telegram (gratuito, sem burocracia, bot criado em 30 segundos via BotFather)
- **V2:** WhatsApp via Meta Cloud API (adicionado após validação do produto)

---

## 2. Stack Tecnológica

### service-gateway (NestJS + TypeScript)
- Runtime: Node.js 20+
- Framework: NestJS 10
- WebSocket: Socket.io (via @nestjs/platform-socket.io)
- ORM: Prisma
- Banco: PostgreSQL 16
- Cache/Fila: Redis 7 (ioredis)
- Auth: JWT (passport-jwt)
- Telegram: telegraf (Bot API)
- WhatsApp (V2): Meta Cloud API (REST)

### service-agent (Python)
- Runtime: Python 3.12+
- Framework: FastAPI (apenas para health check e admin endpoints)
- Agent: LangChain + LangGraph (ReAct Agent)
- LLM: Ollama gemma:4b local (langchain-ollama) — opção MVP sem custo de API
- Embeddings/RAG: pgvector + sentence-transformers
- Fila: Redis consumer groups
- ORM: SQLAlchemy + asyncpg

### Infra
- PostgreSQL 16 com extensão pgvector
- Redis 7
- Deploy inicial: Railway ou Render (um serviço por container)

---

## 3. Arquitetura de Serviços

\`\`\`
platform/
├── service-gateway/                  # NestJS
│   ├── src/
│   │   ├── auth/                     # JWT, guards, multi-tenant
│   │   ├── tenant/                   # CRUD de tenants (admin)
│   │   ├── messaging/                # Abstração multi-canal
│   │   │   ├── messaging.interface.ts
│   │   │   ├── messaging.service.ts  # Orquestra o provider correto
│   │   │   ├── telegram/
│   │   │   │   ├── telegram.provider.ts
│   │   │   │   └── telegram.webhook.ts
│   │   │   └── whatsapp/             # (V2)
│   │   │       ├── whatsapp.provider.ts
│   │   │       └── whatsapp.webhook.ts
│   │   ├── conversation/             # REST: listagem, status, histórico
│   │   ├── socket/                   # Socket.io gateway + rooms
│   │   ├── redis/                    # Publisher / Subscriber
│   │   └── prisma/                   # Schema e client
│   └── prisma/
│       └── schema.prisma
│
├── service-agent/                    # Python
│   ├── agent/
│   │   ├── core.py                   # LangGraph ReAct agent
│   │   ├── tools.py                  # Ferramentas do agente
│   │   ├── memory.py                 # Contexto de conversa
│   │   └── prompts.py                # System prompts por tenant
│   ├── rag/
│   │   ├── embeddings.py             # Geração de embeddings
│   │   └── retriever.py              # Busca semântica no pgvector
│   ├── consumer/
│   │   └── redis_consumer.py         # Consome eventos do Redis
│   └── main.py
│
└── infra/
    ├── docker-compose.yml
    └── .env.example
\`\`\`

---

## 4. Abstração Multi-Canal (MessagingProvider)

Toda comunicação com canais externos passa pela interface IMessagingProvider.
Adicionar WhatsApp na V2 é só implementar a interface — sem tocar em lógica de negócio.

\`\`\`typescript
// messaging/messaging.interface.ts
export interface IMessagingProvider {
  readonly channel: 'TELEGRAM' | 'WHATSAPP';
  sendMessage(to: string, content: string): Promise<string>;
  setup(config: ChannelConfig): Promise<void>;
}

// messaging/messaging.service.ts
@Injectable()
export class MessagingService {
  getProvider(type: ChannelType): IMessagingProvider {
    return type === 'TELEGRAM' ? this.telegram : this.whatsapp;
  }
}
\`\`\`

---

## 5. Modelo de Dados (PostgreSQL)

\`\`\`prisma
// prisma/schema.prisma

model Tenant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())

  users         User[]
  branches      Branch[]         // ← filiais
  knowledgeBase KnowledgeChunk[]
  agentConfig   AgentConfig?
}

// Filial — unidade física de um tenant (ex: Clínica Centro, Clínica Norte)
model Branch {
  id        String   @id @default(cuid())
  tenantId  String
  name      String                // ex: "Unidade Centro"
  address   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  tenant    Tenant             @relation(fields: [tenantId], references: [id])
  channels  MessagingChannel[] // cada filial pode ter 1 ou mais números
  users     UserBranch[]       // atendedores vinculados a esta filial
}

model User {
  id        String   @id @default(cuid())
  tenantId  String
  email     String   @unique
  password  String
  role      Role     @default(AGENT)
  createdAt DateTime @default(now())

  tenant        Tenant         @relation(fields: [tenantId], references: [id])
  branches      UserBranch[]   // atendedor pode atender mais de uma filial
  conversations Conversation[] @relation("AssignedAgent")
}

// Tabela de junção: atendedor ↔ filial
model UserBranch {
  userId   String
  branchId String

  user   User   @relation(fields: [userId], references: [id])
  branch Branch @relation(fields: [branchId], references: [id])

  @@id([userId, branchId])
}

enum Role { ADMIN AGENT }

model MessagingChannel {
  id          String      @id @default(cuid())
  tenantId    String
  branchId    String      // ← obrigatório: todo número pertence a uma filial
  type        ChannelType
  identifier  String      @unique
  displayName String
  isActive    Boolean     @default(true)

  branch        Branch         @relation(fields: [branchId], references: [id])
  conversations Conversation[]
}

enum ChannelType { TELEGRAM WHATSAPP }

model Conversation {
  id             String           @id @default(cuid())
  tenantId       String
  branchId       String           // ← denormalizado para queries rápidas por filial
  channelId      String
  customerRef    String
  customerName   String?
  mode           ConversationMode @default(AI)
  status         ConvStatus       @default(OPEN)
  assignedUserId String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  channel      MessagingChannel @relation(fields: [channelId], references: [id])
  assignedUser User?            @relation("AssignedAgent", fields: [assignedUserId], references: [id])
  messages     Message[]
}

enum ConversationMode { AI HUMAN }
enum ConvStatus { OPEN RESOLVED WAITING }

model Message {
  id             String     @id @default(cuid())
  conversationId String
  sender         SenderType
  content        String
  externalId     String?
  createdAt      DateTime   @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id])
}

enum SenderType { USER AGENT AI SYSTEM }

model AgentConfig {
  id                String   @id @default(cuid())
  tenantId          String   @unique  // configuração global do tenant
  systemPrompt      String   @db.Text
  tone              String   @default("professional")
  escalateOnWords   String[]
  offHoursMessage   String?
  workingHoursStart Int      @default(8)
  workingHoursEnd   Int      @default(18)

  tenant Tenant @relation(fields: [tenantId], references: [id])
}

model KnowledgeChunk {
  id        String   @id @default(cuid())
  tenantId  String
  content   String   @db.Text
  embedding Unsupported("vector(1536)")?
  sourceUrl String?
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])
}
\`\`\`

---

## 6. Eventos Redis (Contrato entre Serviços)

\`\`\`
CHANNEL: messaging:incoming
Publicado por: service-gateway
Consumido por: service-agent
Payload: {
  tenantId: string
  channelType: "TELEGRAM" | "WHATSAPP"
  conversationId: string
  messageId: string
  customerRef: string
  content: string
  timestamp: ISO8601
}

CHANNEL: agent:respond
Publicado por: service-agent
Consumido por: service-gateway
Payload: { conversationId, tenantId, content }

CHANNEL: agent:escalate
Publicado por: service-agent
Consumido por: service-gateway
Payload: { conversationId, tenantId, reason: string }

CHANNEL: conversation:updated
Publicado por: service-gateway → Socket.io
Payload: { conversationId, tenantId, mode, status }
\`\`\`

---

## 7. API REST — service-gateway

### Auth
\`\`\`
POST /auth/login   Body: { email, password }   Response: { accessToken: JWT }
\`\`\`

### Conversas (JWT required)
\`\`\`
GET    /conversations
GET    /conversations/:id
PATCH  /conversations/:id/mode     { mode: "AI" | "HUMAN" }
PATCH  /conversations/:id/assign   { userId }
PATCH  /conversations/:id/resolve
POST   /conversations/:id/messages { content }
\`\`\`

### Admin (role: ADMIN)
\`\`\`
GET    /tenant/config
PUT    /tenant/config
POST   /tenant/knowledge
DELETE /tenant/knowledge/:id
GET    /tenant/channels
POST   /tenant/channels   { type, identifier, displayName }
DELETE /tenant/channels/:id
\`\`\`

---

## 8. WebSocket — Socket.io (service-gateway)

\`\`\`
URL: ws://host/socket.io
Auth: handshake.auth = { token: JWT }

Rooms automáticas:
  tenant:{tenantId}
  user:{userId}

Eventos servidor → cliente:
  conversation:new
  conversation:message
  conversation:escalated
  conversation:updated

Eventos cliente → servidor:
  conversation:join   { conversationId }
  conversation:leave  { conversationId }
  typing              { conversationId }
\`\`\`

---

## 9. service-agent — Ferramentas do Agente

\`\`\`python
tools = [
    send_message(conversation_id, content),       # envia pelo canal correto
    escalate_to_human(conversation_id, reason),   # publica agent:escalate
    search_knowledge_base(tenant_id, query),      # RAG com pgvector
    get_conversation_history(conversation_id),    # últimas N mensagens
]

# Regras de escalonamento:
# 1. Cliente pede para falar com humano
# 2. Resposta não encontrada no RAG
# 3. Palavra da lista escalateOnWords detectada
# 4. Fora do horário de funcionamento
# 5. Incerteza alta — prefere escalonar a inventar
\`\`\`

---

## 10. Fluxo Completo

\`\`\`
1. Usuário envia mensagem (Telegram ou WhatsApp)
2. service-gateway recebe → identifica MessagingChannel → salva Message
   → publica messaging:incoming com channelType
3. service-agent consome → se HUMAN ignora → se AI processa
4a. Agente responde: send_message() → MessagingService → canal correto
4b. Agente escalona: agent:escalate → mode=HUMAN → Socket.io notifica painel
5. Atendedor responde → POST /messages → MessagingService → canal correto
\`\`\`

---

## 11. Variáveis de Ambiente

\`\`\`bash
# service-gateway
DATABASE_URL=postgresql://user:pass@localhost:5432/platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
TELEGRAM_WEBHOOK_SECRET=...
META_API_TOKEN=...       # V2
META_VERIFY_TOKEN=...    # V2
PORT=3000

# service-agent
DATABASE_URL=postgresql://user:pass@localhost:5432/platform
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-...
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
PORT=8000
\`\`\`

> Bot Tokens do Telegram são armazenados criptografados em MessagingChannel.identifier, um por tenant.

---

## 12. Docker Compose

\`\`\`yaml
version: "3.9"
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: platform
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  gateway:
    build: ./service-gateway
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    env_file: ./service-gateway/.env

  agent:
    build: ./service-agent
    ports: ["8000:8000"]
    depends_on: [postgres, redis]
    env_file: ./service-agent/.env

volumes:
  pgdata:
\`\`\`

---

## 13. Roadmap de Escala

| Fase | Trigger | Ação |
|------|---------|------|
| MVP | 0–10 tenants | Telegram only, monolito modular |
| Fase 1 | > 50 tenants | Adiciona WhatsApp (V2), read replica PG |
| Fase 2 | > 100 tenants | Redis Cluster, múltiplas instâncias |
| Fase 3 | > 300 tenants | Redis → Kafka |
| Fase 4 | > 500 tenants | Sharding por tenant, OpenTelemetry |

---

## 14. Distribuição de Contêineres

### Visão Geral

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                     Docker Network                       │
│                    (platform_net)                        │
│                                                         │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │   gateway    │     │    agent     │                   │
│  │  NestJS:3000 │     │  Python:8000 │                   │
│  └──────┬───────┘     └──────┬───────┘                   │
│         │                   │                            │
│         └──────────┬─────────┘                           │
│                    │                                     │
│         ┌──────────┴──────────┐                          │
│         │                     │                          │
│  ┌──────▼──────┐    ┌─────────▼─────┐                   │
│  │  postgres   │    │     redis     │                    │
│  │  pgvector   │    │    :6379      │                    │
│  │   :5432     │    └───────────────┘                   │
│  └─────────────┘                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘

Portas expostas ao host (dev):
  gateway   → localhost:3000
  agent     → localhost:8000 (health check only)
  postgres  → localhost:5432
  redis     → localhost:6379

Produção: apenas gateway exposto via reverse proxy (Nginx/Traefik)
\`\`\`

---

### Contêiner 1 — service-gateway

\`\`\`dockerfile
# service-gateway/Dockerfile

# ── Build stage ──
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production stage ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
\`\`\`

\`\`\`yaml
# service-gateway/docker-compose.override.yml (dev)
services:
  gateway:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder        # usa o build stage com hot-reload
    command: npm run start:dev
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/platform
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
\`\`\`

---

### Contêiner 2 — service-agent

\`\`\`dockerfile
# service-agent/Dockerfile

# ── Build stage ──
FROM python:3.12-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Production stage ──
FROM python:3.12-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

EXPOSE 8000

CMD ["python", "main.py"]
\`\`\`

\`\`\`yaml
# service-agent/docker-compose.override.yml (dev)
services:
  agent:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    command: python main.py
    volumes:
      - .:/app
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/platform
      REDIS_URL: redis://redis:6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
\`\`\`

---

### Contêiner 3 — postgres

\`\`\`yaml
postgres:
  image: pgvector/pgvector:pg16
  restart: unless-stopped
  environment:
    POSTGRES_DB: platform
    POSTGRES_USER: user
    POSTGRES_PASSWORD: pass
  ports:
    - "5432:5432"
  volumes:
    - pgdata:/var/lib/postgresql/data
    - ./infra/init.sql:/docker-entrypoint-initdb.d/init.sql
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U user -d platform"]
    interval: 10s
    timeout: 5s
    retries: 5
\`\`\`

\`\`\`sql
-- infra/init.sql (executado na criação do banco)
CREATE EXTENSION IF NOT EXISTS vector;
\`\`\`

---

### Contêiner 4 — redis

\`\`\`yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  command: redis-server --appendonly yes    # persistência AOF
  ports:
    - "6379:6379"
  volumes:
    - redisdata:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 3
\`\`\`

---

### docker-compose.yml (raiz — desenvolvimento completo)

\`\`\`yaml
version: "3.9"

services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_DB: platform
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d platform"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - platform_net

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - platform_net

  gateway:
    build:
      context: ./service-gateway
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - ./service-gateway/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - platform_net

  agent:
    build:
      context: ./service-agent
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - ./service-agent/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - platform_net

networks:
  platform_net:
    driver: bridge

volumes:
  pgdata:
  redisdata:
\`\`\`

---

### Estrutura de arquivos Docker

\`\`\`
platform/
├── docker-compose.yml          # orquestração completa
├── infra/
│   └── init.sql                # CREATE EXTENSION vector
├── service-gateway/
│   ├── Dockerfile
│   └── .env
└── service-agent/
    ├── Dockerfile
    └── .env
\`\`\`

---

### Comandos úteis

\`\`\`bash
# Subir tudo
docker compose up -d

# Subir só infra (banco + redis)
docker compose up -d postgres redis

# Rodar migrations do Prisma
docker compose exec gateway npx prisma migrate dev

# Ver logs em tempo real
docker compose logs -f gateway agent

# Rebuild após mudanças de código
docker compose up -d --build gateway agent

# Derrubar tudo preservando volumes
docker compose down

# Derrubar tudo e apagar volumes (reset completo)
docker compose down -v
\`\`\`

---

*Documento gerado via Raven Labs Architecture Tool v1.1. Para o PRD do frontend, consultar FRONTEND_PRD.md*
---

## 15. Ordem de Implementação — Spec-Driven Development

> Cada spec é uma unidade autônoma de trabalho entregável ao Claude Code.
> A ordem respeita dependências: nenhuma spec depende de algo não implementado anteriormente.
> Para cada spec: leia o contexto relevante deste documento, implemente, valide, só então avance.

---

### SPEC-01 — Infraestrutura base

**Objetivo:** ambiente local funcional com banco e cache prontos.

**Entregáveis:**
- `docker-compose.yml` na raiz com `postgres`, `redis`, `platform_net`
- `infra/init.sql` executando `CREATE EXTENSION IF NOT EXISTS vector`
- healthchecks funcionando em ambos os serviços
- `.env.example` com todas as variáveis necessárias

**Critério de aceite:**
```bash
docker compose up -d postgres redis
docker compose exec postgres pg_isready -U user -d platform  # OK
docker compose exec redis redis-cli ping                      # PONG
```

---

### SPEC-02 — Scaffold service-gateway

**Objetivo:** projeto NestJS inicializado, buildando e conectando ao banco.

**Entregáveis:**
- `service-gateway/` inicializado com NestJS CLI
- Prisma configurado com `DATABASE_URL` via env
- `schema.prisma` com todos os models da seção 5 deste documento
- Primeira migration executada com sucesso
- `Dockerfile` multi-stage da seção 14
- Serviço subindo via `docker compose up gateway`

**Critério de aceite:**
```bash
docker compose exec gateway npx prisma migrate dev --name init
# Todas as tabelas criadas sem erro
```

---

### SPEC-03 — Módulo Auth (service-gateway)

**Objetivo:** autenticação JWT funcional com isolamento por tenant.

**Entregáveis:**
- `POST /auth/login` retornando `{ accessToken: JWT }`
- JWT contém `{ userId, tenantId, role }` no payload
- `JwtAuthGuard` global aplicado
- `TenantInterceptor` injetando `tenantId` em todos os requests autenticados
- Seed com 1 tenant + 1 user ADMIN + 1 user AGENT para testes

**Critério de aceite:**
```bash
POST /auth/login { email, password }           # 200 + token
POST /auth/login { email, senha_errada }       # 401
GET  /conversations (sem token)                # 401
GET  /conversations (com token)                # 200 (lista vazia)
```

---

### SPEC-04 — Módulo Tenant + Branch (service-gateway)

**Objetivo:** CRUD de configuração do tenant e suas filiais.

**Entregáveis:**
- `GET/PUT /tenant/config` — lê e atualiza `AgentConfig`
- `GET/POST/DELETE /tenant/branches` — gerencia filiais (`Branch`)
- `GET/POST/DELETE /tenant/channels` — gerencia `MessagingChannel` vinculado a uma filial
- `GET/POST/DELETE /tenant/knowledge` — gerencia `KnowledgeChunk` (sem embedding ainda)
- `GET/POST/DELETE /tenant/team` — gerencia `User` do tenant
- Todos os endpoints filtrados por `tenantId` do JWT

**Critério de aceite:**
```bash
POST /tenant/branches { name: "Unidade Centro" }   # 201
GET  /tenant/branches                              # lista com 1 branch
# Tenant B não enxerga branches do Tenant A
```

---

### SPEC-05 — Módulo Messaging — Telegram (service-gateway)

**Objetivo:** receber e enviar mensagens pelo Telegram.

**Entregáveis:**
- `TelegramProvider` implementando `IMessagingProvider`
- Webhook configurado automaticamente ao cadastrar canal (`POST /tenant/channels`)
- `POST /telegram/webhook` recebendo updates do Telegram
- Ao receber mensagem: cria/resolve `Conversation`, salva `Message` (sender: USER)
- `MessagingService.sendMessage()` enviando via Bot API do Telegram
- Validação de secret token no header do webhook

**Critério de aceite:**
```bash
# Simular POST de webhook com payload de mensagem do Telegram
POST /telegram/webhook { message: { chat: { id }, text: "Oi" } }
# Conversation criada no banco, Message salva com sender=USER
```

---

### SPEC-06 — Módulo Conversation REST (service-gateway)

**Objetivo:** API REST completa para o painel consumir.

**Entregáveis:**
- `GET /conversations` — lista paginada filtrada por `tenantId`, com filtros de `status` e `mode`
- `GET /conversations/:id` — detalhes + últimas 50 mensagens
- `PATCH /conversations/:id/mode` — alterna AI ↔ HUMAN
- `PATCH /conversations/:id/assign` — atribui a atendedor
- `PATCH /conversations/:id/resolve` — fecha conversa
- `POST /conversations/:id/messages` — atendedor envia mensagem (salva + envia via MessagingService)

**Critério de aceite:**
```bash
PATCH /conversations/:id/mode { mode: "HUMAN" }    # 200, mode atualizado
POST  /conversations/:id/messages { content: "Olá" }
# Message salva com sender=AGENT e entregue no Telegram
```

---

### SPEC-07 — Módulo Socket.io (service-gateway)

**Objetivo:** push em tempo real para o painel dos atendedores.

**Entregáveis:**
- `ChatGateway` com Socket.io configurado
- Autenticação via `handshake.auth.token` (JWT)
- Join automático em `tenant:{tenantId}` e `user:{userId}` ao conectar
- Eventos emitidos: `conversation:new`, `conversation:message`, `conversation:escalated`, `conversation:updated`
- Eventos recebidos: `conversation:join`, `conversation:leave`, `typing`
- Emissão disparada nos endpoints da SPEC-06 após cada mutação

**Critério de aceite:**
```bash
# Cliente conecta com JWT válido
# POST /conversations/:id/messages
# Cliente recebe evento conversation:message via Socket.io em < 200ms
```

---

### SPEC-08 — Módulo Redis Publisher (service-gateway)

**Objetivo:** publicar eventos para o service-agent consumir.

**Entregáveis:**
- `RedisPublisher` injetável em qualquer módulo
- Publicação de `messaging:incoming` após salvar nova mensagem com sender=USER
- Publicação de `conversation:updated` após qualquer mudança de status/modo
- Payload conforme contrato da seção 6

**Critério de aceite:**
```bash
# Simular webhook Telegram → mensagem salva
# redis-cli SUBSCRIBE messaging:incoming
# Evento recebido com tenantId, conversationId, channelType corretos
```

---

### SPEC-09 — Scaffold service-agent

**Objetivo:** projeto Python inicializado, conectando ao banco e ao Redis.

**Entregáveis:**
- `service-agent/` com estrutura de pastas da seção 3
- `requirements.txt` com todas as dependências
- Conexão com PostgreSQL via SQLAlchemy + asyncpg testada
- Conexão com Redis testada
- `Dockerfile` multi-stage da seção 14
- `main.py` inicializando o consumer sem travar
- FastAPI com `GET /health` retornando `{ status: "ok" }`

**Critério de aceite:**
```bash
docker compose up agent
curl localhost:8000/health   # { "status": "ok" }
```

---

### SPEC-10 — Redis Consumer (service-agent)

**Objetivo:** consumir eventos do Redis e rotear para o agente.

**Entregáveis:**
- `redis_consumer.py` consumindo `messaging:incoming` com consumer groups
- Verificação de `conversation.mode`: ignora se `HUMAN`, processa se `AI`
- Chamada ao `agent/core.py` com o payload recebido
- Publicação de `agent:respond` e `agent:escalate` conforme decisão do agente
- Tratamento de erros: mensagem volta para a fila em caso de falha

**Critério de aceite:**
```bash
# Publicar manualmente em messaging:incoming com mode=AI
# Consumer processa e publica em agent:respond ou agent:escalate
# Publicar com mode=HUMAN → consumer ignora silenciosamente
```

---

### SPEC-11 — RAG — Base de Conhecimento (service-agent)

**Objetivo:** busca semântica funcional na base de conhecimento do tenant.

**Entregáveis:**
- `rag/embeddings.py` gerando embeddings via `sentence-transformers`
- Worker que processa `KnowledgeChunk` sem embedding e preenche o campo `vector`
- `rag/retriever.py` fazendo busca por similaridade com pgvector (`<->` operator)
- Endpoint `POST /tenant/knowledge` no gateway aciona geração de embedding via Redis event
- Tool `search_knowledge_base(tenant_id, query)` retornando top-3 chunks

**Critério de aceite:**
```bash
# Cadastrar chunk: "Nosso horário é de segunda a sexta, 8h às 18h"
# search_knowledge_base(tenant_id, "qual o horário de vocês?")
# Retorna o chunk correto com score > 0.7
```

---

### SPEC-12 — ReAct Agent (service-agent)

**Objetivo:** agente autônomo tomando decisões com base no contexto do tenant.

**Entregáveis:**
- `agent/core.py` com `create_react_agent` (LangChain) + **Ollama gemma:4b** (LLM local — sem custo de API; opção MVP)
- `agent/tools.py` com as 4 ferramentas: `send_message`, `escalate_to_human`, `search_knowledge_base`, `get_conversation_history`
- `agent/prompts.py` construindo system prompt dinâmico a partir de `AgentConfig` do tenant
- `agent/memory.py` buscando últimas N mensagens da conversa para contexto
- Lógica de escalonamento por palavras-gatilho e fora do horário

**Critério de aceite:**
```bash
# Enviar "qual o horário de vocês?" → agente responde com dado do RAG
# Enviar "quero cancelar meu plano" (palavra-gatilho) → escalona
# Enviar "quero falar com um humano" → escalona com motivo correto
# Pergunta sem resposta no RAG → escalona (não inventa)
```

---

### SPEC-13 — Redis Consumer no Gateway (escalate + respond)

**Objetivo:** gateway consome respostas do agent e fecha o loop.

**Entregáveis:**
- `RedisSubscriber` no gateway consumindo `agent:respond`
  - Salva `Message` (sender: AI) no banco
  - Chama `MessagingService.sendMessage()` para entregar ao usuário
  - Emite `conversation:message` via Socket.io
- Consumidor de `agent:escalate`
  - Atualiza `conversation.mode = HUMAN`
  - Emite `conversation:escalated` via Socket.io com motivo

**Critério de aceite:**
```bash
# Fluxo completo E2E:
# 1. Usuário envia msg no Telegram
# 2. Gateway salva + publica messaging:incoming
# 3. Agent processa + publica agent:respond
# 4. Gateway entrega resposta no Telegram
# 5. Painel recebe conversation:message via Socket.io
```

---

### SPEC-14 — Testes de Integração E2E

**Objetivo:** validar os fluxos críticos antes do deploy.

**Entregáveis:**
- Teste: mensagem recebida → resposta da IA entregue no Telegram
- Teste: gatilho de escalonamento → atendedor notificado via Socket.io
- Teste: atendedor responde → mensagem entregue no Telegram
- Teste: isolamento multi-tenant (Tenant A não acessa dados do Tenant B)
- Teste: modo HUMAN → agent ignora mensagens da conversa

**Ferramentas sugeridas:** Jest (gateway) + pytest (agent) + Supertest (HTTP) + Socket.io client mock

---

### SPEC-15 — WhatsApp Provider (V2)

**Objetivo:** adicionar WhatsApp como segundo canal sem alterar lógica de negócio.

**Entregáveis:**
- `WhatsAppProvider` implementando `IMessagingProvider`
- `POST /whatsapp/webhook` com validação HMAC (Meta)
- `GET /whatsapp/webhook` para verificação do endpoint (Meta exige)
- `MessagingService` registrando o novo provider
- Migração do `ChannelType` já existe no schema — apenas ativar o provider

**Critério de aceite:**
```bash
# Mesmo conjunto de testes da SPEC-05, agora com payload do WhatsApp
# Conversa via WhatsApp e via Telegram coexistindo no mesmo tenant
```

---

### Mapa de dependências

```
SPEC-01 (infra)
  └── SPEC-02 (scaffold gateway)
        ├── SPEC-03 (auth)
        │     └── SPEC-04 (tenant/branch)
        │           ├── SPEC-05 (telegram)
        │           │     └── SPEC-06 (conversation REST)
        │           │           ├── SPEC-07 (socket.io)
        │           │           └── SPEC-08 (redis publisher)
        │           │                 └── SPEC-09 (scaffold agent)
        │           │                       └── SPEC-10 (redis consumer)
        │           │                             ├── SPEC-11 (RAG)
        │           │                             └── SPEC-12 (react agent)
        │           │                                   └── SPEC-13 (gateway subscriber)
        │           │                                         └── SPEC-14 (testes E2E)
        │           │                                               └── SPEC-15 (whatsapp V2)
        │           └── (canal reutilizado nas specs seguintes)
        └── (auth reutilizado em todas as specs seguintes)
```

---

*Documento gerado via Raven Labs Architecture Tool v1.1. Para o PRD do frontend, consultar FRONTEND_PRD.md*
