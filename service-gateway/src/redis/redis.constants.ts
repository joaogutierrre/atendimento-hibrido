export const REDIS_PUBLISHER = Symbol('REDIS_PUBLISHER');

export const RedisChannels = {
  messagingIncoming: 'messaging:incoming',
  conversationUpdated: 'conversation:updated',
  agentRespond: 'agent:respond',
  agentEscalate: 'agent:escalate',
  knowledgeChunkCreated: 'knowledge:chunk-created',
} as const;

export type RedisChannel = (typeof RedisChannels)[keyof typeof RedisChannels];

// messaging:incoming is a Redis Stream (XADD / XREADGROUP)
export interface MessagingIncomingPayload {
  tenantId: string;
  channelType: 'TELEGRAM' | 'WHATSAPP';
  conversationId: string;
  messageId: string;
  customerRef: string;
  content: string;
  timestamp: string;
  mode: 'AI' | 'HUMAN';
}

export interface ConversationUpdatedPayload {
  conversationId: string;
  tenantId: string;
  mode: 'AI' | 'HUMAN';
  status: 'OPEN' | 'RESOLVED' | 'WAITING';
}
