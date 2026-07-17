import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type FormEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, LoaderCircle, LockKeyhole, Mail } from 'lucide-react'
import { BrandLogo } from '../BrandLogo'
import {
  appleErrorMessage,
  isAppleCancellation,
  prepareAppleSignIn,
  startAppleSignIn,
  type AppleLoginConfig,
} from '../appleAuth'
import { getApiErrorMessage, getAppleLoginConfig } from '../api'
import { useAuth } from '../useAuth'

type BusyAction = 'password' | 'apple' | null

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.27.07 2.15.7 2.89.75 1.11-.22 2.17-.85 3.35-.77 1.42.11 2.49.67 3.2 1.7-2.93 1.76-2.23 5.62.46 6.7-.54 1.42-1.23 2.83-1.9 4.59ZM12.03 7.25C11.88 5.14 13.6 3.4 15.57 3.23c.27 2.44-2.22 4.26-3.54 4.02Z" />
    </svg>
  )
}

function nativeCredentials(form: HTMLFormElement, emailState: string, passwordState: string) {
  const emailInput = form.elements.namedItem('email') as HTMLInputElement | null
  const passwordInput = form.elements.namedItem('password') as HTMLInputElement | null
  const formData = new FormData(form)
  return {
    email: String(emailInput?.value || formData.get('email') || emailState).trim(),
    password: String(passwordInput?.value || formData.get('password') || passwordState),
  }
}

function nextPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

