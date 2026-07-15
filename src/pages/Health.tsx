import { useQuery } from '@tanstack/react-query'
import { getApiErrorMessage, getAnalytics, getHealth } from '../api'
import { Badge, ErrorBanner } from '../adminUi'
import { CheckCircle, CircleDashed, RefreshCw, XCircle } from 'lucide-react'

interface Health {
  checks: Record<string, { ok: boolean; optional?: boolean; detail?: string; backend?: string; sandbox?: boolean }>
  workers: {
    safe_walk_cron: { ok: boolean; heartbeat_ok: boolean; last_seen_at: string | null; last_result: Record<string, unknown>; overdue_check_ins: number; overdue_escalations: number }
    event_reminder_cron: { ok: boolean; sample: string[] }
  }
}

interface Analytics {
  requests: { total: number; accepted: number; acceptance_rate: number }
  verification: { total: number; verified: number; pending: number; rate: number }
  safe_walks: { total: number; active: number; escalated: number; escalation_rate: number }
}

const CHECK_LABELS: Record<string, string> = {
  database: 'Datenbank',
  redis: 'Redis',
  apns: 'Apple Push (APNs)',
  email: 'E-Mail',
  sentry: 'Sentry',
  firebase_analytics: 'Firebase Analytics',
}

function CheckCard({ checkKey, check }: { checkKey: string; check: { ok: boolean; optional?: boolean; detail?: string; backend?: string; sandbox?: boolean } }) {
  const detail = check.detail || check.backend || (check.sandbox !== undefined ? `Umgebung: ${check.sandbox ? 'Sandbox' : 'Produktion'}` : check.ok ? 'Betriebsbereit' : 'Nicht verfügbar')
  return (
    <div className={`min-w-0 rounded-xl border bg-white p-5 ${!check.ok && !check.optional ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{CHECK_LABELS[checkKey] ?? checkKey.replaceAll('_', ' ')}</h3>
            {check.optional && !check.ok && <Badge className="bg-amber-100 text-amber-800">Optional</Badge>}
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-gray-500">{detail}</p>
        </div>
        {check.ok ? <CheckCircle size={18} className="shrink-0 text-green-600" /> : check.optional ? <CircleDashed size={18} className="shrink-0 text-amber-600" /> : <XCircle size={18} className="shrink-0 text-red-600" />}
      </div>
    </div>
  )
}

export default function HealthPage() {
  const { data: health, isLoading, error, refetch, isFetching } = useQuery<Health>({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
  })
  const { data: analytics } = useQuery<Analytics>({ queryKey: ['analytics'], queryFn: getAnalytics })

  return (
    <div className="p-8">
      <div className="admin-page-header mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Betrieb und Infra-Health</h2>
          <p className="text-sm text-gray-500 mt-0.5">Backend-Abhängigkeiten, Worker-Signale und sicherheitsrelevante Metriken</p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Aktualisieren
        </button>
      </div>

      <ErrorBanner message={error ? getApiErrorMessage(error) : ''} />

      {isLoading || !health ? (
        <div className="text-gray-400">Laden...</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {Object.entries(health.checks).map(([name, check]) => (
              <CheckCard key={name} checkKey={name} check={check} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Safe-Walk-Worker</h3>
                <Badge className={health.workers.safe_walk_cron.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                  {health.workers.safe_walk_cron.ok ? 'OK' : 'Prüfen'}
                </Badge>
              </div>
              <p className="mb-4 text-xs text-gray-500">
                Läuft im Container als process_safe_walks-Loop alle 30 Sekunden; parallele Läufe werden idempotent abgefangen.
              </p>
              <p className="mb-4 text-xs text-gray-500">
                Heartbeat: {health.workers.safe_walk_cron.last_seen_at ? new Date(health.workers.safe_walk_cron.last_seen_at).toLocaleString('de-DE') : 'noch nicht empfangen'}
              </p>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-400">Check-ins fällig</dt>
                  <dd className="mt-1 text-2xl font-bold text-gray-900">{health.workers.safe_walk_cron.overdue_check_ins}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-400">Eskalationen fällig</dt>
                  <dd className="mt-1 text-2xl font-bold text-gray-900">{health.workers.safe_walk_cron.overdue_escalations}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Event-Reminder-Cron</h3>
                <Badge className={health.workers.event_reminder_cron.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                  {health.workers.event_reminder_cron.ok ? 'OK' : 'Prüfen'}
                </Badge>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                {health.workers.event_reminder_cron.sample.length === 0 ? (
                  <p className="text-sm text-gray-400">Keine Ausgabe</p>
                ) : health.workers.event_reminder_cron.sample.map((line) => (
                  <p key={line} className="font-mono text-xs text-gray-600">{line}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-700">Join-Requests</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">{analytics?.requests.acceptance_rate ?? 0}%</p>
              <p className="text-xs text-gray-500">{analytics?.requests.accepted ?? 0} angenommen von {analytics?.requests.total ?? 0}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-700">Verifizierung</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">{analytics?.verification.rate ?? 0}%</p>
              <p className="text-xs text-gray-500">{analytics?.verification.pending ?? 0} offen</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-700">Safe-Walks</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">{analytics?.safe_walks.active ?? 0} aktiv</p>
              <p className="text-xs text-gray-500">{analytics?.safe_walks.escalated ?? 0} eskaliert · {analytics?.safe_walks.escalation_rate ?? 0}%</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
