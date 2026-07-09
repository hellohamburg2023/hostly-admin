import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getApiErrorMessage, getHealth, getSafeWalks, pageResults } from '../api'
import { formatDate } from '../adminFormat'
import { Badge, EmptyState, ErrorBanner, Pagination } from '../adminUi'
import { Bell, Clock3, MapPin, Search, ShieldCheck, UsersRound } from 'lucide-react'

interface SafeWalk {
  id: number
  event_id: number
  event_title: string
  event_city: string
  user: { id: number; email: string; username: string; display_name: string; photo_url: string }
  destination_label: string
  transport_mode: string
  expected_arrival_at: string
  grace_minutes: number
  last_latitude: string | null
  last_longitude: string | null
  last_location_at: string | null
  status: string
  check_in_sent_at: string | null
  arrived_at: string | null
  cancelled_at: string | null
  escalated_at: string | null
  created_at: string
  updated_at: string
  overdue_minutes: number
  contact_count: number
}

interface Health {
  workers: {
    safe_walk_cron: { ok: boolean; overdue_check_ins: number; overdue_escalations: number }
  }
}

interface Page<T> {
  results?: T[]
  next?: string | null
  previous?: string | null
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  arrived: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-600',
  escalated: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  arrived: 'Angekommen',
  cancelled: 'Abgebrochen',
  escalated: 'Eskaliert',
}

function getWalkPhase(walk: SafeWalk) {
  if (walk.status !== 'active') return STATUS_LABELS[walk.status] || walk.status
  if (walk.check_in_sent_at) {
    return walk.overdue_minutes > 0 ? 'Eskalation fällig' : 'Check-in offen'
  }
  return walk.overdue_minutes > 0 ? 'Check-in fällig' : 'Unterwegs'
}

function getNextWorkerStep(walk: SafeWalk) {
  if (walk.status !== 'active') return 'Abgeschlossen'
  if (walk.check_in_sent_at) return `Eskalation nach ${walk.grace_minutes} Min. Grace`
  return 'Check-in bei erwarteter Ankunft'
}

export default function SafeWalksPage() {
  const [status, setStatus] = useState('active')
  const [overdue, setOverdue] = useState('')
  const [user, setUser] = useState('')
  const [event, setEvent] = useState('')
  const [cursor, setCursor] = useState('')

  const params: Record<string, string> = {}
  if (status) params.status = status
  if (overdue) params.overdue = overdue
  if (user) params.user = user
  if (event) params.event = event
  if (cursor) params.cursor = cursor

  const { data, isLoading, error } = useQuery<Page<SafeWalk> | SafeWalk[]>({
    queryKey: ['safe-walks', status, overdue, user, event, cursor],
    queryFn: () => getSafeWalks(params),
    refetchInterval: 30_000,
  })
  const { data: health } = useQuery<Health>({
    queryKey: ['health', 'safe-walk-worker'],
    queryFn: getHealth,
    refetchInterval: 30_000,
  })
  const walks = pageResults<SafeWalk>(data)
  const page = data && !Array.isArray(data) ? data : undefined
  const safeWalkWorker = health?.workers.safe_walk_cron

  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setCursor('')
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Safe-Walk-Monitoring</h2>
          <p className="text-sm text-gray-500 mt-0.5">Aktive, überfällige und eskalierte Heimwege mit Worker-Pushes prüfen</p>
        </div>
        <span className="text-sm text-gray-500">{walks.length} angezeigt</span>
      </div>

      <ErrorBanner message={error ? getApiErrorMessage(error) : ''} />

      <div className="grid grid-cols-1 gap-4 mb-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Worker</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">process_safe_walks</p>
              <p className="mt-1 text-xs text-gray-500">Container-Loop alle 30 Sekunden</p>
            </div>
            <Badge className={safeWalkWorker?.ok === false ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
              {safeWalkWorker?.ok === false ? 'Prüfen' : 'Aktiv'}
            </Badge>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <Clock3 size={18} className="mt-0.5 text-amber-600" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Fällige Check-ins</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{safeWalkWorker?.overdue_check_ins ?? 0}</p>
              <p className="text-xs text-gray-500">werden vom Worker per Push angestoßen</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <Bell size={18} className="mt-0.5 text-red-600" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Fällige Eskalationen</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{safeWalkWorker?.overdue_escalations ?? 0}</p>
              <p className="text-xs text-gray-500">idempotent verarbeitet, ohne doppelte Pushes</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <UsersRound size={18} className="mt-0.5 text-blue-600" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Kontakte</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">alle zulässigen Event-Kontakte</p>
              <p className="mt-1 text-xs text-gray-500">falls keine explizite Auswahl gesetzt ist</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={status}
          onChange={(e) => setFilter(setStatus, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select
          value={overdue}
          onChange={(e) => setFilter(setOverdue, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle</option>
          <option value="true">Überfällig</option>
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={user}
            onChange={(e) => setFilter(setUser, e.target.value)}
            placeholder="User-ID"
            className="w-32 pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <input
          value={event}
          onChange={(e) => setFilter(setEvent, e.target.value)}
          placeholder="Event-ID"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {isLoading ? (
        <div className="text-gray-400">Laden...</div>
      ) : walks.length === 0 ? (
        <EmptyState>Keine Safe-Walks in dieser Auswahl</EmptyState>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nutzer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Zeitplan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Standort</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Worker</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {walks.map((walk) => {
                const mapUrl = walk.last_latitude && walk.last_longitude
                  ? `https://www.google.com/maps/search/?api=1&query=${walk.last_latitude},${walk.last_longitude}`
                  : ''
                return (
                  <tr key={walk.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/users/${walk.user.id}`} className="font-medium text-gray-900 hover:text-violet-700">
                        {walk.user.display_name || walk.user.username || walk.user.email}
                      </Link>
                      <p className="text-xs text-gray-400">{walk.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/events/${walk.event_id}`} className="font-medium text-gray-900 hover:text-violet-700">
                        {walk.event_title}
                      </Link>
                      <p className="text-xs text-gray-400">{walk.event_city}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <p>Ziel: {walk.destination_label}</p>
                      <p>Erwartet: {formatDate(walk.expected_arrival_at, true)}</p>
                      <p>Grace: {walk.grace_minutes} Min. · Kontakte: {walk.contact_count}</p>
                      {walk.check_in_sent_at && <p>Check-in-Push: {formatDate(walk.check_in_sent_at, true)}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <p>Zuletzt: {formatDate(walk.last_location_at, true)}</p>
                      {mapUrl ? (
                        <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-violet-700 hover:text-violet-900">
                          <MapPin size={12} /> Karte öffnen
                        </a>
                      ) : (
                        <p className="text-gray-400">Kein Standort</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <p className="font-medium text-gray-700">{getWalkPhase(walk)}</p>
                      <p>{getNextWorkerStep(walk)}</p>
                      {walk.check_in_sent_at && walk.status === 'active' && (
                        <p className="mt-1 inline-flex items-center gap-1 text-blue-700">
                          <ShieldCheck size={12} /> 10 Min. länger setzt Check-in zurück
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge className={STATUS_STYLES[walk.status] || STATUS_STYLES.cancelled}>
                          {STATUS_LABELS[walk.status] || walk.status}
                        </Badge>
                        {walk.overdue_minutes > 0 && <Badge className="bg-red-100 text-red-700">{walk.overdue_minutes} Min. überfällig</Badge>}
                        {walk.check_in_sent_at && <Badge className="bg-amber-100 text-amber-700">Check-in gesendet</Badge>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination data={page} onCursor={setCursor} />
    </div>
  )
}
