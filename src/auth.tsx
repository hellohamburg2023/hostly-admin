import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { login as apiLogin, api } from './api'

interface AuthUser { id: number; email: string; is_staff: boolean; is_superuser: boolean }
interface AuthCtx { user: AuthUser | null; loading: boolean; signIn: (e: string, p: string) => Promise<void>; signInWithTokens: (access: string, refresh: string) => Promise<void>; signOut: () => void }

const Ctx = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('admin_user')
    if (stored) setUser(JSON.parse(stored))
    setLoading(false)
  }, [])

  const _loadAdminUser = async () => {
    const me = await api.get('/api/admin/me/').then((r) => r.data)
    localStorage.setItem('admin_user', JSON.stringify(me))
    setUser(me)
  }

  const signIn = async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    await _loadAdminUser()
  }

  const signInWithTokens = async (access: string, refresh: string) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    await _loadAdminUser()
  }

  const signOut = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('admin_user')
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, signIn, signInWithTokens, signOut }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
