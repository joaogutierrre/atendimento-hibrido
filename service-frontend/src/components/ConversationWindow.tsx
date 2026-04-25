import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import { Bot, Send, User, Cpu, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { getConversation, patchMode, resolveConversation, sendMessage, patchAssign } from '../api/conversations'
import { getTeam } from '../api/tenant'
import { useConvStore } from '../store/conversations'
import { useAuthStore } from '../store/auth'
import { ModeBadge, ChannelBadge, StatusBadge, Avatar } from './Badge'
import { joinConversation, leaveConversation, emitTyping } from '../hooks/useSocket'
import type { Message, TeamMember } from '../types'

const MAX_CHARS = 4096

export default function ConversationWindow() {
  const { activeId, conversations, messages, setMessages, upsertConversation, typing: typingMap } = useConvStore()
  const user = useAuthStore((s) => s.user)
  const conv = conversations.find((c) => c.id === activeId) ?? null
  const msgs = activeId ? (messages[activeId] ?? []) : []
  const typing = activeId ? (typingMap[activeId] ?? false) : false

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevActive = useRef<string | null>(null)

  // Load conversation + join room
  useEffect(() => {
    if (!activeId) return
    if (prevActive.current && prevActive.current !== activeId) {
      leaveConversation(prevActive.current)
    }
    prevActive.current = activeId
    joinConversation(activeId)

    getConversation(activeId).then((data) => {
      setMessages(activeId, data.messages ?? [])
      upsertConversation(data)
    })
  }, [activeId])

  // Load team for admin assign dropdown
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      getTeam().then(setTeamMembers).catch(() => {})
    }
  }, [user?.role])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])


  async function handleSend() {
    if (!activeId || !text.trim() || sending) return
    setSending(true)
    try {
      await sendMessage(activeId, text.trim())
      setText('')
    } finally {
      setSending(false)
    }
  }

  async function handleModeToggle() {
    if (!conv || !activeId) return
    const next = conv.mode === 'AI' ? 'HUMAN' : 'AI'
    upsertConversation({ ...conv, mode: next })
    try {
      const updated = await patchMode(activeId, next)
      upsertConversation(updated)
    } catch {
      upsertConversation({ ...conv, mode: conv.mode })
    }
  }

  async function handleResolve() {
    if (!conv || !activeId) return
    try {
      const updated = await resolveConversation(activeId)
      upsertConversation(updated)
      toast.success('Conversa resolvida')
    } catch {}
  }

  async function handleAssign(userId: string) {
    if (!activeId) return
    try {
      const updated = await patchAssign(activeId, userId || null)
      upsertConversation(updated)
    } catch {}
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    emitTyping(activeId!)
  }

  if (!conv) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg">
        <p className="text-text-secondary text-sm">Selecione uma conversa</p>
      </div>
    )
  }

  const inputDisabled = conv.mode === 'AI'

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
        <Avatar name={conv.customerName ?? conv.customerRef} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-text-primary font-medium text-sm">
              {conv.customerName ?? conv.customerRef}
            </span>
            <ChannelBadge type={conv.channelType} />
            <ModeBadge mode={conv.mode} />
            <StatusBadge status={conv.status} />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {user?.role === 'ADMIN' && (
            <select
              className="bg-bg border border-border rounded-lg text-xs text-text-secondary px-2 py-1"
              value={conv.assignedUserId ?? ''}
              onChange={(e) => handleAssign(e.target.value)}
            >
              <option value="">Não atribuído</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.email}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleModeToggle}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              conv.mode === 'AI'
                ? 'bg-human/20 text-human hover:bg-human/30'
                : 'bg-ai/20 text-ai hover:bg-ai/30'
            }`}
          >
            {conv.mode === 'AI' ? 'Assumir' : 'Devolver para IA'}
          </button>

          {conv.status !== 'RESOLVED' && (
            <button
              onClick={handleResolve}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-border text-text-secondary hover:text-text-primary transition-colors"
            >
              Resolver
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {msgs.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {typing && (
          <p className="text-text-secondary text-xs italic">Digitando...</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-surface border-t border-border px-4 py-3">
        {inputDisabled && (
          <p className="text-text-secondary text-xs mb-2 flex items-center gap-1">
            <Bot size={12} className="text-ai" />
            IA está no controle — clique em &quot;Assumir&quot; para responder
          </p>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            disabled={inputDisabled || sending}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={inputDisabled ? 'IA no controle...' : 'Digite uma mensagem...'}
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-text-primary text-sm resize-none outline-none focus:border-ai transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={inputDisabled || !text.trim() || sending}
            className="bg-ai hover:bg-ai/90 disabled:opacity-40 text-white p-2 rounded-lg transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        {text.length > MAX_CHARS * 0.9 && (
          <p className="text-text-secondary text-[11px] mt-1 text-right">
            {text.length}/{MAX_CHARS}
          </p>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.sender === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <span className="text-text-secondary text-xs italic flex items-center gap-1">
          <Info size={11} />
          {msg.content}
        </span>
      </div>
    )
  }

  const isLeft = msg.sender === 'USER'
  const isAI = msg.sender === 'AI'

  return (
    <div className={`flex gap-2 ${isLeft ? 'justify-start' : 'justify-end'}`}>
      {isLeft && (
        <div className="w-6 h-6 rounded-full bg-border flex items-center justify-center shrink-0 mt-1">
          <User size={12} className="text-text-secondary" />
        </div>
      )}
      <div
        className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
          isLeft
            ? 'bg-surface text-text-primary rounded-tl-none'
            : isAI
            ? 'bg-ai/20 text-text-primary rounded-tr-none'
            : 'bg-ai text-white rounded-tr-none'
        }`}
      >
        {isAI && (
          <div className="flex items-center gap-1 mb-1">
            <Cpu size={11} className="text-ai" />
            <span className="text-[10px] text-ai font-medium">IA</span>
          </div>
        )}
        <p className="whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  )
}
