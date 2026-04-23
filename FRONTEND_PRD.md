# PRD — Frontend (Painel de Atendimento)

> Documento de especificação de produto para o painel web de atendimento multi-canal.

---

## 1. Rotas & Controle de Acesso

| Rota | Acesso |
|------|--------|
| `/login` | Público — redireciona para `/conversations` se já autenticado |
| `/conversations` | ADMIN e AGENT |
| `/settings` | Somente ADMIN — rota bloqueada para AGENT |

**Cargos:**

| Cargo | Permissões |
|-------|-----------|
| ADMIN | Todas as telas, incluindo Configurações completas |
| AGENT | Somente Painel de Conversas |

---

## 2. Autenticação

**Login:**
- Campos: E-mail + Senha (mínimo 6 caracteres)
- Sem opção de cadastro — atendedores são criados pelo ADMIN
- Ao autenticar com sucesso: token salvo localmente, conexão em tempo real estabelecida, redirecionamento para `/conversations`
- Erros: credenciais inválidas → mensagem "E-mail ou senha incorretos"
- Token expirado ou inválido → logout automático e redirecionamento para `/login`

**Integração:**
- `POST /auth/login` — body: `{ email, password }` → retorna `{ accessToken }`
- O token deve ser enviado como `Bearer {token}` no cabeçalho de todas as requisições autenticadas
- O mesmo token é usado para autenticar a conexão em tempo real (WebSocket)

---

## 3. Tela 1 — Login (`/login`)

Layout centralizado com card único e logo da plataforma.

**Campos:**
- E-mail (campo de texto tipo email)
- Senha (campo de texto tipo password)
- Botão "Entrar"

**Comportamento:**
- Enquanto a requisição está em andamento: botão desabilitado com indicador de carregamento
- Erro de credenciais: mensagem de erro abaixo do formulário
- Sucesso: redirecionamento automático para `/conversations`

---

## 4. Tela 2 — Painel de Conversas (`/conversations`)

Layout de 3 colunas fixas.

```
┌────────────────┬──────────────────────┬────────────────┐
│  Lista (260px) │  Conversa (flex: 1)  │ Detalhes(280px)│
└────────────────┴──────────────────────┴────────────────┘
```

---

### Coluna 1 — Lista de Conversas

**Filtros:**

| Filtro | Valores possíveis |
|--------|------------------|
| Status | Todas / Abertas (`OPEN`) / Aguardando (`WAITING`) / Resolvidas (`RESOLVED`) |
| Canal | Ícones Telegram / WhatsApp (filtragem visual local) |
| Modo | IA / Humano |

**Paginação:** carrega 20 itens por vez com botão "Carregar mais" ao final da lista.

**Cada item da lista exibe:**
- Avatar com iniciais do nome do cliente
- Nome do cliente (ou referência se nome indisponível)
- Preview truncado da última mensagem (60 caracteres)
- Timestamp relativo (ex.: "há 3 min")
- Badge de modo: IA = indigo / Humano = emerald
- Badge de canal: ícone Telegram (azul) ou WhatsApp (verde)
- Bolinha vermelha de não lido quando há mensagens novas

**Ordenação:** por data de atualização, mais recente primeiro. Atualizada em tempo real.

**Integração:**
- `GET /conversations` — parâmetros: `status`, `mode`, `branchId`, `take`, `skip`
- Eventos em tempo real `conversation:new` e `conversation:updated` atualizam a lista automaticamente

---

### Coluna 2 — Janela de Conversa

**Ao abrir uma conversa:**
- Carrega histórico completo (últimas 50 mensagens)
- Marca como lida (zera badge de não lido)
- Entra na sala de tempo real da conversa

**Ao fechar ou trocar de conversa:**
- Sai da sala de tempo real da conversa anterior

**Header da conversa:**
```
[Avatar] Nome do Cliente   [Badge canal]  [Badge modo: IA / Humano]
                           [Toggle Assumir / Devolver para IA]  [Resolver]
```

**Toggle Assumir / Devolver para IA:**
- "Assumir": muda o modo para Humano → `PATCH /conversations/:id/mode` com `{ mode: "HUMAN" }`
- "Devolver para IA": muda o modo para IA → `PATCH /conversations/:id/mode` com `{ mode: "AI" }`
- Atualização otimista: a interface reflete a mudança imediatamente, revertendo em caso de erro

