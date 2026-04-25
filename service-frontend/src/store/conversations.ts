import { create } from 'zustand'
import type { Conversation, Message } from '../types'

interface ConvState {
  conversations: Conversation[]
  activeId: string | null
  messages: Record<string, Message[]>
  unread: Record<string, number>
  typing: Record<string, boolean>
  setConversations: (list: Conversation[]) => void
  upsertConversation: (conv: Conversation) => void
  setActive: (id: string | null) => void
  setMessages: (convId: string, msgs: Message[]) => void
  appendMessage: (convId: string, msg: Message) => void
  clearUnread: (convId: string) => void
  incrementUnread: (convId: string) => void
  setTyping: (convId: string, value: boolean) => void
}

export const useConvStore = create<ConvState>((set) => ({
  conversations: [],
  activeId: null,
  messages: {},
  unread: {},
  typing: {},

  setConversations: (list) =>
    set({ conversations: list.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)) }),

  upsertConversation: (conv) =>
    set((s) => {
      const exists = s.conversations.find((c) => c.id === conv.id)
      const updated = exists
        ? s.conversations.map((c) => (c.id === conv.id ? { ...c, ...conv } : c))
        : [conv, ...s.conversations]
      return { conversations: updated.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)) }
    }),

  setActive: (id) => set({ activeId: id }),

  setMessages: (convId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [convId]: msgs } })),

  appendMessage: (convId, msg) =>
    set((s) => ({
      messages: { ...s.messages, [convId]: [...(s.messages[convId] ?? []), msg] },
    })),

  clearUnread: (convId) =>
    set((s) => ({ unread: { ...s.unread, [convId]: 0 } })),

  incrementUnread: (convId) =>
    set((s) => ({ unread: { ...s.unread, [convId]: (s.unread[convId] ?? 0) + 1 } })),

  setTyping: (convId, value) =>
    set((s) => ({ typing: { ...s.typing, [convId]: value } })),
}))
