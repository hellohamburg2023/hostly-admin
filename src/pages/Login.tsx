import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../useAuth'
import { getApiErrorMessage, getAppleLoginConfig } from '../api'
import { BrandLogo } from '../BrandLogo'
import { Apple } from 'lucide-react'

interface AppleLoginConfig {
  enabled: boolean
  client_id: string
  redirect_uri: string
}

interface AppleSignInResponse {
  authorization?: { id_token?: string }
  user?: { name?: { firstName?: string; lastName?: string } }
}

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string
          scope: string
          redirectURI: string
          state: string
          usePopup: boolean
        }) => void
        signIn: () => Promise<AppleSignInResponse>
      }
    }
  }
}

let appleScriptPromise: Promise<void> | null = null

function loadAppleScript() {
  if (window.AppleID) return Promise.resolve()
  if (appleScriptPromise) return appleScriptPromise
  appleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-apple-auth]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Apple Login konnte nicht geladen werden.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
    script.async = true
    script.dataset.appleAuth = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Apple Login konnte nicht geladen werden.'))
    document.head.appendChild(script)
  })
  return appleScriptPromise
}

export default function Login() {
  const { user, signIn, signInWithApple } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [appleConfig, setAppleConfig] = useState<AppleLoginConfig | null>(null)
  const [appleLoading, setAppleLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [navigate, user])

  useEffect(() => {
    let cancelled = false
    getAppleLoginConfig()
      .then((config: AppleLoginConfig) => {
        if (!cancelled) setAppleConfig(config)
        if (config.enabled) return loadAppleScript()
        return undefined
      })
      .catch(() => {
        if (!cancelled) setAppleConfig({ enabled: false, client_id: '', redirect_uri: '' })
      })
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Login fehlgeschlagen'))
    } finally {
      setLoading(false)
    }
  }

  const handleAppleLogin = async () => {
    if (!appleConfig?.enabled || !appleConfig.client_id) {
      setError('Apple Login ist im Backend noch nicht konfiguriert.')
      return
    }
    setError('')
    setAppleLoading(true)
    try {
      await loadAppleScript()
      if (!window.AppleID) throw new Error('Apple Login konnte nicht geladen werden.')
      window.AppleID.auth.init({
        clientId: appleConfig.client_id,
        scope: 'name email',
        redirectURI: appleConfig.redirect_uri || `${window.location.origin}/login`,
        state: 'hostly-admin',
        usePopup: true,
      })
      const result = await window.AppleID.auth.signIn()
      const identityToken = result.authorization?.id_token
      if (!identityToken) throw new Error('Apple hat kein Login-Token zurückgegeben.')
      const firstName = result.user?.name?.firstName || ''
      const lastName = result.user?.name?.lastName || ''
      const fullName = [firstName, lastName].filter(Boolean).join(' ')
      await signInWithApple(identityToken, fullName)
      navigate('/')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Apple Login fehlgeschlagen. Prüfe, ob dein Apple Account einem Superuser entspricht.'))
    } finally {
      setAppleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-violet-600">hostly admin</h1>
          <p className="text-sm text-gray-500 mt-1">Melde dich mit deinem Superuser-Konto an</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
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
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>

          {appleConfig?.enabled && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400">oder</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <button
                type="button"
                onClick={handleAppleLogin}
                disabled={appleLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-900 disabled:opacity-60"
              >
                <Apple size={17} fill="currentColor" strokeWidth={1.7} />
                {appleLoading ? 'Apple Anmeldung...' : 'Mit Apple anmelden'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