**Resolver:**
- `PATCH /conversations/:id/resolve`
- Conversa desaparece da lista "Abertas" e aparece em "Resolvidas"

**Atribuição a atendedor (visível apenas para ADMIN):**
- Select dropdown com membros da equipe
- `PATCH /conversations/:id/assign` com `{ userId }` para atribuir ou `{ userId: null }` para desatribuir
- Ao atribuir um atendedor, o modo é automaticamente alterado para Humano pelo backend

**Bolhas de mensagem:**

| Remetente | Posição | Estilo |
|-----------|---------|--------|
| `USER` (cliente) | Esquerda | Bubble cinza |
| `AGENT` (atendedor) | Direita | Bubble cor primária |
| `AI` (inteligência artificial) | Direita | Bubble indigo + ícone de robô |
| `SYSTEM` (sistema) | Centro | Texto cinza itálico |

**Campo de texto (input):**
- **Desabilitado** quando `mode = AI` — tooltip: "IA está no controle — clique em 'Assumir' para responder"
- **Habilitado** quando `mode = HUMAN`
- Envio com Enter; Shift+Enter para nova linha
- Limite de 4096 caracteres
- Indicador de "digitando..." enviado enquanto o atendedor digita (com pequeno atraso para evitar spam)
- `POST /conversations/:id/messages` — body: `{ content }`

**Scroll:** automático para a última mensagem ao receber nova mensagem com a conversa aberta.

**Integração em tempo real:**
- `conversation:message` → adiciona a mensagem à conversa aberta
- `typing` → exibe "Digitando..." por 3 segundos abaixo do input

---

### Coluna 3 — Detalhes do Cliente

Exibidos a partir dos dados da conversa selecionada:

| Campo | Valor |
|-------|-------|
| Nome | Nome do cliente ou referência externa |
| Canal | Tipo (Telegram / WhatsApp) + nome do canal |
| Referência | ID do chat ou número de telefone |
| Filial | Nome da filial vinculada ao canal |
| Atendedor atual | E-mail do atendedor atribuído ou "Não atribuído" |
| Status | Badge de status da conversa |
| Criado em | Data de criação da conversa |

---

## 5. Tela 3 — Configurações (`/settings`) — ADMIN

Dividida em 5 abas.

---

### Aba: Agente de IA

Configuração do comportamento do agente autônomo para o tenant.

**Integração:** `GET /tenant/config` (carrega) / `PUT /tenant/config` (salva)

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| System Prompt | Área de texto longa | Instrução base de comportamento do agente |
| Tom de voz | Seletor | Profissional / Casual / Técnico / Amigável |
| Palavras-gatilho | Campo de tags | Palavras que forçam escalonamento para humano |
| Horário de início | Seletor de hora | Início do atendimento (0–23h) |
| Horário de fim | Seletor de hora | Fim do atendimento (0–23h) |
| Mensagem fora do horário | Área de texto | Resposta automática fora do horário configurado |

---

### Aba: Filiais

Gerenciamento das filiais do tenant. Filiais são obrigatórias para a criação de canais.

**Integração:** `GET /tenant/branches` / `POST /tenant/branches` / `DELETE /tenant/branches/:id`

**Listagem:**
- Tabela com: nome, endereço, status (Ativa / Inativa)
- Botão "Nova Filial" → modal com campos: Nome (obrigatório) + Endereço (opcional)
- Toggle de ativo/inativo por filial
- Botão remover com confirmação via diálogo

---

### Aba: Canais

Gerenciamento dos canais de atendimento (Telegram e WhatsApp).

**Integração:** `GET /tenant/channels` / `POST /tenant/channels` / `DELETE /tenant/channels/:id`

**Listagem:**
- Tabela com: tipo (ícone), nome, filial vinculada, status
- Botão "Adicionar Canal" → modal com seletor de tipo

**Campos ao criar — Telegram:**

| Campo | Descrição |
|-------|-----------|
| Nome do canal | Identificação interna (ex.: "Suporte Telegram") |
| Filial | Seletor entre filiais cadastradas |
| Bot Token | Obtido no @BotFather do Telegram (`/newbot` → copiar token) |

