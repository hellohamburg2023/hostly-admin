import { useState, useEffect, type ReactNode } from 'react'
import { login as apiLogin, loginWithApple as apiLoginWithApple, api, clearAuthStorage } from './api'
import { AuthContext, type AuthUser } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const hasTokens = localStorage.getItem('access_token') || localStorage.getItem('refresh_token')
      if (!hasTokens) {
        clearAuthStorage()
        if (!cancelled) setLoading(false)
        return
      }

      try {
        await loadAdminUser()
      } catch {
        clearAuthStorage()
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    restoreSession()
    return () => { cancelled = true }
  }, [])

  const loadAdminUser = async () => {
    const me = await api.get('/api/admin/me/').then((r) => r.data)
    if (!me.is_superuser) throw new Error('Nur Superuser duerfen auf die Admin-Webseite zugreifen.')
    localStorage.setItem('admin_user', JSON.stringify(me))
    setUser(me)
  }

  const signIn = async (email: string, password: string) => {
    try {
      const data = await apiLogin(email.trim(), password)
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      await loadAdminUser()
    } catch (error) {
      clearAuthStorage()
      setUser(null)
      throw error
    }
  }

  const signInWithApple = async (identityToken: string, state: string, fullName?: string) => {
    try {
      const data = await apiLoginWithApple(identityToken, state, fullName)
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      await loadAdminUser()
    } catch (error) {
      clearAuthStorage()
      setUser(null)
      throw error
    }
  }

  const signOut = () => {
    clearAuthStorage()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signInWithApple, signOut }}>{children}</AuthContext.Provider>
}
