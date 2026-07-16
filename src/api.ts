import axios, { type InternalAxiosRequestConfig } from 'axios'

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim()
const defaultBaseUrl = import.meta.env.PROD
  ? 'https://app.meet-hostly.com'
  : 'http://localhost:8000'
const useSameOriginApi = import.meta.env.PROD
  && typeof window !== 'undefined'
  && !['localhost', '127.0.0.1'].includes(window.location.hostname)
const BASE_URL = (useSameOriginApi ? '' : configuredBaseUrl || defaultBaseUrl).replace(/\/+$/, '')

export const api = axios.create({ baseURL: BASE_URL })

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }

export function clearAuthStorage() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('admin_user')
}

export function getApiErrorMessage(error: unknown, fallback = 'Die Anfrage ist fehlgeschlagen.') {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined
    const detail = data?.detail ?? data?.non_field_errors
    if (Array.isArray(detail)) return detail.join(' ')
    if (typeof detail === 'string') return detail
    if (data) {
      const fieldMessage = Object.values(data)
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .find((value): value is string => typeof value === 'string')
      if (fieldMessage) return fieldMessage
    }
    if (error.response?.status === 403) return 'Nur Superuser duerfen auf diese Admin-Webseite zugreifen.'
    if (error.response?.status === 401) return 'E-Mail oder Passwort ist falsch.'
    if (!error.response) return 'Die Hostly-API ist nicht erreichbar. Bitte prüfe die Internetverbindung und lade die Seite neu.'
  }
  return error instanceof Error ? error.message : fallback
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config as RetryConfig | undefined
    const url = original?.url ?? ''
    const isAuthRequest = url.includes('/api/admin/login/') || url.includes('/api/auth/refresh/')

    if (error.response?.status === 401 && original && !original._retry && !isAuthRequest) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (!refresh) throw new Error('Missing refresh token')
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh/`, { refresh })
        localStorage.setItem('access_token', data.access)
        if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
        api.defaults.headers.common['Authorization'] = `Bearer ${data.access}`
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        clearAuthStorage()
        if (window.location.pathname !== '/login') window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const login = (email: string, password: string) =>
  api.post('/api/admin/login/', { email, password }).then((r) => r.data)

export const getAppleLoginConfig = () =>
  api.get('/api/admin/login/apple/config/').then((r) => r.data)

export const loginWithApple = (identityToken: string, state: string, fullName?: string) =>
  api.post('/api/admin/login/apple/', {
    identity_token: identityToken,
    state,
    full_name: fullName || '',
  }).then((r) => r.data)

// Admin
export const getStats = () => api.get('/api/admin/stats/').then((r) => r.data)

export const getUsers = (params?: Record<string, string>) =>
  api.get('/api/admin/users/', { params }).then((r) => r.data)

export const getUser = (id: number | string) =>
  api.get(`/api/admin/users/${id}/`).then((r) => r.data)

export const patchUser = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/users/${id}/`, data).then((r) => r.data)

export const deleteUser = (id: number) =>
  api.delete(`/api/admin/users/${id}/`).then((r) => r.data)

export const getProfiles = (params?: Record<string, string>) =>
  api.get('/api/admin/profiles/', { params }).then((r) => r.data)

export const patchProfile = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/profiles/${id}/`, data).then((r) => r.data)

export const deleteProfilePhoto = (id: number) =>
  api.delete(`/api/admin/profiles/${id}/photo/`).then((r) => r.data)

export const getEvents = (params?: Record<string, string>) =>
  api.get('/api/admin/events/', { params }).then((r) => r.data)

export const getEvent = (id: number | string) =>
  api.get(`/api/admin/events/${id}/`).then((r) => r.data)

export const patchEvent = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/events/${id}/`, data).then((r) => r.data)

export const deleteEvent = (id: number) =>
  api.delete(`/api/admin/events/${id}/`).then((r) => r.data)

export const deleteEventPhoto = (eventId: number, photoId: number) =>
  api.delete(`/api/admin/events/${eventId}/photos/${photoId}/`).then((r) => r.data)

