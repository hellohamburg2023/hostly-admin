import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api } from '../api'
import { appleAvailable, redirectToAppleLogin, consumeAppleTokensFromUrl } from '../appleAuth'

export default function Login() {
  const { signIn, signInWithTokens } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [setupMode, setSetupMode] = useState(false)
  const [setupEmail, setSetupEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [setupDone, setSetupDone] = useState(false)

  // Pick up Apple tokens from URL after backend redirect
  useEffect(() => {
    const tokens = consumeAppleTokensFromUrl()
    if (!tokens) return
    setLoading(true)
    signInWithTokens(tokens.access, tokens.refresh)
      .then(() => navigate('/'))
      .catch(() => setError('Apple Login fehlgeschlagen – kein Admin-Konto?'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      await signInWithTokens(data.access, data.refresh)
      setSetupDone(true)
      setTimeout(() => navigate('/'), 1000)
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
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">Passwort gesetzt! Weiterleitung…</div>
          )}

          {!setupMode ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                {loading ? 'Anmelden…' : 'Anmelden'}
              </button>

              {appleAvailable && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">oder</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <button type="button" onClick={redirectToAppleLogin} disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 bg-black hover:bg-gray-900 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                    <svg viewBox="0 0 814 1000" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.3-142.9-90.2C35.1 776.3 0 702.3 0 631.4c0-145.6 102.1-216.6 201-216.6 55.2 0 101.6 37.4 136 37.4 32.6 0 84.2-39.5 148.4-39.5 24.1 0 108.2 2.6 168.2 94.9zm-319.4-201c30.7-36.2 52.4-86.1 52.4-136 0-6.9-.6-13.9-1.9-19.5-49.7 1.9-108.8 33.2-142.9 75.5-27.5 32.6-52.4 82.5-52.4 133.1 0 7.5 1.3 15 1.9 17.5 3.2.6 8.4 1.3 13.6 1.3 44.8 0 100.5-29.4 129.3-71.9z"/>
                    </svg>
                    Mit Apple anmelden
                  </button>
                </>
              )}

              <button type="button" onClick={() => { setSetupMode(true); setError('') }}
                className="w-full text-xs text-gray-400 hover:text-violet-600 transition-colors pt-1">
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
                <input type="email" value={setupEmail} onChange={(e) => setSetupEmail(e.target.value)} required autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <button type="submit" disabled={loading || setupDone}
                className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                {loading ? 'Wird gesetzt…' : 'Passwort einrichten & anmelden'}
              </button>
              <button type="button" onClick={() => { setSetupMode(false); setError('') }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors">
                ← Zurück zum Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
