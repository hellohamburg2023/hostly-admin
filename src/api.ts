import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh/`, { refresh })
        localStorage.setItem('access_token', data.access)
        api.defaults.headers.common['Authorization'] = `Bearer ${data.access}`
        return api(original)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const login = (email: string, password: string) =>
  api.post('/api/auth/login/', { email, password }).then((r) => r.data)

// Admin
export const getStats = () => api.get('/api/admin/stats/').then((r) => r.data)

export const getUsers = (params?: Record<string, string>) =>
  api.get('/api/admin/users/', { params }).then((r) => r.data)

export const patchUser = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/users/${id}/`, data).then((r) => r.data)

export const getProfiles = (params?: Record<string, string>) =>
  api.get('/api/admin/profiles/', { params }).then((r) => r.data)

export const patchProfile = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/profiles/${id}/`, data).then((r) => r.data)

export const getEvents = (params?: Record<string, string>) =>
  api.get('/api/admin/events/', { params }).then((r) => r.data)

export const patchEvent = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/events/${id}/`, data).then((r) => r.data)

export const getReports = (params?: Record<string, string>) =>
  api.get('/api/admin/reports/', { params }).then((r) => r.data)

export const patchReport = (id: number, data: Record<string, unknown>) =>
  api.patch(`/api/admin/reports/${id}/`, data).then((r) => r.data)

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

export const getIdeas = () =>
  api.get('/api/admin/ideas/').then((r) => r.data)
