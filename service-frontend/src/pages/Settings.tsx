import { useState } from 'react'
import { Bot, GitBranch, Radio, BookOpen, Users } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import AgentConfigTab from '../components/settings/AgentConfigTab'
import BranchesTab from '../components/settings/BranchesTab'
import ChannelsTab from '../components/settings/ChannelsTab'
import KnowledgeTab from '../components/settings/KnowledgeTab'
import TeamTab from '../components/settings/TeamTab'

const TABS = [
  { id: 'agent', label: 'Agente de IA', icon: Bot, component: AgentConfigTab },
  { id: 'branches', label: 'Filiais', icon: GitBranch, component: BranchesTab },
  { id: 'channels', label: 'Canais', icon: Radio, component: ChannelsTab },
  { id: 'knowledge', label: 'Base de Conhecimento', icon: BookOpen, component: KnowledgeTab },
  { id: 'team', label: 'Equipe', icon: Users, component: TeamTab },
]

export default function Settings() {
  useSocket()
  const [active, setActive] = useState('agent')
  const Tab = TABS.find((t) => t.id === active)?.component ?? AgentConfigTab

  return (
    <div className="flex h-full overflow-hidden bg-bg">
      {/* Sidebar tabs */}
      <div className="w-56 shrink-0 bg-surface border-r border-border flex flex-col pt-4">
        <p className="text-text-secondary text-xs uppercase tracking-widest px-4 mb-3">
          Configurações
        </p>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
              active === id
                ? 'bg-ai/10 text-ai border-r-2 border-ai'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <Tab />
      </div>
    </div>
  )
}
