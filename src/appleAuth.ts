// Apple Sign In for Web – loads the Apple JS SDK dynamically
// Requires VITE_APPLE_WEB_CLIENT_ID to be set (your Apple Service ID)

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init(config: AppleIDConfig): void
        signIn(): Promise<AppleIDResponse>
      }
    }
  }
}

interface AppleIDConfig {
  clientId: string
  scope: string
  redirectURI: string
  usePopup: boolean
}

interface AppleIDResponse {
  authorization: {
    id_token: string
    code: string
    state?: string
  }
  user?: {
    name?: { firstName?: string; lastName?: string }
    email?: string
  }
}

let sdkLoaded = false

function loadAppleSDK(): Promise<void> {
  if (sdkLoaded || window.AppleID) {
    sdkLoaded = true
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
    script.onload = () => { sdkLoaded = true; resolve() }
    script.onerror = () => reject(new Error('Apple SDK konnte nicht geladen werden'))
    document.head.appendChild(script)
  })
}

export async function signInWithApple(): Promise<{ identity_token: string; full_name: string }> {
  const clientId = import.meta.env.VITE_APPLE_WEB_CLIENT_ID
  if (!clientId) throw new Error('VITE_APPLE_WEB_CLIENT_ID ist nicht konfiguriert')

  await loadAppleSDK()

  window.AppleID!.auth.init({
    clientId,
    scope: 'name email',
    redirectURI: window.location.origin,
    usePopup: true,
  })

  const response = await window.AppleID!.auth.signIn()
  const u = response.user
  const full_name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(' ')

  return { identity_token: response.authorization.id_token, full_name }
}

export const appleAvailable = !!import.meta.env.VITE_APPLE_WEB_CLIENT_ID
