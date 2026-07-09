// Apple Sign In for Web – uses the backend redirect flow (no JS SDK needed)
// The backend at VITE_API_URL handles the OAuth dance with Apple.
// After auth, Apple POSTs to the backend callback, which redirects here with tokens.

const BASE = import.meta.env.VITE_API_URL || ''

export const appleAvailable = !!import.meta.env.VITE_APPLE_WEB_ENABLED

/** Redirect to backend Apple login. The backend redirects back with ?apple_access=&apple_refresh= */
export function redirectToAppleLogin() {
  const next = encodeURIComponent(window.location.origin)
  window.location.href = `${BASE}/api/auth/apple/web/?next=${next}`
}

/** After Apple callback, pick up tokens from URL search params. Returns them and cleans the URL. */
export function consumeAppleTokensFromUrl(): { access: string; refresh: string } | null {
  const params = new URLSearchParams(window.location.search)
  const access = params.get('apple_access')
  const refresh = params.get('apple_refresh')
  if (access && refresh) {
    // remove tokens from URL bar
    params.delete('apple_access')
    params.delete('apple_refresh')
    const clean = `${window.location.pathname}${params.toString() ? '?' + params : ''}`
    window.history.replaceState({}, '', clean)
    return { access, refresh }
  }
  return null
}