export default function Login() {
  const { user, signIn, signInWithApple } = useAuth()
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const mountedRef = useRef(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<BusyAction>(null)
  const [appleConfig, setAppleConfig] = useState<AppleLoginConfig | null>(null)
  const [applePreparing, setApplePreparing] = useState(true)

  const syncVisibleCredentials = useCallback(() => {
    const form = formRef.current
    if (!form) return
    const emailInput = form.elements.namedItem('email') as HTMLInputElement | null
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement | null
    if (emailInput?.value) setEmail(emailInput.value)
    if (passwordInput?.value) setPassword(passwordInput.value)
  }, [])

  const prepareApple = useCallback(async () => {
    if (mountedRef.current) setApplePreparing(true)
    try {
      const config = await getAppleLoginConfig() as AppleLoginConfig
      if (config.enabled) await prepareAppleSignIn(config)
      if (mountedRef.current) setAppleConfig(config)
    } catch (prepareError) {
      if (mountedRef.current) {
        setAppleConfig({
          enabled: false,
          client_id: '',
          redirect_uri: '',
          reason: getApiErrorMessage(prepareError, 'Apple Login konnte nicht vorbereitet werden.'),
        })
      }
    } finally {
      if (mountedRef.current) setApplePreparing(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [navigate, user])

  useEffect(() => {
    prepareApple()
    const timers = [100, 400, 1000].map((delay) => window.setTimeout(syncVisibleCredentials, delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [prepareApple, syncVisibleCredentials])

  const handleAutofill = (event: AnimationEvent<HTMLInputElement>) => {
    if (event.animationName !== 'hostly-autofill-start') return
    const { name, value } = event.currentTarget
    if (name === 'email') setEmail(value)
    if (name === 'password') setPassword(value)
  }

  const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    setError('')

    // Safari can paint Keychain values one frame before exposing them to JS.
    // Read the native controls, FormData and React state after the next paint.
    await nextPaint()
    const credentials = nativeCredentials(form, email, password)
    if (!credentials.email || !credentials.password) {
      setError('Bitte E-Mail und Passwort vollständig eingeben.')
      return
    }

    setEmail(credentials.email)
    setPassword(credentials.password)
    setBusy('password')
    try {
      await signIn(credentials.email, credentials.password)
      navigate('/', { replace: true })
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, 'Die Anmeldung ist fehlgeschlagen.'))
    } finally {
      if (mountedRef.current) setBusy(null)
    }
  }

  const handleAppleLogin = async () => {
    setError('')
    flushSync(() => setBusy('apple'))
    let completed = false

    try {
      const config = appleConfig
      if (!config?.enabled || !config.state || applePreparing) {
        throw new Error('Apple Login wird noch vorbereitet. Bitte einen Moment warten.')
      }

      // This must be invoked directly from the click so Safari keeps the popup.
      const result = await startAppleSignIn()
      const authorizationCode = result.authorization?.code || ''
      const identityToken = result.authorization?.id_token || ''
      const returnedState = result.authorization?.state || ''
      if (!authorizationCode || !identityToken) {
        throw new Error('Apple hat keine vollständige Anmeldebestätigung zurückgegeben.')
      }
      if (returnedState !== config.state) {
        throw new Error('Die Apple-Anmeldung gehört nicht zu dieser Sitzung. Bitte erneut versuchen.')
      }

      const firstName = result.user?.name?.firstName || ''
      const lastName = result.user?.name?.lastName || ''
      await signInWithApple({
        authorizationCode,
        identityToken,
        state: returnedState,
        fullName: [firstName, lastName].filter(Boolean).join(' '),
      })
      completed = true
      navigate('/', { replace: true })
    } catch (appleError) {
      if (!isAppleCancellation(appleError)) {
        setError(
          appleErrorMessage(appleError)
          || getApiErrorMessage(appleError, 'Apple Login ist fehlgeschlagen. Bitte erneut versuchen.'),
        )
      }
    } finally {
      if (mountedRef.current) setBusy(null)
      if (!completed) prepareApple()
    }
  }

  const appleReady = Boolean(appleConfig?.enabled && appleConfig.state && !applePreparing)
  const anyBusy = busy !== null

  return (
    <main className="login-page min-h-dvh px-4 py-8 sm:px-6">
      <section className="w-full max-w-[420px]" aria-labelledby="login-title">
        <header className="mb-6 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Hostly Admin</p>
          <h1 id="login-title" className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">Willkommen zurück</h1>
          <p className="mt-1 text-sm text-gray-500">Melde dich mit deinem Superuser-Konto an.</p>
        </header>

        <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_18px_50px_rgba(31,41,55,0.09)] sm:p-6">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-700" role="alert">
              <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form ref={formRef} onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium text-gray-700">E-Mail</label>
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  onInput={(event) => setEmail(event.currentTarget.value)}
                  onAnimationStart={handleAutofill}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="email"
                  disabled={anyBusy}
                  required
                  autoFocus
                  className="login-input h-12 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-base text-gray-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-wait disabled:bg-gray-50 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-gray-700">Passwort</label>
              <div className="relative">
                <LockKeyhole size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="admin-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  onInput={(event) => setPassword(event.currentTarget.value)}
                  onAnimationStart={handleAutofill}
                  autoComplete="current-password"
                  disabled={anyBusy}
                  required
                  className="login-input h-12 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-base text-gray-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-wait disabled:bg-gray-50 sm:text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={anyBusy}
              aria-busy={busy === 'password'}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.99] disabled:cursor-wait disabled:bg-violet-500"
            >
              {busy === 'password' && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
              {busy === 'password' ? 'Anmeldung läuft …' : 'Anmelden'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400">oder</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            onClick={handleAppleLogin}
            disabled={anyBusy || !appleReady}
            aria-busy={busy === 'apple'}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-900 active:scale-[0.99] disabled:cursor-wait disabled:bg-gray-800 disabled:text-white/85"
          >
            {busy === 'apple' ? (
              <>
                <LoaderCircle size={19} className="animate-spin" aria-hidden="true" />
                <span>Apple wird geprüft …</span>
              </>
            ) : applePreparing ? (
              <>
                <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
                <span>Apple Login wird vorbereitet …</span>
              </>
            ) : (
              <>
                <AppleLogo />
                <span>Mit Apple anmelden</span>
              </>
            )}
          </button>

          {appleConfig && !appleConfig.enabled && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {appleConfig.reason || 'Apple Login ist derzeit nicht verfügbar.'}
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">Geschützter Zugang für Hostly-Administratoren</p>
      </section>
    </main>
  )
}
