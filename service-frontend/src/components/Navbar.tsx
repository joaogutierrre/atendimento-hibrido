import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MessageSquare, Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/auth'

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-surface border-b border-border px-4 h-12 flex items-center gap-4 shrink-0">
      <div className="flex items-center gap-1.5 mr-4">
        <MessageSquare size={18} className="text-ai" />
        <span className="text-text-primary font-semibold text-sm">Atendimento</span>
      </div>

      <Link
        to="/conversations"
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
          pathname === '/conversations'
            ? 'bg-ai/10 text-ai'
            : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        <MessageSquare size={14} />
        Conversas
      </Link>

      {user?.role === 'ADMIN' && (
        <Link
          to="/settings"
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
            pathname === '/settings'
              ? 'bg-ai/10 text-ai'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Settings size={14} />
          Configurações
        </Link>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span className="text-text-secondary text-xs">{user?.email}</span>
        <button
          onClick={handleLogout}
          className="text-text-secondary hover:text-red-400 transition-colors"
          title="Sair"
        >
          <LogOut size={15} />
        </button>
      </div>
    </nav>
  )
}
