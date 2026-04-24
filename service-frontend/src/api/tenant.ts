import api from './client'
import type { AgentConfig, Branch, Channel, KnowledgeChunk, TeamMember } from '../types'

// Agent config
export async function getAgentConfig() {
  const { data } = await api.get<AgentConfig>('/tenant/config')
  return data
}
export async function saveAgentConfig(body: Partial<AgentConfig>) {
  const { data } = await api.put<AgentConfig>('/tenant/config', body)
  return data
}

// Branches
export async function getBranches() {
  const { data } = await api.get<Branch[]>('/tenant/branches')
  return data
}
export async function createBranch(body: { name: string; address?: string; isActive?: boolean }) {
  const { data } = await api.post<Branch>('/tenant/branches', body)
  return data
}
export async function deleteBranch(id: string) {
  await api.delete(`/tenant/branches/${id}`)
}

// Channels
export async function getChannels() {
  const { data } = await api.get<Channel[]>('/tenant/channels')
  return data
}
export async function createChannel(body: {
  branchId: string
  type: 'TELEGRAM' | 'WHATSAPP'
  identifier: string
  displayName?: string
}) {
  const { data } = await api.post<Channel>('/tenant/channels', body)
  return data
}
export async function deleteChannel(id: string) {
  await api.delete(`/tenant/channels/${id}`)
}

// Knowledge
export async function getKnowledge() {
  const { data } = await api.get<KnowledgeChunk[]>('/tenant/knowledge')
  return data
}
export async function createKnowledge(body: { content: string; sourceUrl?: string }) {
  const { data } = await api.post<KnowledgeChunk>('/tenant/knowledge', body)
  return data
}
export async function deleteKnowledge(id: string) {
  await api.delete(`/tenant/knowledge/${id}`)
}

// Team
export async function getTeam() {
  const { data } = await api.get<TeamMember[]>('/tenant/team')
  return data
}
export async function createTeamMember(body: {
  email: string
  password: string
  role: 'ADMIN' | 'AGENT'
  branchIds?: string[]
}) {
  const { data } = await api.post<TeamMember>('/tenant/team', body)
  return data
}
export async function deleteTeamMember(id: string) {
  await api.delete(`/tenant/team/${id}`)
}