> O backend registra o webhook automaticamente ao criar o canal, se a URL pública estiver configurada.

**Campos ao criar — WhatsApp:**

| Campo | Descrição |
|-------|-----------|
| Nome do canal | Identificação interna (ex.: "WhatsApp Comercial") |
| Filial | Seletor entre filiais cadastradas |
| Phone Number ID | ID do número obtido no Meta Developer Portal |

> O webhook do WhatsApp é configurado manualmente no Meta Developer Portal, apontando para a URL do backend. O token de verificação é configurado pelo administrador da infra.

---

### Aba: Base de Conhecimento

Textos que o agente de IA consulta para responder às perguntas dos clientes.

**Integração:** `GET /tenant/knowledge` / `POST /tenant/knowledge` / `DELETE /tenant/knowledge/:id`

**Listagem:**

| Coluna | Descrição |
|--------|-----------|
| Conteúdo | Texto truncado (120 caracteres) |
| Status embedding | "Processando..." (amarelo) enquanto a IA processa / "Pronto" (verde) quando disponível |
| Data | Data de criação |
| Ação | Botão remover |

> O processamento de embedding ocorre automaticamente em segundo plano após a criação.

**Adicionar:** botão "Adicionar Texto" → modal com:
- Área de texto: conteúdo do chunk (obrigatório)
- Campo URL: fonte do conteúdo (opcional, deve ser URL válida)

---

### Aba: Equipe

Gerenciamento dos atendedores e administradores do tenant.

**Integração:** `GET /tenant/team` / `POST /tenant/team` / `DELETE /tenant/team/:id`

**Listagem:**

| Coluna | Descrição |
|--------|-----------|
| E-mail | E-mail do usuário |
| Cargo | ADMIN (indigo) / AGENT (slate) |
| Filiais | Nomes das filiais vinculadas |
| Ações | Botão remover |

**Modal "Adicionar Membro":**

| Campo | Validação |
|-------|-----------|
| E-mail | Formato de e-mail válido |
| Senha | Mínimo 6 caracteres |
| Cargo | Seletor: ADMIN ou AGENT |
| Filiais | Multi-seleção das filiais ativas (opcional) |

---

## 6. Notificações em Tempo Real

A conexão em tempo real é estabelecida automaticamente após o login usando o token JWT.

| Evento recebido | Comportamento na interface |
|----------------|---------------------------|
| `conversation:new` | Toast "Nova conversa de {nome}" + item adicionado ao topo da lista |
| `conversation:message` (conversa aberta) | Mensagem adicionada ao chat + scroll automático |
| `conversation:message` (conversa fechada) | Badge de não lido incrementado na lista |
| `conversation:updated` | Item na lista atualizado; se resolvida → removida de "Abertas" |
| `conversation:escalated` | Toast laranja destacado "Conversa escalada: {motivo}" + som de alerta (opcional) + badge de modo atualizado para Humano |
| `typing` | Indicador "Digitando..." exibido por 3 segundos abaixo do input |

---

## 7. Regras de UX

1. Atendedor enxerga apenas conversas do seu tenant — sem filtro manual necessário (garantido pelo backend)
2. Input de mensagem desabilitado quando o modo é IA, com tooltip explicativo
3. Toggle Assumir/Devolver atualiza a interface imediatamente (otimista), confirmando com o servidor em seguida
4. Ao resolver, a conversa some da lista "Abertas" e aparece em "Resolvidas"
5. Menu de Configurações oculto para AGENT — rota bloqueada
6. Layout responsivo mínimo para tablets (768px) — não precisa ser mobile-first
7. Dark mode como padrão visual
8. Erros de API exibidos como toast vermelho com a mensagem retornada pelo backend
9. Estados de carregamento em todos os formulários e listagens (skeleton ou spinner)

---

## 8. Paleta de Cores

| Elemento | Hex |
|----------|-----|
| Background principal | `#0f172a` |
| Surface / cards | `#1e293b` |
| Borda sutil | `#334155` |
| Texto primário | `#f1f5f9` |
| Texto secundário | `#94a3b8` |
| Modo IA (accent) | `#6366f1` (indigo) |
| Modo Humano (accent) | `#10b981` (emerald) |
| Alerta / escalação | `#f59e0b` (amber) |
| Canal Telegram | `#229ED9` |
| Canal WhatsApp | `#25D366` |

