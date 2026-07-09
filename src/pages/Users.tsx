import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, patchUser } from '../api'
import { Search, ShieldOff, Shield, UserX, UserCheck } from 'lucide-react'

interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
  last_login: string | null
  email_verified_at: string | null
  profile_display_name: string
  profile_city: string
  profile_verification_status: string
  profile_photo_url: string
}

const BADGE: Record<string, string> = {
  verified: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  unverified: 'bg-gray-100 text-gray-600',
}

export default function UsersPage() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')
  const qc = useQueryClient()
  const params: Record<string, string> = {}
  if (q) params.q = q
  if (filter) params.is_active = filter

  const { data, isLoading } = useQuery({ queryKey: ['users', q, filter], queryFn: () => getUsers(params) })
  const users: User[] = data?.results ?? data ?? []

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) => patchUser(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Nutzer</h2>
        <span className="text-sm text-gray-500">{Array.isArray(users) ? users.length : 0} Einträge</span>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="E-Mail, Username…"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle</option>
          <option value="true">Aktiv</option>
          <option value="false">Gesperrt</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nutzer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stadt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Beigetreten</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.profile_photo_url ? (
                        <img src={u.profile_photo_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                          {(u.profile_display_name || u.username || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{u.profile_display_name || u.username}</p>
                        <p className="text-gray-400 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.profile_city || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.is_active ? 'Aktiv' : 'Gesperrt'}
                      </span>
                      {u.profile_verification_status && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[u.profile_verification_status] || BADGE.unverified}`}>
                          {u.profile_verification_status}
                        </span>
                      )}
                      {u.is_staff && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">Staff</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.date_joined).toLocaleDateString('de-DE')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => mutation.mutate({ id: u.id, patch: { is_active: !u.is_active } })}
                        title={u.is_active ? 'Sperren' : 'Entsperren'}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      {!u.is_superuser && (
                        <button
                          onClick={() => mutation.mutate({ id: u.id, patch: { is_staff: !u.is_staff } })}
                          title={u.is_staff ? 'Staff entfernen' : 'Staff machen'}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                        >
                          {u.is_staff ? <ShieldOff size={14} /> : <Shield size={14} />}
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
    </div>
  )
}
