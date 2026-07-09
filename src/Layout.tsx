import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import {
  LayoutDashboard, Users, CalendarDays, AlertTriangle,
  Tag, Sparkles, Lightbulb, LogOut, ShieldCheck,
} from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Nutzer', icon: Users },
  { to: '/verification', label: 'Verifizierung', icon: ShieldCheck },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/reports', label: 'Meldungen', icon: AlertTriangle },
  { to: '/ideas', label: 'Ideen', icon: Lightbulb },
  { to: '/categories', label: 'Kategorien', icon: Tag },
  { to: '/interests', label: 'Interessen', icon: Sparkles },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => { signOut(); navigate('/login') }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-200">
          <span className="text-lg font-bold text-violet-600 tracking-tight">hostly admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-400 mb-2 truncate">{user?.email}</p>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 w-full"
          >
            <LogOut size={14} /> Abmelden
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
