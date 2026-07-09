import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage, getUsers, pageResults, patchUser } from '../api'
import { activityLabel, formatDate } from '../adminFormat'
import { Badge, ErrorBanner, Pagination } from '../adminUi'
import { Eye, Search, UserCheck, UserX } from 'lucide-react'

interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
  last_login: string | null
  last_active_at: string | null
  inactive_days: number | null
  email_verified_at: string | null
  profile_display_name: string
  profile_city: string
  profile_verification_status: string
  profile_photo_url: string
  hosted_event_count: number
  participation_count: number
  reports_received_count: number
}

interface Page<T> {
  results?: T[]
  next?: string | null
  previous?: string | null
}

const BADGE: Record<string, string> = {
  verified: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-600',
  unverified: 'bg-gray-100 text-gray-600',
}

export default function UsersPage() {
  const [q, setQ] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [verificationFilter, setVerificationFilter] = useState('')
  const [activityFilter, setActivityFilter] = useState('')
  const [cursor, setCursor] = useState('')
  const qc = useQueryClient()

  const params: Record<string, string> = {}
  if (q) params.q = q
  if (activeFilter) params.is_active = activeFilter
  if (verificationFilter) params.verification_status = verificationFilter
  if (activityFilter) params.activity = activityFilter
  if (cursor) params.cursor = cursor

  const { data, isLoading, error } = useQuery<Page<User> | User[]>({
    queryKey: ['users', q, activeFilter, verificationFilter, activityFilter, cursor],
    queryFn: () => getUsers(params),
  })
  const users = pageResults<User>(data)
  const page = data && !Array.isArray(data) ? data : undefined

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) => patchUser(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setCursor('')
  }
  const errorMessage = error
    ? getApiErrorMessage(error)
    : mutation.error
      ? getApiErrorMessage(mutation.error)
      : ''

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Nutzer</h2>
        <span className="text-sm text-gray-500">{users.length} angezeigt</span>
      </div>

      <ErrorBanner message={errorMessage} />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-64 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setFilter(setQ, e.target.value)}
            placeholder="E-Mail, Username, Name"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={activeFilter}
          onChange={(e) => setFilter(setActiveFilter, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Accounts</option>
          <option value="true">Aktiv</option>
          <option value="false">Gesperrt</option>
        </select>
        <select
          value={verificationFilter}
          onChange={(e) => setFilter(setVerificationFilter, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Verifizierungen</option>
          <option value="pending">Ausstehend</option>
          <option value="verified">Verifiziert</option>
          <option value="rejected">Abgelehnt</option>
          <option value="unverified">Unverifiziert</option>
        </select>
        <select
          value={activityFilter}
          onChange={(e) => setFilter(setActivityFilter, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Aktivitätsstände</option>
          <option value="active_1d">Heute aktiv</option>
          <option value="active_7d">Aktiv letzte 7 Tage</option>
          <option value="active_30d">Aktiv letzte 30 Tage</option>
          <option value="inactive_30d">Inaktiv über 30 Tage</option>
          <option value="never_active">Nie aktiv</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nutzer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktivität</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Signale</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/users/${u.id}`} className="flex items-center gap-3">
                      {u.profile_photo_url ? (
                        <img src={u.profile_photo_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                          {(u.profile_display_name || u.username || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{u.profile_display_name || u.username}</p>
                        <p className="text-gray-400 text-xs truncate">{u.email}</p>
                        <p className="text-gray-400 text-xs">{u.profile_city || 'Keine Stadt'} · seit {formatDate(u.date_joined)}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{activityLabel(u.inactive_days)}</p>
                    <p className="text-xs text-gray-400">zuletzt {formatDate(u.last_active_at || u.last_login, true)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <p>{u.hosted_event_count} Events · {u.participation_count} Teilnahmen</p>
                    <p>{u.reports_received_count} erhaltene Meldungen</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge className={u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>
                        {u.is_active ? 'Aktiv' : 'Gesperrt'}
                      </Badge>
                      {u.profile_verification_status && (
                        <Badge className={BADGE[u.profile_verification_status] || BADGE.unverified}>
                          {u.profile_verification_status}
                        </Badge>
                      )}
                      {u.is_superuser && <Badge className="bg-violet-100 text-violet-700">Superuser</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link
                        to={`/users/${u.id}`}
                        title="Details prüfen"
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        <Eye size={14} />
                      </Link>
                      {!u.is_superuser && (
                        <button
                          onClick={() => mutation.mutate({ id: u.id, patch: { is_active: !u.is_active } })}
                          title={u.is_active ? 'Sperren' : 'Entsperren'}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                        >
                          {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination data={page} onCursor={setCursor} />
    </div>
  )
}
