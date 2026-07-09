import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api } from '../api'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // "set password" flow for Apple-only accounts
  const [setupMode, setSetupMode] = useState(false)
  const [setupEmail, setSetupEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [setupDone, setSetupDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/admin/setup-password/', {
        email: setupEmail,
        new_password: newPassword,
      })
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      const me = await api.get('/api/auth/me/').then((r) => r.data)
      localStorage.setItem('admin_user', JSON.stringify(me))
      setSetupDone(true)
      setTimeout(() => window.location.href = '/', 1500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string | string[] } } })
        ?.response?.data?.detail
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Fehler beim Einrichten'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-violet-600">hostly admin</h1>
          <p className="text-sm text-gray-500 mt-1">
            {setupMode ? 'Passwort für Apple-Account einrichten' : 'Melde dich mit deinem Superuser-Konto an'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>
          )}
          {setupDone && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">
              Passwort gesetzt! Weiterleitung…
            </div>
          )}

          {!setupMode ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Anmelden…' : 'Anmelden'}
              </button>
              <button
                type="button"
                onClick={() => { setSetupMode(true); setError('') }}
                className="w-full text-xs text-gray-400 hover:text-violet-600 transition-colors pt-1"
              >
                Apple-Account ohne Passwort? Hier einrichten →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSetupPassword} className="space-y-4">
              <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Einmalig: Passwort für deinen Superuser-Apple-Account setzen. Nur möglich wenn noch kein Passwort existiert.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deine E-Mail (Superuser)</label>
                <input
                  type="email"
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || setupDone}
                className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Wird gesetzt…' : 'Passwort einrichten & anmelden'}
              </button>
              <button
                type="button"
                onClick={() => { setSetupMode(false); setError('') }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Zurück zum Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
