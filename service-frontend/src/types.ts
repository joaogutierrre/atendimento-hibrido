export type Role = 'ADMIN' | 'AGENT'
export type ConversationMode = 'AI' | 'HUMAN'
export type ConversationStatus = 'OPEN' | 'WAITING' | 'RESOLVED'
export type ChannelType = 'TELEGRAM' | 'WHATSAPP'
export type MessageSender = 'USER' | 'AGENT' | 'AI' | 'SYSTEM'

export interface AuthUser {
  userId: string
  email: string
  role: Role
  tenantId: string
}

export interface Message {
  id: string
  conversationId: string
  sender: MessageSender
  content: string
  createdAt: string
}

export interface Conversation {
  id: string
  tenantId: string
  channelType: ChannelType
  channelId: string
  channelDisplayName?: string
  customerRef: string
  customerName?: string
  mode: ConversationMode
  status: ConversationStatus
  assignedUserId: string | null
  assignedUserEmail?: string
  branchId?: string
  branchName?: string
  lastMessage?: string
  lastMessageAt?: string
  unreadCount?: number
  createdAt: string
  updatedAt: string
  messages?: Message[]
}

export interface Branch {
  id: string
  name: string
  address?: string
  isActive: boolean
}

export interface Channel {
  id: string
  branchId: string
  branchName?: string
  type: ChannelType
  identifier: string
  displayName?: string
  isActive: boolean
}

export interface KnowledgeChunk {
  id: string
  content: string
  sourceUrl?: string
  embeddingReady: boolean
  createdAt: string
}

export interface TeamMember {
  id: string
  email: string
  role: Role
  branches: Branch[]
}

export interface AgentConfig {
  systemPrompt: string
  tone: string
  escalateOnWords: string[]
  offHoursMessage: string | null
  workingHoursStart: number
  workingHoursEnd: number
  minEmbeddingScore: number
}
