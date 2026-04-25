import { useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { getTeam, createTeamMember, deleteTeamMember, getBranches } from '../../api/tenant'
import { Modal, Field, ModalFooter } from './BranchesTab'
import type { Branch, TeamMember } from '../../types'

export default function TeamTab() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      setMembers(await getTeam())
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este membro?')) return
    await deleteTeamMember(id)
    setMembers((m) => m.filter((x) => x.id !== id))
    toast.success('Membro removido')
  }

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-text-primary font-medium">Equipe</h3>
        <button
          onClick={() => setShowModal(true)}
          className="bg-ai hover:bg-ai/90 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          <Plus size={14} /> Adicionar Membro
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-surface rounded-lg" />
          ))}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary border-b border-border">
              <th className="text-left py-2 font-medium">E-mail</th>
              <th className="text-left py-2 font-medium">Cargo</th>
              <th className="text-left py-2 font-medium">Filiais</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border/50 hover:bg-surface/50">
                <td className="py-2 text-text-primary">{m.email}</td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.role === 'ADMIN' ? 'bg-ai/20 text-ai' : 'bg-border text-text-secondary'
                    }`}
                  >
                    {m.role}
                  </span>
                </td>
                <td className="py-2 text-text-secondary">
                  {m.branches.map((b) => b.name).join(', ') || '—'}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-text-secondary hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-text-secondary">
                  Nenhum membro na equipe
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showModal && (
        <TeamMemberModal
          onClose={() => setShowModal(false)}
          onCreated={(m) => {
            setMembers((prev) => [...prev, m])
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}

function TeamMemberModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (m: TeamMember) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'AGENT'>('AGENT')
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getBranches().then(setBranches).catch(() => {})
  }, [])

  function toggleBranch(id: string) {
    setSelectedBranches((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const m = await createTeamMember({
        email,
        password,
        role,
        branchIds: selectedBranches.length ? selectedBranches : undefined,
      })
      onCreated(m)
      toast.success('Membro adicionado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Adicionar Membro" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="E-mail *">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Senha *">
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Cargo">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'ADMIN' | 'AGENT')}
            className="input"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="AGENT">AGENT</option>
          </select>
        </Field>
        {branches.length > 0 && (
          <Field label="Filiais (opcional)">
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBranch(b.id)}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    selectedBranches.includes(b.id)
                      ? 'bg-ai/30 text-ai'
                      : 'bg-bg text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </Field>
        )}
        <ModalFooter saving={saving} onClose={onClose} />
      </form>
    </Modal>
  )
}
