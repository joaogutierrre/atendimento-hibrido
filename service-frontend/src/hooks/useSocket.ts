import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/auth'
import { useConvStore } from '../store/conversations'
import type { Conversation, Message } from '../types'

let socket: Socket | null = null

export function getSocket() {
  return socket
}

export function useSocket() {
  const token = useAuthStore((s) => s.token)
  const { upsertConversation, appendMessage, incrementUnread, setTyping, activeId } =
    useConvStore()
  const activeIdRef = useRef(activeId)
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  activeIdRef.current = activeId

  useEffect(() => {
    if (!token) return

    socket = io('/', {
      auth: { token },
      path: '/socket.io',
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      console.log('[socket] connected', socket?.id)
    })

    socket.on('conversation:new', (conv: Conversation) => {
      upsertConversation(conv)
      toast(`Nova conversa de ${conv.customerName ?? conv.customerRef}`, { icon: '💬' })
    })

    socket.on('conversation:updated', (conv: Conversation) => {
      upsertConversation(conv)
    })

    socket.on('conversation:message', ({ conversationId, message }: { conversationId: string; message: Message }) => {
      appendMessage(conversationId, message)
      upsertConversation({ id: conversationId } as Conversation)
      if (activeIdRef.current !== conversationId) {
        incrementUnread(conversationId)
      }
    })

    socket.on('typing', (data: { conversationId: string }) => {
      setTyping(data.conversationId, true)
      if (typingTimers.current[data.conversationId]) {
        clearTimeout(typingTimers.current[data.conversationId])
      }
      typingTimers.current[data.conversationId] = setTimeout(() => {
        setTyping(data.conversationId, false)
      }, 3000)
    })

    socket.on('conversation:escalated', (data: { conversationId: string; reason: string }) => {
      toast(`Conversa escalada: ${data.reason}`, {
        icon: '⚠️',
        style: { background: '#f59e0b', color: '#000' },
        duration: 6000,
      })
    })

    return () => {
      socket?.disconnect()
      socket = null
    }
  }, [token])
}

export function joinConversation(conversationId: string) {
  socket?.emit('conversation:join', { conversationId })
}

export function leaveConversation(conversationId: string) {
  socket?.emit('conversation:leave', { conversationId })
}

export function emitTyping(conversationId: string) {
  socket?.emit('typing', { conversationId })
}
