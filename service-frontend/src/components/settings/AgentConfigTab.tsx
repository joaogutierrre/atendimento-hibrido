import { useEffect, useState, FormEvent } from 'react'
import { X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAgentConfig, saveAgentConfig } from '../../api/tenant'
import type { AgentConfig } from '../../types'

const TONE_OPTIONS = ['professional', 'casual', 'technical', 'friendly']
const TONE_LABELS: Record<string, string> = {
  professional: 'Profissional',
  casual: 'Casual',
  technical: 'Técnico',
  friendly: 'Amigável',
}

export default function AgentConfigTab() {
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newWord, setNewWord] = useState('')

  useEffect(() => {
    getAgentConfig()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!config) return
    setSaving(true)
    try {
      const updated = await saveAgentConfig(config)
      setConfig(updated)
      toast.success('Configuração salva')
    } finally {
      setSaving(false)
    }
  }

  function addWord() {
    const w = newWord.trim()
    if (!w || !config) return
    if (!config.escalateOnWords.includes(w)) {
      setConfig({ ...config, escalateOnWords: [...config.escalateOnWords, w] })
    }
    setNewWord('')
  }

  function removeWord(w: string) {
    if (!config) return
    setConfig({ ...config, escalateOnWords: config.escalateOnWords.filter((x) => x !== w) })
  }

  if (loading) return <Skeleton />

  if (!config) return <p className="text-text-secondary text-sm">Erro ao carregar configuração.</p>

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5 max-w-xl">
      <div className="flex flex-col gap-1">
        <label className="text-text-secondary text-sm">System Prompt</label>
        <textarea
          rows={5}
          value={config.systemPrompt}
          onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-text-primary text-sm resize-y outline-none focus:border-ai transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-text-secondary text-sm">Tom de voz</label>
        <select
          value={config.tone}
          onChange={(e) => setConfig({ ...config, tone: e.target.value })}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-text-primary text-sm outline-none focus:border-ai"
        >
          {TONE_OPTIONS.map((t) => (
            <option key={t} value={t}>{TONE_LABELS[t] ?? t}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-text-secondary text-sm">Palavras-gatilho de escalação</label>
        <div className="flex flex-wrap gap-2">
          {config.escalateOnWords.map((w) => (
            <span
              key={w}
              className="bg-alert/20 text-alert text-xs px-2 py-1 rounded-full flex items-center gap-1"
            >
              {w}
              <button type="button" onClick={() => removeWord(w)}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addWord())}
            placeholder="adicionar palavra..."
            className="bg-bg border border-border rounded-lg px-3 py-1.5 text-text-primary text-sm outline-none focus:border-ai flex-1"
          />
          <button
            type="button"
            onClick={addWord}
            className="bg-border hover:bg-border/70 text-text-primary px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-text-secondary text-sm">Início atendimento (h)</label>
          <input
            type="number"
            min={0}
            max={23}
            value={config.workingHoursStart}
            onChange={(e) => setConfig({ ...config, workingHoursStart: Number(e.target.value) })}
            className="bg-bg border border-border rounded-lg px-3 py-2 text-text-primary text-sm outline-none focus:border-ai"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-text-secondary text-sm">Fim atendimento (h)</label>
          <input
            type="number"
            min={0}
            max={24}
            value={config.workingHoursEnd}
            onChange={(e) => setConfig({ ...config, workingHoursEnd: Number(e.target.value) })}
            className="bg-bg border border-border rounded-lg px-3 py-2 text-text-primary text-sm outline-none focus:border-ai"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-text-secondary text-sm">Mensagem fora do horário</label>
        <textarea
          rows={2}
          value={config.offHoursMessage ?? ''}
          onChange={(e) => setConfig({ ...config, offHoursMessage: e.target.value || null })}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-text-primary text-sm resize-none outline-none focus:border-ai transition-colors"
          placeholder="Ex.: Nosso atendimento funciona das 8h às 18h."
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-ai hover:bg-ai/90 disabled:opacity-60 text-white font-medium rounded-lg py-2 transition-colors self-start px-6 flex items-center gap-2"
      >
        {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        Salvar
      </button>
    </form>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 max-w-xl animate-pulse">
      {[100, 80, 60, 40, 40].map((w, i) => (
        <div key={i} className={`h-10 bg-surface rounded-lg`} style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}
