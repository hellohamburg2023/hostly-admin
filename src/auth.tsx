import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { login as apiLogin } from './api'

interface AuthUser { id: number; email: string; is_staff: boolean; is_superuser: boolean }
interface AuthCtx { user: AuthUser | null; loading: boolean; signIn: (e: string, p: string) => Promise<void>; signOut: () => void }

const Ctx = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('admin_user')
    if (stored) setUser(JSON.parse(stored))
    setLoading(false)
  }, [])

  const signIn = async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    if (!data.user?.is_staff && !data.user?.is_superuser) {
      throw new Error('Keine Admin-Berechtigung')
    }
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    localStorage.setItem('admin_user', JSON.stringify(data.user))
    setUser(data.user)
  }

  const signOut = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('admin_user')
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
