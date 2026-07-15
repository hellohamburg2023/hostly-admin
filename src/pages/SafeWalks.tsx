import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getApiErrorMessage, getHealth, getSafeWalks, pageResults } from '../api'
import { formatDate } from '../adminFormat'
import { Badge, EmptyState, ErrorBanner, Pagination } from '../adminUi'
import {
  SAFETY_KIND_LABELS,
  SAFETY_STATUS_LABELS,
  SAFETY_STATUS_STYLES,
  TRUST_MODE_LABELS,
  freshnessLabel,
  type SafeWalkSession,
} from '../safeWalk'
import { Activity, Bell, ChevronRight, Clock3, MapPin, Radio, Search, ShieldAlert } from 'lucide-react'

interface Health {
  workers: {
    safe_walk_cron: {
      ok: boolean
      heartbeat_ok: boolean
      last_seen_at: string | null
      last_result: Record<string, unknown>
      overdue_check_ins: number
      overdue_escalations: number
    }
  }
}

interface Page<T> {
  results?: T[]
  next?: string | null
  previous?: string | null
}

function getWalkPhase(walk: SafeWalkSession) {
  if (walk.status === 'active' && walk.overdue_minutes === 0) return 'Unterwegs'
  if (walk.status === 'arrival_due') return 'Ankunft muss bestätigt werden'
  if (walk.status === 'grace_period') return 'Grace Period läuft'
  if (walk.status === 'escalated') return 'Notfallzugriff freigegeben'
  return SAFETY_STATUS_LABELS[walk.status] || walk.status
}

