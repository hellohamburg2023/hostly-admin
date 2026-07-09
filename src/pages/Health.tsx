import { useQuery } from '@tanstack/react-query'
import { getApiErrorMessage, getAnalytics, getHealth } from '../api'
import { Badge, ErrorBanner } from '../adminUi'
import { CheckCircle, RefreshCw, XCircle } from 'lucide-react'

interface Health {
  checks: Record<string, { ok: boolean; detail?: string; backend?: string; sandbox?: boolean }>
  workers: {
    safe_walk_cron: { ok: boolean; overdue_check_ins: number; overdue_escalations: number }
    event_reminder_cron: { ok: boolean; sample: string[] }
  }
}

interface Analytics {
  requests: { total: number; accepted: number; acceptance_rate: number }
  verification: { total: number; verified: number; pending: number; rate: number }
  safe_walks: { total: number; active: number; escalated: number; escalation_rate: number }
}

function CheckCard({ name, check }: { name: string; check: { ok: boolean; detail?: string; backend?: string; sandbox?: boolean } }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
          <p className="mt-1 text-xs text-gray-500">
            {check.detail || check.backend || (check.sandbox !== undefined ? `Sandbox: ${check.sandbox ? 'Ja' : 'Nein'}` : 'Konfiguration vorhanden')}
          </p>
        </div>
        {check.ok ? <CheckCircle size={18} className="text-green-600" /> : <XCircle size={18} className="text-red-600" />}
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
      <div className="mb-6 flex items-center justify-between">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            {Object.entries(health.checks).map(([name, check]) => (
              <CheckCard key={name} name={name.toUpperCase()} check={check} />
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
