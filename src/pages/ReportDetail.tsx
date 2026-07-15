import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage, getReport, reportAction } from '../api'
import { formatDate } from '../adminFormat'
import { Badge, DetailRow, ErrorBanner, Section } from '../adminUi'
import { ArrowLeft, Ban, CheckCircle, Eye, ShieldOff, XCircle } from 'lucide-react'

interface CompactUser {
  id: number
  email: string
  username: string
  display_name: string
  photo_url: string
  city: string
  verification_status: string
  is_active: boolean
  is_deleted: boolean
}

interface EventSummary {
  id: number
  title: string
  status: string
  city: string
  starts_at: string
  host_id: number
  host_email: string
}

interface ReportDetail {
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
  reported_user_id: number | null
  reported_user_email: string | null
  event_id: number | null
  event_title: string | null
  reporter: CompactUser
  reported_user: CompactUser | null
  event: EventSummary | null
  chat_messages: { id: number; sender: CompactUser; body: string; message_type: string; created_at: string }[]
  audit_logs: { id: number; action: string; actor_email: string; target_repr: string; metadata: Record<string, unknown>; created_at: string }[]
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  reviewing: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  reviewing: 'In Prüfung',
  resolved: 'Gelöst',
  dismissed: 'Abgewiesen',
}

const DECISION_LABELS: Record<string, string> = {
  needs_review: 'Prüfung gestartet',
  no_violation: 'Kein Verstoß',
  violation_confirmed: 'Verstoß bestätigt',
  user_suspended: 'Gemeldeter Nutzer gesperrt',
  reporter_suspended: 'Reporter gesperrt',
  event_cancelled: 'Event abgesagt',
}

