import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage, getReports, pageResults, reportAction } from '../api'
import { formatDate } from '../adminFormat'
import { Badge, EmptyState, ErrorBanner, Pagination } from '../adminUi'
import { Eye, Search } from 'lucide-react'

interface Report {
  id: number
  reason: string
  details: string
  status: string
  created_at: string
  reporter_id: number
  reporter_email: string
  reporter_username: string
  reported_user_id: number | null
  reported_user_email: string | null
  event_id: number | null
  event_title: string | null
  event_city: string | null
}

interface Page<T> {
  results?: T[]
  next?: string | null
  previous?: string | null
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  reviewing: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-500',
}

const STATUS_DE: Record<string, string> = {
  open: 'Offen',
  reviewing: 'In Prüfung',
  resolved: 'Gelöst',
  dismissed: 'Abgewiesen',
}

const NEXT_ACTIONS: Record<string, { label: string; action: string; style: string }[]> = {
  open: [{ label: 'Prüfen', action: 'reviewing', style: 'border-amber-300 text-amber-700 hover:bg-amber-50' }],
  reviewing: [
    { label: 'Lösen', action: 'resolve', style: 'border-green-300 text-green-700 hover:bg-green-50' },
    { label: 'Kein Verstoß', action: 'dismiss', style: 'border-gray-300 text-gray-600 hover:bg-gray-50' },
  ],
}

export default function ReportsPage() {
  const [statusFilter, setStatusFilter] = useState('open')
  const [q, setQ] = useState('')
  const [reporter, setReporter] = useState('')
  const [reportedUser, setReportedUser] = useState('')
  const [event, setEvent] = useState('')
  const [cursor, setCursor] = useState('')
  const qc = useQueryClient()

  const params: Record<string, string> = {}
  if (statusFilter) params.status = statusFilter
  if (q) params.q = q
  if (reporter) params.reporter = reporter
  if (reportedUser) params.reported_user = reportedUser
  if (event) params.event = event
  if (cursor) params.cursor = cursor

  const { data, isLoading, error } = useQuery<Page<Report> | Report[]>({
    queryKey: ['reports', statusFilter, q, reporter, reportedUser, event, cursor],
    queryFn: () => getReports(params),
  })
  const reports = pageResults<Report>(data)
  const page = data && !Array.isArray(data) ? data : undefined

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) => reportAction(id, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
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
        <h2 className="text-xl font-bold text-gray-900">Meldungen</h2>
        <span className="text-sm text-gray-500">{reports.length} angezeigt</span>
      </div>

      <ErrorBanner message={errorMessage} />

      <div className="flex flex-wrap gap-2 mb-4">
        {(['', 'open', 'reviewing', 'resolved', 'dismissed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(setStatusFilter, status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {status ? STATUS_DE[status] : 'Alle'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-64 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setFilter(setQ, e.target.value)}
            placeholder="Grund, Details, E-Mail, Event"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <input
          value={reporter}
          onChange={(e) => setFilter(setReporter, e.target.value)}
          placeholder="Reporter-ID"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <input
          value={reportedUser}
          onChange={(e) => setFilter(setReportedUser, e.target.value)}
          placeholder="Gemeldet-ID"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <input
          value={event}
          onChange={(e) => setFilter(setEvent, e.target.value)}
          placeholder="Event-ID"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {isLoading ? (
        <div className="text-gray-400">Laden...</div>
      ) : reports.length === 0 ? (
        <EmptyState>Keine Meldungen in dieser Auswahl</EmptyState>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={STATUS_STYLES[report.status] || STATUS_STYLES.open}>
                      {STATUS_DE[report.status] || report.status}
                    </Badge>
                    <span className="text-xs text-gray-400">{formatDate(report.created_at, true)}</span>
                  </div>
                  <Link to={`/reports/${report.id}`} className="font-semibold text-gray-900 text-sm hover:text-violet-700">
                    {report.reason}
                  </Link>
                  {report.details && <p className="text-sm text-gray-600 mt-1 mb-2 line-clamp-2">{report.details}</p>}
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>
                      Von:{' '}
                      <Link to={`/users/${report.reporter_id}`} className="text-gray-700 hover:text-violet-700">
                        {report.reporter_username || report.reporter_email}
                      </Link>{' '}
                      ({report.reporter_email})
                    </p>
                    {report.reported_user_id && (
                      <p>
                        Gemeldeter Nutzer:{' '}
                        <Link to={`/users/${report.reported_user_id}`} className="text-gray-700 hover:text-violet-700">
                          {report.reported_user_email}
                        </Link>
                      </p>
                    )}
                    {report.event_id && (
                      <p>
                        Event:{' '}
                        <Link to={`/events/${report.event_id}`} className="text-gray-700 hover:text-violet-700">
                          {report.event_title}
                        </Link>{' '}
                        {report.event_city ? `· ${report.event_city}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    to={`/reports/${report.id}`}
                    title="Kontext prüfen"
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                  >
                    <Eye size={14} />
                  </Link>
                  {(NEXT_ACTIONS[report.status] || []).map((action) => (
                    <button
                      key={action.action}
                      onClick={() => mutation.mutate({ id: report.id, action: action.action })}
                      className={`text-xs border px-3 py-1.5 rounded-lg font-medium transition-colors ${action.style}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination data={page} onCursor={setCursor} />
    </div>
  )
}
