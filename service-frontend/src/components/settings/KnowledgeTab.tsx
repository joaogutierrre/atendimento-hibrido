import { useEffect, useState } from 'react'
import { Trash2, Plus, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { getKnowledge, createKnowledge, deleteKnowledge } from '../../api/tenant'
import { Modal, Field, ModalFooter } from './BranchesTab'
import type { KnowledgeChunk } from '../../types'

export default function KnowledgeTab() {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      setChunks(await getKnowledge())
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este chunk?')) return
    await deleteKnowledge(id)
    setChunks((c) => c.filter((x) => x.id !== id))
    toast.success('Chunk removido')
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-text-primary font-medium">Base de Conhecimento</h3>
        <button
          onClick={() => setShowModal(true)}
          className="bg-ai hover:bg-ai/90 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          <Plus size={14} /> Adicionar Texto
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-surface rounded-lg" />
          ))}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary border-b border-border">
              <th className="text-left py-2 font-medium">Conteúdo</th>
              <th className="text-left py-2 font-medium">Embedding</th>
              <th className="text-left py-2 font-medium">Data</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {chunks.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-surface/50">
                <td className="py-2 text-text-primary max-w-xs">
                  <span className="line-clamp-2">{c.content.slice(0, 120)}{c.content.length > 120 ? '…' : ''}</span>
                  {c.sourceUrl && (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ai text-xs hover:underline"
                    >
                      {c.sourceUrl}
                    </a>
                  )}
                </td>
                <td className="py-2">
                  {c.embeddingReady ? (
                    <span className="flex items-center gap-1 text-human text-xs">
                      <CheckCircle size={12} /> Pronto
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-alert text-xs">
                      <Clock size={12} /> Processando...
                    </span>
                  )}
                </td>
                <td className="py-2 text-text-secondary">{formatDate(c.createdAt)}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-text-secondary hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {chunks.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-text-secondary">
                  Nenhum conteúdo na base
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showModal && (
        <KnowledgeModal
          onClose={() => setShowModal(false)}
          onCreated={(c) => {
            setChunks((prev) => [...prev, c])
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}

function KnowledgeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (c: KnowledgeChunk) => void
}) {
  const [content, setContent] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const c = await createKnowledge({ content, sourceUrl: sourceUrl || undefined })
      onCreated(c)
      toast.success('Conteúdo adicionado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Adicionar Texto" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Conteúdo *">
          <textarea
            required
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input resize-y"
            placeholder="Escreva o conteúdo que o agente deve aprender..."
          />
        </Field>
        <Field label="URL da fonte (opcional)">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="input"
          />
        </Field>
        <ModalFooter saving={saving} onClose={onClose} />
      </form>
    </Modal>
  )
}
