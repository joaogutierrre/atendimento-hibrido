import { useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { getChannels, createChannel, deleteChannel, getBranches } from '../../api/tenant'
import { ChannelBadge } from '../Badge'
import { Modal, Field, ModalFooter } from './BranchesTab'
import type { Branch, Channel } from '../../types'

export default function ChannelsTab() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    Promise.all([getChannels(), getBranches()])
      .then(([ch, br]) => {
        setChannels(ch)
        setBranches(br)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Remover este canal?')) return
    await deleteChannel(id)
    setChannels((c) => c.filter((x) => x.id !== id))
    toast.success('Canal removido')
  }

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-text-primary font-medium">Canais</h3>
        <button
          onClick={() => setShowModal(true)}
          className="bg-ai hover:bg-ai/90 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          <Plus size={14} /> Adicionar Canal
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-surface rounded-lg" />
          ))}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary border-b border-border">
              <th className="text-left py-2 font-medium">Tipo</th>
              <th className="text-left py-2 font-medium">Nome</th>
              <th className="text-left py-2 font-medium">Filial</th>
              <th className="text-left py-2 font-medium">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.id} className="border-b border-border/50 hover:bg-surface/50">
                <td className="py-2">
                  <ChannelBadge type={ch.type} />
                </td>
                <td className="py-2 text-text-primary">{ch.displayName ?? ch.identifier}</td>
                <td className="py-2 text-text-secondary">{ch.branchName ?? '—'}</td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      ch.isActive ? 'bg-human/20 text-human' : 'bg-border text-text-secondary'
                    }`}
                  >
                    {ch.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDelete(ch.id)}
                    className="text-text-secondary hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {channels.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-text-secondary">
                  Nenhum canal configurado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showModal && (
        <ChannelModal
          branches={branches}
          onClose={() => setShowModal(false)}
          onCreated={(ch) => {
            setChannels((prev) => [...prev, ch])
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}

function ChannelModal({
  branches,
  onClose,
  onCreated,
}: {
  branches: Branch[]
  onClose: () => void
  onCreated: (ch: Channel) => void
}) {
  const [type, setType] = useState<'TELEGRAM' | 'WHATSAPP'>('TELEGRAM')
  const [branchId, setBranchId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const ch = await createChannel({ branchId, type, identifier, displayName: displayName || undefined })
      onCreated(ch)
      toast.success('Canal criado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Adicionar Canal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Tipo">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'TELEGRAM' | 'WHATSAPP')}
            className="input"
          >
            <option value="TELEGRAM">Telegram</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </Field>

        <Field label="Nome do canal">
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={type === 'TELEGRAM' ? 'Suporte Telegram' : 'WhatsApp Comercial'}
            className="input"
          />
        </Field>

        <Field label="Filial">
          <select
            required
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="input"
          >
            <option value="">Selecione...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>

        <Field label={type === 'TELEGRAM' ? 'Bot Token' : 'Phone Number ID'}>
          <input
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={type === 'TELEGRAM' ? '123456:ABC...' : '1234567890'}
            className="input"
          />
        </Field>

        {type === 'TELEGRAM' && (
          <p className="text-text-secondary text-xs">
            O backend registra o webhook automaticamente ao criar o canal.
          </p>
        )}

        <ModalFooter saving={saving} onClose={onClose} />
      </form>
    </Modal>
  )
}
