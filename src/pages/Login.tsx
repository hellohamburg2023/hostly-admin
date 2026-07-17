import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, LoaderCircle, LockKeyhole, Mail } from 'lucide-react'
import { useAuth } from '../useAuth'
import { getApiErrorMessage, getAppleLoginConfig } from '../api'
import { BrandLogo } from '../BrandLogo'

const APPLE_SIGN_IN_BUTTON_URL = 'https://appleid.cdn-apple.com/appleid/button?height=44&width=336&color=black&border_radius=8&border=true&type=sign-in&locale=de_DE&scale=3'
const APPLE_CHALLENGE_REFRESH_MS = 5 * 60 * 1000

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
    const refreshAppleChallenge = () => {
      prepareAppleLogin().catch(() => {
        if (!cancelled) {
          setAppleReady(false)
          setAppleConfig({ enabled: false, client_id: '', redirect_uri: '', reason: 'Apple-Konfiguration konnte nicht geladen werden.' })
        }
      })
    }
    refreshAppleChallenge()
    // Apple must open synchronously from the click handler, so obtain a fresh
    // one-time challenge in the background before its ten-minute TTL expires.
    const refreshTimer = window.setInterval(refreshAppleChallenge, APPLE_CHALLENGE_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [prepareAppleLogin])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Read the native controls directly. Safari can display iCloud Keychain
    // values while FormData still treats the controls as empty.
    const emailInput = e.currentTarget.elements.namedItem('email') as HTMLInputElement | null
    const passwordInput = e.currentTarget.elements.namedItem('password') as HTMLInputElement | null
    const submittedEmail = (emailInput?.value || '').trim()
    const submittedPassword = passwordInput?.value || ''
    setError('')
    if (!submittedEmail || !submittedPassword) {
      setError('Bitte E-Mail und Passwort eingeben.')
      return
    }
    setLoading(true)
    try {
      await signIn(submittedEmail, submittedPassword)
      navigate('/')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Login fehlgeschlagen'))
    } finally {
      setLoading(false)
    }
  }

  const handleAppleLogin = async () => {
    setError('')
    // Render the loading state before Apple's synchronous popup call so the
    // button responds immediately, just like the native app's login button.
    flushSync(() => setAppleLoading(true))
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

  const appleDisabledReason = appleConfig && !appleConfig.enabled
    ? appleConfig.reason || 'Apple Login ist aktuell nicht verfügbar.'
    : ''

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-8">
      <section className="w-full max-w-[400px]" aria-labelledby="login-heading">
        <div className="mb-5 flex items-center gap-3">
          <BrandLogo size="md" />
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">Hostly</p>
            <h1 id="login-heading" className="text-xl font-semibold text-gray-950">Admin anmelden</h1>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-950">Superuser-Zugang</p>
            <p className="mt-1 text-sm text-gray-500">Mit E-Mail und Passwort oder mit Apple anmelden.</p>
          </div>

          {error && (
            <div className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium text-gray-700">E-Mail</label>
              <div className="relative">
                <Mail size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="admin-email"
                  type="email"
                  name="email"
                  required
                  autoFocus
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-wait disabled:bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-gray-700">Passwort</label>
              <div className="relative">
                <LockKeyhole size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="admin-password"
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-wait disabled:bg-gray-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-700 active:scale-[0.99] disabled:cursor-wait disabled:bg-violet-500"
            >
              {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
              {loading ? 'Anmeldung läuft...' : 'Anmelden'}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400">oder</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            onClick={handleAppleLogin}
            disabled={appleLoading || !appleReady}
            aria-label="Mit Apple anmelden"
            aria-busy={appleLoading}
            className="relative flex h-11 w-full items-center justify-center overflow-hidden rounded-lg bg-black text-sm font-medium text-white transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
          >
            {appleLoading ? (
              <>
                <span className="flex items-center justify-center gap-2" role="status" aria-live="polite">
                  <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
                  Apple wird geöffnet...
                </span>
                <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/20" aria-hidden="true">
                  <span className="login-progress-bar block h-full w-2/5 rounded-full bg-white" />
                </span>
              </>
            ) : !appleReady ? (
              <span>{appleDisabledReason ? 'Apple Login nicht verfügbar' : 'Apple Login wird vorbereitet...'}</span>
            ) : (
              <img
                src={APPLE_SIGN_IN_BUTTON_URL}
                alt=""
                className="h-11 w-full object-contain"
              />
            )}
          </button>

          {(!appleReady || appleDisabledReason) && (
            <p className={`mt-2 rounded-lg px-3 py-2 text-xs leading-5 ${appleDisabledReason ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-500'}`}>
              {appleDisabledReason || 'Apple Login wird im Hintergrund vorbereitet.'}
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
