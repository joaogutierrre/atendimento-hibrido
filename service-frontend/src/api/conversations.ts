import api from './client'
import type { Conversation, Message } from '../types'

export interface ListParams {
  status?: string
  mode?: string
  branchId?: string
  take?: number
  skip?: number
}

export async function listConversations(params: ListParams = {}) {
  const { data } = await api.get<Conversation[]>('/conversations', { params })
  return data
}

export async function getConversation(id: string) {
  const { data } = await api.get<Conversation & { messages: Message[] }>(`/conversations/${id}`)
  return data
}

export async function patchMode(id: string, mode: 'AI' | 'HUMAN') {
  const { data } = await api.patch<Conversation>(`/conversations/${id}/mode`, { mode })
  return data
}

export async function patchAssign(id: string, userId: string | null) {
  const { data } = await api.patch<Conversation>(`/conversations/${id}/assign`, { userId })
  return data
}

export async function resolveConversation(id: string) {
  const { data } = await api.patch<Conversation>(`/conversations/${id}/resolve`)
  return data
}

export async function sendMessage(id: string, content: string) {
  const { data } = await api.post<Message>(`/conversations/${id}/messages`, { content })
  return data
}
