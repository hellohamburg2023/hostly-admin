import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { useAuth } from '../useAuth'
import { getApiErrorMessage, getAppleLoginConfig } from '../api'
import { BrandLogo } from '../BrandLogo'

const APPLE_SIGN_IN_BUTTON_URL = 'https://appleid.cdn-apple.com/appleid/button?height=44&width=336&color=black&border_radius=8&border=true&type=sign-in&locale=de_DE'

interface AppleLoginConfig {
  enabled: boolean
  client_id: string
  redirect_uri: string
  state?: string
  nonce?: string
  reason?: string
}

interface AppleSignInResponse {
  authorization?: { code?: string; id_token?: string; state?: string }
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
          nonce: string
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
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/de_DE/appleid.auth.js'
    script.async = true
    script.dataset.appleAuth = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Apple Login konnte nicht geladen werden.'))
    document.head.appendChild(script)
  })
  return appleScriptPromise
}

function getAppleAuthorizationErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  if ('error' in error && typeof error.error === 'string') return error.error
  if ('detail' in error && error.detail && typeof error.detail === 'object' && 'error' in error.detail && typeof error.detail.error === 'string') {
    return error.detail.error
  }
  return ''
}

function isAppleCancellation(error: unknown) {
  const code = getAppleAuthorizationErrorCode(error)
  return code === 'user_cancelled_authorize' || code === 'popup_closed_by_user'
}

function getAppleAuthorizationErrorMessage(error: unknown) {
  const code = getAppleAuthorizationErrorCode(error)
  const messages: Record<string, string> = {
    invalid_client: 'Apple Login ist falsch konfiguriert: Die hinterlegte Services ID ist bei Apple nicht gültig.',
    invalid_redirect_uri: 'Apple Login ist falsch konfiguriert: Die Rückgabe-URL stimmt nicht mit Apple überein.',
    invalid_request: 'Apple konnte die Login-Anfrage nicht verarbeiten. Bitte lade die Seite neu und versuche es erneut.',
    popup_blocked_by_browser: 'Das Apple-Loginfenster wurde vom Browser blockiert. Bitte erlaube Pop-ups für diese Seite.',
    user_trigger_new_signin_flow: 'Eine vorherige Apple-Anmeldung war noch aktiv. Bitte versuche es erneut.',
  }
  if (messages[code]) return messages[code]
  if (/^[a-z0-9_-]{1,80}$/i.test(code)) return `Apple Login wurde abgebrochen (${code}).`
  return ''
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
  const [appleReady, setAppleReady] = useState(false)

  const prepareAppleLogin = useCallback(async () => {
    setAppleReady(false)
    const config = await getAppleLoginConfig() as AppleLoginConfig
    if (config.enabled) {
      if (!config.client_id || !config.state || !config.nonce) {
        throw new Error(config.reason || 'Apple Login ist im Backend noch nicht vollständig konfiguriert.')
      }
      await loadAppleScript()
      if (!window.AppleID) throw new Error('Apple Login konnte nicht geladen werden.')
      window.AppleID.auth.init({
        clientId: config.client_id,
        scope: 'name email',
        redirectURI: config.redirect_uri,
        state: config.state,
        nonce: config.nonce,
        usePopup: true,
      })
    }
    setAppleConfig(config)
    setAppleReady(config.enabled)
    return config
  }, [])

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [navigate, user])

  useEffect(() => {
    let cancelled = false
    prepareAppleLogin().catch(() => {
      if (!cancelled) {
        setAppleReady(false)
        setAppleConfig({ enabled: false, client_id: '', redirect_uri: '', reason: 'Apple-Konfiguration konnte nicht geladen werden.' })
      }
    })
    return () => { cancelled = true }
  }, [prepareAppleLogin])

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
    setError('')
    setAppleLoading(true)
    let loginCompleted = false
    try {
      const config = appleConfig
      if (!appleReady || !config?.enabled || !config.state || !window.AppleID) {
        throw new Error('Apple Login wird noch vorbereitet. Bitte versuche es gleich erneut.')
      }
      // Keep this call synchronous with the button click. Safari otherwise
      // treats Apple's authentication window as a blocked popup.
      const result = await window.AppleID.auth.signIn()
      const identityToken = result.authorization?.id_token
      if (!identityToken) throw new Error('Apple hat kein Login-Token zurückgegeben.')
      if (!result.authorization?.state || result.authorization.state !== config.state) {
        throw new Error('Die Apple-Anmeldung konnte nicht eindeutig dieser Sitzung zugeordnet werden.')
      }
      const firstName = result.user?.name?.firstName || ''
      const lastName = result.user?.name?.lastName || ''
      const fullName = [firstName, lastName].filter(Boolean).join(' ')
      await signInWithApple(identityToken, result.authorization.state, fullName)
      loginCompleted = true
      navigate('/')
    } catch (err: unknown) {
      if (isAppleCancellation(err)) {
        setError('')
        return
      }
      setError(getAppleAuthorizationErrorMessage(err) || getApiErrorMessage(err, 'Apple Login ist fehlgeschlagen. Bitte lade die Seite neu und versuche es erneut.'))
    } finally {
      setAppleLoading(false)
      if (!loginCompleted) {
        prepareAppleLogin().catch(() => {
          setAppleReady(false)
          setAppleConfig({ enabled: false, client_id: '', redirect_uri: '', reason: 'Apple-Konfiguration konnte nicht neu geladen werden.' })
        })
      }
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
                disabled={appleLoading || !appleReady}
                aria-label="Mit Apple anmelden"
                aria-busy={appleLoading}
                className="flex h-11 w-full items-center justify-center overflow-hidden rounded-lg bg-black text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
              >
                {appleLoading ? (
                  <span className="flex items-center gap-2" role="status">
                    <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                    Apple Anmeldung...
                  </span>
                ) : !appleReady ? (
                  'Apple Login wird vorbereitet...'
                ) : (
                  <img src={APPLE_SIGN_IN_BUTTON_URL} alt="" className="h-11 w-full object-fill" />
                )}
              </button>
              <p className="text-center text-xs text-gray-400">Auf unterstützten Apple-Geräten bestätigt Apple die Anmeldung mit Face ID oder Touch ID.</p>
            </>
          )}

          {appleConfig && !appleConfig.enabled && appleConfig.reason && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Apple Login ist noch nicht verfügbar: {appleConfig.reason}</p>
          )}
        </div>
      </div>
    </div>
  )
}
