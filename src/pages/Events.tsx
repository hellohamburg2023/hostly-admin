import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage, getEvents, pageResults, patchEvent } from '../api'
import { formatDate } from '../adminFormat'
import { Badge, ErrorBanner, Pagination } from '../adminUi'
import { Calendar, Eye, MapPin, Search, Users } from 'lucide-react'

interface Event {
  id: number
  uuid: string
  title: string
  status: string
  city: string
  starts_at: string
  participant_limit: number
  participant_count: number
  request_count: number
  report_count: number
  open_report_count: number
  reviewing_report_count: number
  resolved_report_count: number
  dismissed_report_count: number
  women_only: boolean
  host_id: number
  host_email: string
  host_username: string
  host_name: string
  category_name: string
  created_at: string
}

interface Page<T> {
  results?: T[]
  next?: string | null
  previous?: string | null
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  full: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-purple-100 text-purple-700',
}

const STATUS_DE: Record<string, string> = {
  open: 'Offen',
  full: 'Voll',
  draft: 'Entwurf',
  cancelled: 'Abgesagt',
  completed: 'Beendet',
}

export default function EventsPage() {
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [city, setCity] = useState('')
  const [moderationFilter, setModerationFilter] = useState('')
  const [cursor, setCursor] = useState('')
  const qc = useQueryClient()

  const params: Record<string, string> = {}
  if (q) params.q = q
  if (statusFilter) params.status = statusFilter
  if (city) params.city = city
  if (moderationFilter) params.moderation = moderationFilter
  if (cursor) params.cursor = cursor

  const { data, isLoading, error } = useQuery<Page<Event> | Event[]>({
    queryKey: ['events', q, statusFilter, city, moderationFilter, cursor],
    queryFn: () => getEvents(params),
  })
  const events = pageResults<Event>(data)
  const page = data && !Array.isArray(data) ? data : undefined

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => patchEvent(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
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
      <div className="admin-page-header flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Events</h2>
        <span className="text-sm text-gray-500">{events.length} angezeigt</span>
      </div>

      <ErrorBanner message={errorMessage} />

      <div className="admin-filters flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-64 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setFilter(setQ, e.target.value)}
            placeholder="Titel, Host-E-Mail"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <input
          value={city}
          onChange={(e) => setFilter(setCity, e.target.value)}
          placeholder="Stadt"
          className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setFilter(setStatusFilter, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_DE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select
          value={moderationFilter}
          onChange={(e) => setFilter(setModerationFilter, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Moderationsstände</option>
          <option value="open_reports">Offene Meldungen</option>
          <option value="reviewing_reports">Meldungen in Prüfung</option>
          <option value="reported">Alle Events mit Meldungen</option>
          <option value="resolved_reports">Gelöste Meldungen</option>
          <option value="dismissed_reports">Abgewiesene Meldungen</option>
          <option value="clean">Ohne Meldungen</option>
        </select>
      </div>

      <div className="admin-table overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden...</div>
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Host</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Moderation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/events/${event.id}`} className="font-medium text-gray-900 hover:text-violet-700">
                      {event.title}
                    </Link>
                    <p className="text-xs text-gray-400">{event.category_name || 'Keine Kategorie'} · erstellt {formatDate(event.created_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/users/${event.host_id}`} className="text-gray-700 hover:text-violet-700">
                      {event.host_name || event.host_username || event.host_email}
                    </Link>
                    <p className="text-xs text-gray-400">{event.host_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-gray-500 text-xs"><MapPin size={10} />{event.city || '-'}</span>
                      <span className="flex items-center gap-1 text-gray-500 text-xs"><Calendar size={10} />{formatDate(event.starts_at, true)}</span>
                      <span className="flex items-center gap-1 text-gray-500 text-xs"><Users size={10} />{event.participant_count}/{event.participant_limit} · {event.request_count} Anfragen</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge className={STATUS_STYLES[event.status] || STATUS_STYLES.draft}>
                        {STATUS_DE[event.status] || event.status}
                      </Badge>
                      {event.women_only && <Badge className="bg-pink-100 text-pink-600">Women only</Badge>}
                      {event.open_report_count > 0 && <Badge className="bg-red-100 text-red-700">{event.open_report_count} offen</Badge>}
                      {event.reviewing_report_count > 0 && <Badge className="bg-amber-100 text-amber-700">{event.reviewing_report_count} in Prüfung</Badge>}
                      {event.report_count > 0 && <Badge className="bg-gray-100 text-gray-700">{event.report_count} Meldungen gesamt</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/events/${event.id}`}
                        title="Details prüfen"
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        <Eye size={14} />
                      </Link>
                      {event.status !== 'cancelled' && event.status !== 'completed' && (
                        <button
                          onClick={() => mutation.mutate({ id: event.id, status: 'cancelled' })}
                          className="text-xs text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition-colors"
                        >
                          Absagen
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