---

## 9. Fluxo Completo E2E (referência de comportamento)

```
1. Cliente envia mensagem no Telegram ou WhatsApp
2. Backend recebe → salva mensagem → emite evento em tempo real
3. Painel recebe evento → atualiza lista e janela de conversa
4. IA processa a mensagem automaticamente (modo AI)
5. IA responde ou escala para humano
6. Painel recebe resposta da IA → exibe na conversa
7. Se escalado → toast laranja + modo muda para Humano
8. Atendedor assume a conversa e responde pelo painel
9. Backend entrega a resposta ao cliente pelo canal original
```

---

## 10. Contratos de API (referência de integração)

> Todos os endpoints autenticados exigem cabeçalho `Authorization: Bearer {token}`.  
> Todos os IDs são strings. Todos os timestamps são ISO 8601.

### Autenticação
| Ação | Método | Endpoint | Body |
|------|--------|----------|------|
| Login | POST | `/auth/login` | `{ email, password }` |

### Conversas
| Ação | Método | Endpoint | Body / Params |
|------|--------|----------|---------------|
| Listar | GET | `/conversations` | `?status=&mode=&branchId=&take=&skip=` |
| Detalhar (com mensagens) | GET | `/conversations/:id` | — |
| Trocar modo | PATCH | `/conversations/:id/mode` | `{ mode: "AI" \| "HUMAN" }` |
| Atribuir atendedor | PATCH | `/conversations/:id/assign` | `{ userId: string \| null }` |
| Resolver | PATCH | `/conversations/:id/resolve` | — |
| Enviar mensagem | POST | `/conversations/:id/messages` | `{ content }` (máx. 4096 chars) |

### Configurações (ADMIN)
| Ação | Método | Endpoint | Body |
|------|--------|----------|------|
| Ler config do agente | GET | `/tenant/config` | — |
| Salvar config do agente | PUT | `/tenant/config` | `{ systemPrompt, tone?, escalateOnWords?, offHoursMessage?, workingHoursStart?, workingHoursEnd? }` |
| Listar filiais | GET | `/tenant/branches` | — |
| Criar filial | POST | `/tenant/branches` | `{ name, address?, isActive? }` |
| Remover filial | DELETE | `/tenant/branches/:id` | — |
| Listar canais | GET | `/tenant/channels` | — |
| Criar canal | POST | `/tenant/channels` | `{ branchId, type: "TELEGRAM"\|"WHATSAPP", identifier, displayName }` |
| Remover canal | DELETE | `/tenant/channels/:id` | — |
| Listar base de conhecimento | GET | `/tenant/knowledge` | — |
| Adicionar chunk | POST | `/tenant/knowledge` | `{ content, sourceUrl? }` |
| Remover chunk | DELETE | `/tenant/knowledge/:id` | — |
| Listar equipe | GET | `/tenant/team` | — |
| Adicionar membro | POST | `/tenant/team` | `{ email, password, role: "ADMIN"\|"AGENT", branchIds? }` |
| Remover membro | DELETE | `/tenant/team/:id` | — |

### Eventos em Tempo Real (WebSocket)
| Direção | Evento | Quando ocorre |
|---------|--------|---------------|
| Servidor → Cliente | `conversation:new` | Nova conversa criada por mensagem recebida |
| Servidor → Cliente | `conversation:message` | Nova mensagem em qualquer conversa do tenant |
| Servidor → Cliente | `conversation:updated` | Modo ou status de conversa alterado |
| Servidor → Cliente | `conversation:escalated` | IA escalou conversa para humano |
| Servidor → Cliente | `typing` | Outro participante está digitando |
| Cliente → Servidor | `conversation:join` | Ao abrir uma conversa no painel |
| Cliente → Servidor | `conversation:leave` | Ao fechar ou trocar de conversa |
| Cliente → Servidor | `typing` | Atendedor está digitando |

---

*Para arquitetura técnica do backend, ver `ARCHITECTURE_BACKEND.md`.*
