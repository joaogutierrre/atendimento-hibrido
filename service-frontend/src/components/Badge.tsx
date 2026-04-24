import type { ConversationMode, ConversationStatus, ChannelType } from '../types'
import { Send } from 'lucide-react'

export function ModeBadge({ mode }: { mode: ConversationMode }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        mode === 'AI' ? 'bg-ai/20 text-ai' : 'bg-human/20 text-human'
      }`}
    >
      {mode === 'AI' ? '🤖 IA' : '👤 Humano'}
    </span>
  )
}

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const map: Record<ConversationStatus, { label: string; cls: string }> = {
    OPEN: { label: 'Aberta', cls: 'bg-human/20 text-human' },
    WAITING: { label: 'Aguardando', cls: 'bg-alert/20 text-alert' },
    RESOLVED: { label: 'Resolvida', cls: 'bg-border text-text-secondary' },
  }
  const { label, cls } = map[status]
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
}

export function ChannelBadge({ type }: { type: ChannelType }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
        type === 'TELEGRAM' ? 'bg-telegram/20 text-telegram' : 'bg-whatsapp/20 text-whatsapp'
      }`}
    >
      <Send size={10} />
      {type === 'TELEGRAM' ? 'Telegram' : 'WhatsApp'}
    </span>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  const cls = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={`${cls} rounded-full bg-ai/30 text-ai font-semibold flex items-center justify-center shrink-0`}>
      {initials || '?'}
    </div>
  )
}