export default function SafeWalksPage() {
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [trustMode, setTrustMode] = useState('')
  const [attention, setAttention] = useState('')
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState('')

  const params: Record<string, string> = {}
  if (status) params.status = status
  if (kind) params.kind = kind
  if (trustMode) params.trusted_contact_type = trustMode
  if (attention) params.attention = attention
  if (q) params.q = q
  if (cursor) params.cursor = cursor

  const { data, isLoading, error } = useQuery<Page<SafeWalkSession> | SafeWalkSession[]>({
    queryKey: ['safe-walks', status, kind, trustMode, attention, q, cursor],
    queryFn: () => getSafeWalks(params),
    refetchInterval: 30_000,
  })
  const { data: health } = useQuery<Health>({
    queryKey: ['health', 'safe-walk-worker'],
    queryFn: getHealth,
    refetchInterval: 30_000,
  })
  const walks = pageResults<SafeWalkSession>(data)
  const page = data && !Array.isArray(data) ? data : undefined
  const worker = health?.workers.safe_walk_cron

  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setCursor('')
  }

  return (
    <div className="p-8">
      <div className="admin-page-header mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Safety Operations</h2>
          <p className="mt-0.5 text-sm text-gray-500">Safe Walk und Meeting Safety live überwachen, ohne geschützte Standortdaten vorzeitig offenzulegen</p>
        </div>
        <span className="text-sm text-gray-500">{walks.length} angezeigt</span>
      </div>

      <ErrorBanner message={error ? getApiErrorMessage(error) : ''} />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Safety Worker</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">process_safe_walks</p>
              <p className="mt-1 text-xs text-gray-500">Heartbeat {freshnessLabel(worker?.last_seen_at ?? null)}</p>
            </div>
            <Badge className={worker?.ok === false ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
              {worker?.ok === false ? 'Prüfen' : 'Aktiv'}
            </Badge>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <Clock3 size={18} className="mt-0.5 text-amber-600" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Fällige Check-ins</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{worker?.overdue_check_ins ?? 0}</p>
              <p className="text-xs text-gray-500">werden automatisch verarbeitet</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <Bell size={18} className="mt-0.5 text-red-600" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Fällige Eskalationen</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{worker?.overdue_escalations ?? 0}</p>
              <p className="text-xs text-gray-500">sicherheitskritische Rückstände</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="mt-0.5 text-violet-600" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Datenschutz</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Emergency Disclosure</p>
              <p className="mt-1 text-xs text-gray-500">Koordinaten nur bei Eskalation</p>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-filters mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(event) => setFilter(setQ, event.target.value)}
            placeholder="Nutzer, Event oder Zielbezeichnung"
            className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select value={status} onChange={(event) => setFilter(setStatus, event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">Alle Status</option>
          {Object.entries(SAFETY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={kind} onChange={(event) => setFilter(setKind, event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">Alle Safety-Arten</option>
          {Object.entries(SAFETY_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={trustMode} onChange={(event) => setFilter(setTrustMode, event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">Alle Vertrauensmodi</option>
          {Object.entries(TRUST_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
          <input type="checkbox" checked={attention === 'true'} onChange={(event) => setFilter(setAttention, event.target.checked ? 'true' : '')} className="accent-violet-600" />
          Nur Handlungsbedarf
        </label>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Laden...</div>
      ) : walks.length === 0 ? (
        <EmptyState>Keine Safety Sessions in dieser Auswahl</EmptyState>
      ) : (
        <div className="admin-table overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Session</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nutzer / Event</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Zeitplan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Telemetrie</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Kontaktweg</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {walks.map((walk) => {
                const mapUrl = walk.location_disclosure === 'emergency' && walk.last_latitude && walk.last_longitude
                  ? `https://www.google.com/maps/search/?api=1&query=${walk.last_latitude},${walk.last_longitude}`
                  : ''
                return (
                  <tr key={walk.id} className={walk.needs_attention ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{SAFETY_KIND_LABELS[walk.kind] || walk.kind}</p>
                      <p className="text-xs text-gray-400">#{walk.id} · v{walk.version}</p>
                    </td>
                    <td className="px-4 py-3">
                      {walk.user ? (
                        <Link to={`/users/${walk.user.id}`} className="font-medium text-gray-900 hover:text-violet-700">{walk.user.display_name || walk.user.username || walk.user.email}</Link>
                      ) : <p className="font-medium text-gray-500">Gelöschtes Mitglied</p>}
                      {walk.event_id ? (
                        <Link to={`/events/${walk.event_id}`} className="block max-w-56 truncate text-xs text-violet-700 hover:text-violet-900">{walk.event_title || `Event #${walk.event_id}`}</Link>
                      ) : <p className="text-xs text-gray-400">Kein Event verknüpft</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <p>{walk.destination_label || 'Geschütztes Ziel'}</p>
                      <p>Erwartet: {formatDate(walk.expected_arrival_at, true)}</p>
                      {walk.last_extended_at && <p>+{walk.last_extension_minutes} Min. · {formatDate(walk.last_extended_at, true)}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <p className="inline-flex items-center gap-1"><Radio size={12} /> App {freshnessLabel(walk.last_app_contact_at)}</p>
                      <p>Standort {freshnessLabel(walk.last_location_at)} · {walk.location_point_count} Punkte</p>
                      {mapUrl ? (
                        <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-red-700 hover:text-red-900"><MapPin size={12} /> Notfallstandort öffnen</a>
                      ) : walk.location_disclosure === 'protected' ? (
                        <p className="mt-1 text-violet-600">Standort bis Eskalation geschützt</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <p>{TRUST_MODE_LABELS[walk.trusted_contact_type] || walk.trusted_contact_type}</p>
                      <p>{walk.contact_count} Kontakte · {walk.accepted_invite_count}/{walk.invite_count} Links angenommen</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-44 flex-wrap gap-1">
                        <Badge className={SAFETY_STATUS_STYLES[walk.status] || 'bg-gray-100 text-gray-600'}>{SAFETY_STATUS_LABELS[walk.status] || walk.status}</Badge>
                        {walk.needs_attention && <Badge className="bg-red-100 text-red-700">Handlungsbedarf</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{getWalkPhase(walk)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/safe-walks/${walk.id}`} title="Safety Session öffnen" className="inline-flex rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-violet-700"><ChevronRight size={16} /></Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination data={page} onCursor={setCursor} />

      <div className="mt-5 flex items-start gap-2 rounded-lg bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <Activity size={15} className="mt-0.5 shrink-0" />
        Die Liste aktualisiert sich alle 30 Sekunden. Detailansichten zeigen Einladungsstatus, Live-Activity-Fähigkeit, Verlängerungen und den Safety-Zugriffsverlauf.
      </div>
    </div>
  )
}
