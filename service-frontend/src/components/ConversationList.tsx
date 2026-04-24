import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { listConversations } from '../api/conversations'
import { useConvStore } from '../store/conversations'
import { Avatar, ModeBadge, ChannelBadge } from './Badge'
import type { ConversationStatus, ConversationMode, ChannelType } from '../types'

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'Todas', value: '' },
  { label: 'Abertas', value: 'OPEN' },
  { label: 'Aguardando', value: 'WAITING' },
  { label: 'Resolvidas', value: 'RESOLVED' },
]

export default function ConversationList() {
  const { conversations, activeId, setConversations, setActive, clearUnread, unread } =
    useConvStore()
  const [status, setStatus] = useState<string>('OPEN')
  const [modeFilter, setModeFilter] = useState<string>('')
  const [channelFilter, setChannelFilter] = useState<string>('')
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const TAKE = 20

  const load = useCallback(
    async (reset = false) => {
      setLoading(true)
      try {
        const newSkip = reset ? 0 : skip
        const params = {
          ...(status ? { status } : {}),
          ...(modeFilter ? { mode: modeFilter } : {}),
          take: TAKE,
          skip: newSkip,
        }
        const data = await listConversations(params)
        if (reset) {
          setConversations(data)
        } else {
          setConversations([...conversations, ...data])
        }
        setHasMore(data.length === TAKE)
        setSkip(newSkip + data.length)
      } finally {
        setLoading(false)
      }
    },
    [status, modeFilter, skip, conversations]
  )

  useEffect(() => {
    setSkip(0)
    load(true)
  }, [status, modeFilter])

  const filtered = conversations.filter((c) => {
    if (channelFilter && c.channelType !== channelFilter) return false
    return true
  })

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  return (
    <div className="w-[260px] shrink-0 bg-surface border-r border-border flex flex-col h-full overflow-hidden">
      {/* Filters */}
      <div className="p-3 border-b border-border flex flex-col gap-2">
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setStatus(o.value)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                status === o.value
                  ? 'bg-ai text-white'
                  : 'bg-bg text-text-secondary hover:text-text-primary'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={() => setModeFilter(modeFilter === 'AI' ? '' : 'AI')}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              modeFilter === 'AI' ? 'bg-ai/30 text-ai' : 'bg-bg text-text-secondary hover:text-text-primary'
            }`}
          >
            🤖 IA
          </button>
          <button
            onClick={() => setModeFilter(modeFilter === 'HUMAN' ? '' : 'HUMAN')}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              modeFilter === 'HUMAN' ? 'bg-human/30 text-human' : 'bg-bg text-text-secondary hover:text-text-primary'
            }`}
          >
            👤 Humano
          </button>
          <button
            onClick={() => setChannelFilter(channelFilter === 'TELEGRAM' ? '' : 'TELEGRAM')}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              channelFilter === 'TELEGRAM' ? 'bg-telegram/30 text-telegram' : 'bg-bg text-text-secondary'
            }`}
          >
            TG
          </button>
          <button
            onClick={() => setChannelFilter(channelFilter === 'WHATSAPP' ? '' : 'WHATSAPP')}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              channelFilter === 'WHATSAPP' ? 'bg-whatsapp/30 text-whatsapp' : 'bg-bg text-text-secondary'
            }`}
          >
            WA
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((conv) => {
          const isActive = conv.id === activeId
          const badge = unread[conv.id] ?? 0
          return (
            <button
              key={conv.id}
              onClick={() => {
                setActive(conv.id)
                clearUnread(conv.id)
              }}
              className={`w-full text-left px-3 py-3 border-b border-border/50 flex gap-3 items-start transition-colors ${
                isActive ? 'bg-ai/10' : 'hover:bg-bg/50'
              }`}
            >
              <div className="relative">
                <Avatar name={conv.customerName ?? conv.customerRef} size="sm" />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-text-primary text-sm font-medium truncate">
                    {conv.customerName ?? conv.customerRef}
                  </span>
                  <span className="text-text-secondary text-[11px] shrink-0">
                    {relativeTime(conv.updatedAt)}
                  </span>
                </div>
                <p className="text-text-secondary text-xs truncate mt-0.5">
                  {conv.lastMessage ?? '—'}
                </p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <ModeBadge mode={conv.mode} />
                  <ChannelBadge type={conv.channelType} />
                </div>
              </div>
            </button>
          )
        })}

        {hasMore && (
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="w-full py-3 text-text-secondary text-sm hover:text-text-primary flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-text-secondary/30 border-t-text-secondary rounded-full animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Carregar mais
          </button>
        )}

        {filtered.length === 0 && !loading && (
          <p className="text-text-secondary text-sm text-center py-8">Nenhuma conversa</p>
        )}
      </div>
    </div>
  )
}