function UserCard({ user, title }: { user: CompactUser | null; title: string }) {
  if (!user) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
        <p className="text-sm text-gray-400">Kein Nutzer verknüpft</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
      <Link to={`/users/${user.id}`} className="flex items-center gap-3 hover:text-violet-700">
        {user.photo_url ? (
          <img src={user.photo_url} className="h-10 w-10 rounded-full object-cover" alt="" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600">
            {(user.display_name || user.username || user.email || '?')[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{user.display_name || user.username || user.email}</p>
          <p className="truncate text-xs text-gray-400">{user.email}</p>
        </div>
      </Link>
      <div className="mt-3 flex flex-wrap gap-1">
        {user.is_deleted ? (
          <Badge className="bg-gray-200 text-gray-700">Gelöscht</Badge>
        ) : (
          <Badge className={user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>{user.is_active ? 'Aktiv' : 'Gesperrt'}</Badge>
        )}
        <Badge className="bg-gray-100 text-gray-600">{user.verification_status || 'unverified'}</Badge>
        {user.city && <Badge className="bg-blue-100 text-blue-700">{user.city}</Badge>}
      </div>
    </div>
  )
}

export default function ReportDetailPage() {
  const { id } = useParams()
  const [note, setNote] = useState('')
  const qc = useQueryClient()
  const { data: report, isLoading, error } = useQuery<ReportDetail>({
    queryKey: ['report', id],
    queryFn: () => getReport(id as string),
    enabled: Boolean(id),
  })
  const mutation = useMutation({
    mutationFn: (action: string) => reportAction(Number(id), { action, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report', id] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })

  const errorMessage = error
    ? getApiErrorMessage(error)
    : mutation.error
      ? getApiErrorMessage(mutation.error)
      : ''

  if (isLoading) return <div className="p-8 text-gray-400">Laden...</div>
  if (!report) return <div className="p-8 text-gray-400">Meldung nicht gefunden</div>

  return (
    <div className="p-8">
      <Link to="/reports" className="mb-5 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> Zurück zu Meldungen
      </Link>
      <ErrorBanner message={errorMessage} />

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="admin-detail-header flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className={STATUS_STYLES[report.status] || STATUS_STYLES.open}>{STATUS_LABELS[report.status] || report.status}</Badge>
              {report.moderation_decision && (
                <Badge className="bg-blue-100 text-blue-700">
                  {DECISION_LABELS[report.moderation_decision] || report.moderation_decision}
                </Badge>
              )}
              <span className="text-xs text-gray-400">{formatDate(report.created_at, true)}</span>
            </div>
            <h2 className="break-words text-xl font-bold text-gray-900">{report.reason}</h2>
            {report.details && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-gray-600">{report.details}</p>}
            {report.moderation_note && (
              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <p className="font-medium">Gespeicherte Entscheidung</p>
                <p>{report.moderation_note}</p>
                <p className="mt-1 text-xs text-blue-600">
                  {formatDate(report.decided_at, true)} · {report.decided_by_email || 'Admin'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div>
          <Section title="Kontext">
            <div className="space-y-4">
              <UserCard title="Reporter" user={report.reporter} />
              <UserCard title="Gemeldeter Nutzer" user={report.reported_user} />
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">Event</h3>
                {report.event ? (
                  <dl className="grid grid-cols-1 gap-4">
                    <DetailRow label="Titel" value={<Link to={`/events/${report.event.id}`} className="hover:text-violet-700">{report.event.title}</Link>} />
                    <DetailRow label="Status" value={<Badge className={STATUS_STYLES[report.event.status] || 'bg-gray-100 text-gray-600'}>{report.event.status}</Badge>} />
                    <DetailRow label="Stadt" value={report.event.city} />
                    <DetailRow label="Start" value={formatDate(report.event.starts_at, true)} />
                    <DetailRow label="Host" value={<Link to={`/users/${report.event.host_id}`} className="hover:text-violet-700">{report.event.host_email}</Link>} />
                  </dl>
                ) : (
                  <p className="text-sm text-gray-400">Kein Event verknüpft</p>
                )}
              </div>
            </div>
          </Section>
        </div>

        <div className="xl:col-span-2">
          <Section title="Maßnahmen">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Begründung der Entscheidung, z.B. kein Verstoß, Nutzer wiederholt beleidigend, Event verletzt Richtlinien"
                className="mb-4 h-20 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="flex flex-wrap gap-2">
                {report.status === 'open' && (
                  <button onClick={() => mutation.mutate('reviewing')} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50">
                    <Eye size={15} /> In Prüfung nehmen
                  </button>
                )}
                <button onClick={() => mutation.mutate('resolve')} className="inline-flex items-center gap-2 rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50">
                  <CheckCircle size={15} /> Lösen
                </button>
                <button onClick={() => mutation.mutate('dismiss')} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <XCircle size={15} /> Kein Verstoß
                </button>
                {report.reported_user && !report.reported_user.is_deleted && (
                  <button onClick={() => mutation.mutate('suspend_reported_user')} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                    <ShieldOff size={15} /> Gemeldeten Nutzer sperren
                  </button>
                )}
                {!report.reporter.is_deleted && (
                  <button onClick={() => mutation.mutate('suspend_reporter')} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                    <ShieldOff size={15} /> Reporter sperren
                  </button>
                )}
                {report.event && report.event.status !== 'cancelled' && (
                  <button onClick={() => mutation.mutate('cancel_event')} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                    <Ban size={15} /> Event absagen
                  </button>
                )}
              </div>
            </div>
          </Section>

          <Section title="Chat-Kontext">
            <div className="rounded-xl border border-gray-200 bg-white">
              {report.chat_messages.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Keine Chat-Nachrichten gefunden</p>
              ) : report.chat_messages.map((message) => (
                <div key={message.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <Link to={`/users/${message.sender?.id}`} className="text-sm font-medium text-gray-900 hover:text-violet-700">
                      {message.sender?.display_name || message.sender?.email || 'System'}
                    </Link>
                    <span className="text-xs text-gray-400">{formatDate(message.created_at, true)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{message.body}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Audit-Verlauf">
            <div className="rounded-xl border border-gray-200 bg-white">
              {report.audit_logs.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Noch keine Admin-Aktion</p>
              ) : report.audit_logs.map((log) => (
                <div key={log.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
                  <p className="text-sm font-medium text-gray-900">{log.action}</p>
                  <p className="text-xs text-gray-400">{formatDate(log.created_at, true)} · {log.actor_email || 'System'}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