export const getReports = (params?: Record<string, string>) =>
  api.get('/api/admin/reports/', { params }).then((r) => r.data)

export const getReport = (id: number | string) =>
  api.get(`/api/admin/reports/${id}/`).then((r) => r.data)

export const patchReport = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/reports/${id}/`, data).then((r) => r.data)

export const reportAction = (id: number, data: Record<string, unknown>) =>
  api.post(`/api/admin/reports/${id}/action/`, data).then((r) => r.data)

export const getSafeWalks = (params?: Record<string, string>) =>
  api.get('/api/admin/safe-walks/', { params }).then((r) => r.data)

export const getSafeWalk = (id: number | string) =>
  api.get(`/api/admin/safe-walks/${id}/`).then((r) => r.data)

export const getAuditLogs = (params?: Record<string, string>) =>
  api.get('/api/admin/audit-logs/', { params }).then((r) => r.data)

export interface AdminPushNotificationPayload {
  target_type: 'users' | 'all' | 'active_30d' | 'city' | 'category'
  user_ids?: number[]
  city?: string
  category_id?: number
  title_de: string
  body_de: string
  title_en?: string
  body_en?: string
}

export interface AdminPushNotificationResult {
  recipient_count: number
  device_count: number
  language_counts: { de: number; en: number }
  sent_device_count?: number
  rejected_device_count?: number
  devices: AdminPushNotificationDeviceResult[]
}

export interface AdminPushNotificationDeviceResult {
  id: number
  user_id: number
  user_email: string
  user_display_name: string
  platform: string
  provider: 'apns' | 'expo'
  preferred_language: 'de' | 'en'
  token_suffix: string
  updated_at: string
  delivery_status: 'ready' | 'accepted' | 'rejected'
  provider_status: number | null
  rejection_reason: string
}

export const previewPushNotification = (data: AdminPushNotificationPayload) =>
  api.post<AdminPushNotificationResult>('/api/admin/message-preview/', data).then((r) => r.data)

export const sendPushNotification = (data: AdminPushNotificationPayload) =>
  api.post<AdminPushNotificationResult>('/api/admin/message-send/', data).then((r) => r.data)

export const getAnalytics = () => api.get('/api/admin/analytics/').then((r) => r.data)

export const getProductAnalytics = (days: number) =>
  api.get('/api/admin/product-analytics/', { params: { days } }).then((r) => r.data)

export const getHealth = () => api.get('/api/admin/health/').then((r) => r.data)

export const getCategories = () =>
  api.get('/api/admin/categories/').then((r) => r.data)

export const createCategory = (data: Record<string, unknown>) =>
  api.post('/api/admin/categories/', data).then((r) => r.data)

export const patchCategory = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/categories/${id}/`, data).then((r) => r.data)

export const deleteCategory = (id: number) =>
  api.delete(`/api/admin/categories/${id}/`).then((r) => r.data)

export const getInterests = () =>
  api.get('/api/admin/interests/').then((r) => r.data)

export const createInterest = (data: Record<string, unknown>) =>
  api.post('/api/admin/interests/', data).then((r) => r.data)

export const patchInterest = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/interests/${id}/`, data).then((r) => r.data)

export const deleteInterest = (id: number) =>
  api.delete(`/api/admin/interests/${id}/`).then((r) => r.data)

export const getIdeas = (params?: Record<string, string>) =>
  api.get('/api/admin/ideas/', { params }).then((r) => r.data)

export const createIdea = (data: Record<string, unknown>) =>
  api.post('/api/admin/ideas/', data).then((r) => r.data)

export const patchIdea = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/ideas/${id}/`, data).then((r) => r.data)

export const deleteIdea = (id: number) =>
  api.delete(`/api/admin/ideas/${id}/`).then((r) => r.data)

export function cursorFromUrl(url: string | null | undefined) {
  if (!url) return ''
  try {
    return new URL(url).searchParams.get('cursor') || ''
  } catch {
    return ''
  }
}

export function pageResults<T>(data: { results?: T[] } | T[] | undefined): T[] {
  if (!data) return []
  return Array.isArray(data) ? data : (data.results ?? [])
}
