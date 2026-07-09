import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEvents, patchEvent } from '../api'
import { Search, Users, MapPin, Calendar } from 'lucide-react'

interface Event {
  id: number
  uuid: string
  title: string
  status: string
  city: string
  starts_at: string
  participant_limit: number
  participant_count: number
  women_only: boolean
  host_id: number
  host_email: string
  host_username: string
  category_id: number
  category_name: string
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  full: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-purple-100 text-purple-700',
}

const STATUS_DE: Record<string, string> = {
  open: 'Offen', full: 'Voll', draft: 'Entwurf', cancelled: 'Abgesagt', completed: 'Beendet',
}

export default function EventsPage() {
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const qc = useQueryClient()

  const params: Record<string, string> = {}
  if (q) params.q = q
  if (statusFilter) params.status = statusFilter

  const { data, isLoading } = useQuery({ queryKey: ['events', q, statusFilter], queryFn: () => getEvents(params) })
  const events: Event[] = data?.results ?? data ?? []

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => patchEvent(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Events</h2>
        <span className="text-sm text-gray-500">{events.length} Einträge</span>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Titel, Host-E-Mail…"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_DE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Host</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{ev.title}</p>
                    <p className="text-xs text-gray-400">{ev.category_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{ev.host_username}</p>
                    <p className="text-xs text-gray-400">{ev.host_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-gray-500 text-xs"><MapPin size={10} />{ev.city}</span>
                      <span className="flex items-center gap-1 text-gray-500 text-xs"><Calendar size={10} />{new Date(ev.starts_at).toLocaleDateString('de-DE')}</span>
                      <span className="flex items-center gap-1 text-gray-500 text-xs"><Users size={10} />{ev.participant_count}/{ev.participant_limit}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[ev.status] || STATUS_STYLES.draft}`}>
                      {STATUS_DE[ev.status] || ev.status}
                    </span>
                    {ev.women_only && <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-600">♀ only</span>}
                  </td>
                  <td className="px-4 py-3">
                    {ev.status !== 'cancelled' && ev.status !== 'completed' && (
                      <button
                        onClick={() => mutation.mutate({ id: ev.id, status: 'cancelled' })}
                        className="text-xs text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition-colors"
                      >
                        Absagen
                      </button>
                    )}
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
