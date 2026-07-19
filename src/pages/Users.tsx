import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteUser, getApiErrorMessage, getUsers, pageResults, patchUser } from '../api'
import { activityLabel, formatDate } from '../adminFormat'
import { Badge, ErrorBanner, Pagination } from '../adminUi'
import { Eye, Search, Tag, Trash2, UserCheck, UserX } from 'lucide-react'

interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  is_test_user: boolean
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
  profile_hostly_verified: boolean
  profile_photo_url: string
  hosted_event_count: number
  participation_count: number
  reports_received_count: number
  deleted_at: string | null
  is_deleted: boolean
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
  const [accountState, setAccountState] = useState('')
  const [testUserFilter, setTestUserFilter] = useState('')
  const [cursor, setCursor] = useState('')
  const qc = useQueryClient()

  const params: Record<string, string> = {}
  if (q) params.q = q
  if (activeFilter) params.is_active = activeFilter
  if (verificationFilter) params.verification_status = verificationFilter
  if (activityFilter) params.activity = activityFilter
  if (testUserFilter) params.is_test_user = testUserFilter
  if (accountState) params.account_state = accountState
  else if (activeFilter === 'false') params.account_state = 'registered'
  if (cursor) params.cursor = cursor

  const { data, isLoading, error } = useQuery<Page<User> | User[]>({
    queryKey: ['users', q, activeFilter, verificationFilter, activityFilter, accountState, testUserFilter, cursor],
    queryFn: () => getUsers(params),
  })
  const users = pageResults<User>(data)
  const page = data && !Array.isArray(data) ? data : undefined

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) => patchUser(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
    },
  })

  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setCursor('')
  }
  const errorMessage = error
    ? getApiErrorMessage(error)
    : mutation.error
      ? getApiErrorMessage(mutation.error)
      : deleteMutation.error
        ? getApiErrorMessage(deleteMutation.error)
        : ''

  return (
    <div className="p-8">
      <div className="admin-page-header flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Nutzer</h2>
        <span className="text-sm text-gray-500">{users.length} angezeigt</span>
      </div>

      <ErrorBanner message={errorMessage} />

      <div className="admin-filters flex flex-wrap gap-3 mb-5">
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
          value={accountState}
          onChange={(e) => setFilter(setAccountState, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Kontostände</option>
          <option value="registered">Registriert</option>
          <option value="deleted">Gelöscht</option>
        </select>
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
          value={testUserFilter}
          onChange={(e) => setFilter(setTestUserFilter, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Nutzertypen</option>
          <option value="false">Reguläre Nutzer</option>
          <option value="true">Testuser</option>
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

      <div className="admin-user-results">
        {isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">Laden...</div>
        ) : (
          <>
          <div className="admin-user-cards divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {users.map((u) => (
              <article key={u.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Link to={`/users/${u.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                    {u.profile_photo_url ? (
                      <img src={u.profile_photo_url} className="h-10 w-10 shrink-0 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600">
                        {(u.profile_display_name || u.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{u.profile_display_name || u.username}</p>
                      <p className="truncate text-xs text-gray-400">{u.email}</p>
                      <p className="mt-1 text-xs text-gray-500">{u.profile_city || 'Keine Stadt'} · {activityLabel(u.inactive_days)}</p>
                    </div>
                  </Link>
                  <Link
                    to={`/users/${u.id}`}
                    aria-label={`Details von ${u.profile_display_name || u.username} öffnen`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  >
                    <Eye size={17} />
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {u.is_deleted ? (
                    <Badge className="bg-gray-200 text-gray-700">Gelöscht</Badge>
                  ) : (
                    <Badge className={u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>{u.is_active ? 'Aktiv' : 'Gesperrt'}</Badge>
                  )}
                  {u.is_test_user && <Badge className="bg-violet-100 text-violet-700">Testuser</Badge>}
                  {u.profile_verification_status && <Badge className={BADGE[u.profile_verification_status] || BADGE.unverified}>{u.profile_hostly_verified ? 'Hostly-verifiziert' : u.profile_verification_status}</Badge>}
                  {u.is_superuser && <Badge className="bg-violet-100 text-violet-700">Superuser</Badge>}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
                  <span>{u.hosted_event_count} Events · {u.participation_count} Teilnahmen</span>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => mutation.mutate({ id: u.id, patch: { is_test_user: !u.is_test_user } })} title={u.is_test_user ? 'Testuser-Markierung entfernen' : 'Als Testuser markieren'} className={`rounded-lg p-2 ${u.is_test_user ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:bg-violet-50 hover:text-violet-700'}`}><Tag size={15} /></button>
                    {!u.is_superuser && !u.is_deleted && <button onClick={() => mutation.mutate({ id: u.id, patch: { is_active: !u.is_active } })} title={u.is_active ? 'Sperren' : 'Entsperren'} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800">{u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}</button>}
                    {!u.is_superuser && <button type="button" onClick={() => { const name = u.profile_display_name || u.username || u.email; const confirmation = prompt(`Nutzer „${name}“ endgültig löschen? Konto, Events, Dateien und zugehörige Daten werden entfernt.\n\nTippe LÖSCHEN zur Bestätigung.`); if (confirmation === 'LÖSCHEN') deleteMutation.mutate(u.id) }} disabled={deleteMutation.isPending} title="Nutzer endgültig löschen" className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><Trash2 size={15} /></button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="admin-user-table admin-table overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[820px] text-sm">
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
                      {u.is_deleted ? (
                        <Badge className="bg-gray-200 text-gray-700">Gelöscht</Badge>
                      ) : (
                        <Badge className={u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>
                          {u.is_active ? 'Aktiv' : 'Gesperrt'}
                        </Badge>
                      )}
                      {u.is_test_user && <Badge className="bg-violet-100 text-violet-700">Testuser</Badge>}
                      {u.profile_verification_status && (
                        <Badge className={BADGE[u.profile_verification_status] || BADGE.unverified}>
                          {u.profile_hostly_verified ? 'Hostly-verifiziert' : u.profile_verification_status}
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
                      <button
                        onClick={() => mutation.mutate({ id: u.id, patch: { is_test_user: !u.is_test_user } })}
                        title={u.is_test_user ? 'Testuser-Markierung entfernen' : 'Als Testuser markieren'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.is_test_user
                            ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                            : 'text-gray-500 hover:bg-violet-50 hover:text-violet-700'
                        }`}
                      >
                        <Tag size={14} />
                      </button>
                      {!u.is_superuser && !u.is_deleted && (
                        <button
                          onClick={() => mutation.mutate({ id: u.id, patch: { is_active: !u.is_active } })}
                          title={u.is_active ? 'Sperren' : 'Entsperren'}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                        >
                          {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      )}
                      {!u.is_superuser && (
                        <button
                          type="button"
                          onClick={() => {
                            const name = u.profile_display_name || u.username || u.email
                            const confirmation = prompt(`Nutzer „${name}“ endgültig löschen? Konto, Events, Dateien und zugehörige Daten werden entfernt.\n\nTippe LÖSCHEN zur Bestätigung.`)
                            if (confirmation === 'LÖSCHEN') deleteMutation.mutate(u.id)
                          }}
                          disabled={deleteMutation.isPending}
                          title="Nutzer endgültig löschen"
                          className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>
      <Pagination data={page} onCursor={setCursor} />
    </div>
  )
}
