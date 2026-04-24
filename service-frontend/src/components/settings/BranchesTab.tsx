import { useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { getBranches, createBranch, deleteBranch } from '../../api/tenant'
import type { Branch } from '../../types'

export default function BranchesTab() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      setBranches(await getBranches())
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta filial?')) return
    await deleteBranch(id)
    setBranches((b) => b.filter((x) => x.id !== id))
    toast.success('Filial removida')
  }

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-text-primary font-medium">Filiais</h3>
        <button
          onClick={() => setShowModal(true)}
          className="bg-ai hover:bg-ai/90 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          <Plus size={14} /> Nova Filial
        </button>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary border-b border-border">
              <th className="text-left py-2 font-medium">Nome</th>
              <th className="text-left py-2 font-medium">Endereço</th>
              <th className="text-left py-2 font-medium">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} className="border-b border-border/50 hover:bg-surface/50">
                <td className="py-2 text-text-primary">{b.name}</td>
                <td className="py-2 text-text-secondary">{b.address ?? '—'}</td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      b.isActive ? 'bg-human/20 text-human' : 'bg-border text-text-secondary'
                    }`}
                  >
                    {b.isActive ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="text-text-secondary hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-text-secondary">
                  Nenhuma filial cadastrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showModal && (
        <BranchModal
          onClose={() => setShowModal(false)}
          onCreated={(b) => {
            setBranches((prev) => [...prev, b])
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}

function BranchModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (b: Branch) => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const b = await createBranch({ name, address: address || undefined })
      onCreated(b)
      toast.success('Filial criada')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Nova Filial" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Nome *">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Endereço">
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
        </Field>
        <ModalFooter saving={saving} onClose={onClose} />
      </form>
    </Modal>
  )
}

// Shared helpers
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md">
        <h3 className="text-text-primary font-medium mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-text-secondary text-sm">{label}</label>
      {children}
    </div>
  )
}

export function ModalFooter({
  saving,
  onClose,
}: {
  saving: boolean
  onClose: () => void
}) {
  return (
    <div className="flex justify-end gap-2 mt-2">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={saving}
        className="bg-ai hover:bg-ai/90 disabled:opacity-60 text-white text-sm px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2"
      >
        {saving && (
          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        Salvar
      </button>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 bg-surface rounded-lg" />
      ))}
    </div>
  )
}
