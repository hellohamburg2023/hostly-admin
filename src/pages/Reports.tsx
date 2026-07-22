import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage, getReports, pageResults, reportAction } from '../api'
import { formatDate } from '../adminFormat'
import { Badge, EmptyState, ErrorBanner, Pagination } from '../adminUi'
import { Eye, Search } from 'lucide-react'
import {
  REPORT_STATUS_STYLES,
  reportDecisionLabel,
  reportReasonLabel,
  reportStatusLabel,
  reportTargetLabel,
  reportTargetType,
  splitReportDetails,
} from '../reportFormat'

interface Report {
  id: number
  reason: string
  details: string
  status: string
  moderation_decision: string
  moderation_note: string
  decided_at: string | null
  decided_by_email: string
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

const STATUS_DE: Record<string, string> = {
  open: 'Neu',
  reviewing: 'In Prüfung',
  resolved: 'Erledigt',
  dismissed: 'Kein Verstoß',
}

const NEXT_ACTIONS: Record<string, { label: string; action: string; style: string }[]> = {
  open: [{ label: 'Prüfung beginnen', action: 'reviewing', style: 'border-amber-300 text-amber-700 hover:bg-amber-50' }],
  reviewing: [
    { label: 'Verstoß bestätigen', action: 'resolve', style: 'border-green-300 text-green-700 hover:bg-green-50' },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
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
      : ''

  return (
    <div className="p-4 sm:p-8">
      <div className="admin-page-header mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Meldungen von Nutzern</h2>
          <p className="mt-1 text-sm text-gray-500">Prüfe, was gemeldet wurde und welches Problem die Person beschreibt.</p>
        </div>
        <span className="shrink-0 text-sm text-gray-500">{reports.length} auf dieser Seite</span>
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

      <div className="admin-filters flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-64 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setFilter(setQ, e.target.value)}
            placeholder="Problem, Beschreibung, Person oder Event"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <input
          value={reporter}
          onChange={(e) => setFilter(setReporter, e.target.value)}
          aria-label="ID der meldenden Person"
          placeholder="Meldende Person (ID)"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <input
          value={reportedUser}
          onChange={(e) => setFilter(setReportedUser, e.target.value)}
          aria-label="ID der gemeldeten Person"
          placeholder="Gemeldete Person (ID)"
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
        <div className="text-gray-400">Meldungen werden geladen …</div>
      ) : reports.length === 0 ? (
        <EmptyState>Keine Meldungen in dieser Auswahl</EmptyState>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const { userDetails, chatContext } = splitReportDetails(report.details)
            return (
            <article key={report.id} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                <div className="flex-1 min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge className={REPORT_STATUS_STYLES[report.status] || 'bg-gray-100 text-gray-600'}>
                      {reportStatusLabel(report.status)}
                    </Badge>
                    <Badge className="bg-violet-50 text-violet-700">{reportTargetType(report)}</Badge>
                    {report.moderation_decision && (
                      <Badge className="bg-blue-100 text-blue-700">
                        {reportDecisionLabel(report.moderation_decision)}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(report.created_at, true)}</span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Gemeldet wurde</p>
                  <Link to={`/reports/${report.id}`} className="mt-0.5 block text-base font-semibold text-gray-900 hover:text-violet-700">
                    {reportTargetLabel(report)}
                  </Link>
                  <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-gray-500">Problem laut Nutzer</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">{reportReasonLabel(report.reason)}</p>
                    <p className={`mt-1 whitespace-pre-wrap text-sm ${userDetails ? 'text-gray-600' : 'italic text-gray-400'}`}>
                      {userDetails || 'Keine zusätzliche Beschreibung angegeben.'}
                    </p>
                  </div>
                  {chatContext && (
                    <div className="mt-2 border-l-2 border-violet-300 pl-3">
                      <p className="text-xs font-semibold text-violet-700">Gemeldete Nachricht</p>
                      <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-gray-600">
                        {chatContext.excerpt || 'Der Nachrichteninhalt wurde nicht mitgesendet.'}
                      </p>
                    </div>
                  )}
                  {report.moderation_note && (
                    <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      <span className="font-semibold">Notiz zur Entscheidung:</span> {report.moderation_note}
                    </p>
                  )}
                  <div className="mt-3 space-y-0.5 text-xs text-gray-500">
                    <p>
                      Gemeldet von:{' '}
                      <Link to={`/users/${report.reporter_id}`} className="text-gray-700 hover:text-violet-700">
                        {report.reporter_username || report.reporter_email}
                      </Link>{' '}
                      {report.reporter_username && `(${report.reporter_email})`}
                    </p>
                    {report.reported_user_id && (
                      <p>
                        Betroffene Person:{' '}
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
                <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
                  <Link
                    to={`/reports/${report.id}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Eye size={14} /> Details prüfen
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
            </article>
          )})}
        </div>
      )}
      <Pagination data={page} onCursor={setCursor} />
    </div>
  )
}
