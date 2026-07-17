export interface AppleLoginConfig {
  enabled: boolean
  client_id: string
  redirect_uri: string
  state?: string
  nonce?: string
  reason?: string
}

export interface AppleSignInResponse {
  authorization?: {
    code?: string
    id_token?: string
    state?: string
  }
  user?: {
    name?: {
      firstName?: string
      lastName?: string
    }
  }
}

interface AppleAuthApi {
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

declare global {
  interface Window {
    AppleID?: { auth: AppleAuthApi }
  }
}

let appleScriptPromise: Promise<void> | null = null

function loadAppleScript() {
  if (window.AppleID) return Promise.resolve()
  if (appleScriptPromise) return appleScriptPromise

  appleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-hostly-apple-auth]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Apple Login konnte nicht geladen werden.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/de_DE/appleid.auth.js'
    script.async = true
    script.dataset.hostlyAppleAuth = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Apple Login konnte nicht geladen werden.'))
    document.head.appendChild(script)
  })

  return appleScriptPromise
}

export async function prepareAppleSignIn(config: AppleLoginConfig) {
  if (!config.enabled) throw new Error(config.reason || 'Apple Login ist derzeit nicht verfügbar.')
  if (!config.client_id || !config.redirect_uri || !config.state || !config.nonce) {
    throw new Error('Apple Login ist nicht vollständig konfiguriert.')
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

export function startAppleSignIn() {
  if (!window.AppleID) throw new Error('Apple Login wird noch vorbereitet.')
  return window.AppleID.auth.signIn()
}

function appleErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  if ('error' in error && typeof error.error === 'string') return error.error
  if (
    'detail' in error
    && error.detail
    && typeof error.detail === 'object'
    && 'error' in error.detail
    && typeof error.detail.error === 'string'
  ) return error.detail.error
  return ''
}

export function isAppleCancellation(error: unknown) {
  const code = appleErrorCode(error)
  return code === 'user_cancelled_authorize' || code === 'popup_closed_by_user'
}

export function appleErrorMessage(error: unknown) {
  const code = appleErrorCode(error)
  const messages: Record<string, string> = {
    invalid_client: 'Die Apple-Konfiguration ist ungültig. Bitte den Hostly-Support informieren.',
    invalid_redirect_uri: 'Die Apple-Rückgabeadresse ist ungültig. Bitte den Hostly-Support informieren.',
    invalid_request: 'Apple konnte die Anfrage nicht verarbeiten. Bitte erneut versuchen.',
    popup_blocked_by_browser: 'Das Apple-Fenster wurde blockiert. Bitte Pop-ups für Hostly erlauben.',
    user_trigger_new_signin_flow: 'Eine frühere Apple-Anmeldung war noch geöffnet. Bitte erneut versuchen.',
  }
  return messages[code] || ''
}
