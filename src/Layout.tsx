import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { BrandLogo } from './BrandLogo'
import {
  LayoutDashboard, Users, CalendarDays, AlertTriangle,
  Tag, Sparkles, Lightbulb, LogOut, ShieldCheck,
  Footprints, Activity, ClipboardList,
  ChartNoAxesCombined, Menu, X,
} from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Nutzer', icon: Users },
  { to: '/verification', label: 'Verifizierung', icon: ShieldCheck },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/reports', label: 'Meldungen', icon: AlertTriangle },
  { to: '/safe-walks', label: 'Safety Operations', icon: Footprints },
  { to: '/product-analytics', label: 'Produkt-Analytics', icon: ChartNoAxesCombined },
  { to: '/health', label: 'Betrieb', icon: Activity },
  { to: '/audit', label: 'Audit', icon: ClipboardList },
  { to: '/ideas', label: 'Event-Ideen', icon: Lightbulb },
  { to: '/categories', label: 'Kategorien', icon: Tag },
  { to: '/interests', label: 'Interessen', icon: Sparkles },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  const handleSignOut = () => { signOut(); navigate('/login') }

  return (
    <div className="flex h-dvh min-h-0 bg-gray-50">
      <button
        type="button"
        aria-label="Navigation schließen"
        className={`fixed inset-0 z-40 bg-gray-950/40 transition-opacity md:hidden ${menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside
        id="admin-navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-200 ease-out md:static md:w-56 md:translate-x-0 md:shadow-none ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex min-h-16 items-center justify-between border-b border-gray-200 px-5 py-3 md:min-h-0 md:py-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <span className="text-lg font-bold text-violet-600 tracking-tight">hostly admin</span>
          </div>
          <button
            type="button"
            aria-label="Navigation schließen"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 md:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMenuOpen(false)}
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 shrink-0 items-center border-b border-gray-200 bg-white px-4 md:hidden">
          <button
            type="button"
            aria-label="Navigation öffnen"
            aria-controls="admin-navigation"
            aria-expanded={menuOpen}
            className="mr-3 inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandLogo size="sm" />
            <span className="truncate text-base font-bold tracking-tight text-violet-600">hostly admin</span>
          </div>
        </header>

        {/* Main */}
        <main className="admin-content min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
