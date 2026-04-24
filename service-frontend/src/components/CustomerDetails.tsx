import { useConvStore } from '../store/conversations'
import { StatusBadge, ChannelBadge } from './Badge'

export default function CustomerDetails() {
  const { activeId, conversations } = useConvStore()
  const conv = conversations.find((c) => c.id === activeId) ?? null

  if (!conv) {
    return (
      <div className="w-[280px] shrink-0 bg-surface border-l border-border flex items-center justify-center">
        <p className="text-text-secondary text-sm px-4 text-center">
          Selecione uma conversa para ver os detalhes
        </p>
      </div>
    )
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: 'Nome',
      value: (
        <span className="text-text-primary text-sm">{conv.customerName ?? conv.customerRef}</span>
      ),
    },
    {
      label: 'Canal',
      value: (
        <div className="flex items-center gap-2">
          <ChannelBadge type={conv.channelType} />
          {conv.channelDisplayName && (
            <span className="text-text-secondary text-xs">{conv.channelDisplayName}</span>
          )}
        </div>
      ),
    },
    {
      label: 'Referência',
      value: <span className="text-text-secondary text-sm font-mono">{conv.customerRef}</span>,
    },
    {
      label: 'Filial',
      value: (
        <span className="text-text-secondary text-sm">
          {conv.branchName ?? '—'}
        </span>
      ),
    },
    {
      label: 'Atendedor',
      value: (
        <span className="text-text-secondary text-sm">
          {conv.assignedUserEmail ?? 'Não atribuído'}
        </span>
      ),
    },
    {
      label: 'Status',
      value: <StatusBadge status={conv.status} />,
    },
    {
      label: 'Criado em',
      value: (
        <span className="text-text-secondary text-sm">{formatDate(conv.createdAt)}</span>
      ),
    },
  ]

  return (
    <div className="w-[280px] shrink-0 bg-surface border-l border-border overflow-y-auto">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-text-primary font-medium text-sm">Detalhes</h2>
      </div>
      <div className="px-4 py-3 flex flex-col gap-4">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-text-secondary text-xs uppercase tracking-wide">{label}</span>
            {value}
          </div>
        ))}
      </div>
    </div>
  )
}
