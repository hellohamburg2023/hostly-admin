import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BellRing,
  CheckCircle,
  CircleDashed,
  Clock3,
  Cloud,
  Database,
  ExternalLink,
  Globe2,
  HardDrive,
  Mail,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  XCircle,
  Zap,
} from 'lucide-react'
import { getApiErrorMessage, getHealth, getSentryMonitoring } from '../api'
import { Badge, ErrorBanner } from '../adminUi'

interface Check {
  ok: boolean
  optional?: boolean
  detail?: string
  backend?: string
  sandbox?: boolean
  latency_ms?: number | null
}

interface RailwayService {
  key: string
  name: string
  label: string
  role: string
  ok: boolean
  status: string
  running_replicas: number
  desired_replicas: number
  deployment_id: string | null
  deployed_at: string | null
  regions: string[]
  source: string
}

interface RailwayVolume {
  id: string
  name: string
  service: string
  state: string
  ok: boolean
  mount_path: string
  current_size_mb: number
  capacity_mb: number
  used_percent: number
}

interface BackupSchedule {
  id: string
  name: string
  cron: string
  kind: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  retentionSeconds: number
  createdAt: string
}

interface Backup {
  id: string
  name: string
  createdAt: string
  expiresAt: string | null
  usedMB: number
  referencedMB: number
  volumeInstanceSizeMB: number
}

interface Health {
  checked_at?: string
  overall?: {
    ok: boolean
    state: 'healthy' | 'degraded' | 'critical'
    summary: string
  }
  checks: Record<string, Check>
  infrastructure?: {
    configured: boolean
    ok: boolean | null
    detail: string
    live?: boolean
    stale?: boolean
    fetched_at?: string | null
    provider?: string
    project?: string
    environment?: string
    services: RailwayService[]
    volumes: RailwayVolume[]
    backups: {
      ok: boolean
      latest: Backup | null
      count: number
      schedules: BackupSchedule[]
    } | null
    pitr_bucket?: { ok: boolean | null; name: string | null }
    runtime: {
      service: string
      environment: string
      region: string
      deployment_id: string
      replica_id: string
      commit_sha: string
    }
    postgres: {
      ok: boolean
      latency_ms: number | null
      version: string | null
      database_size_bytes: number | null
      pitr: {
        ok: boolean | null
        archive_mode: string | null
        archived_count: number
        failed_count: number
        last_archived_at: string | null
        last_archived_wal: string | null
      }
    }
    redis: {
      ok: boolean
      latency_ms: number | null
      version: string | null
      keys: number | null
      used_memory_bytes: number | null
      connected_clients: number | null
      blocked_clients: number | null
      evicted_keys: number | null
      rejected_connections: number | null
    }
  }
  workers: {
    safe_walk_cron: {
      ok: boolean
      heartbeat_ok: boolean
      last_seen_at: string | null
      last_result: Record<string, unknown>
      overdue_check_ins: number
      overdue_escalations: number
    }
    event_reminder_cron: {
      ok: boolean
      heartbeat_ok: boolean
      last_seen_at: string | null
      last_result: Record<string, unknown>
      sample: string[]
    }
    admin_alerts?: {
      ok: boolean
      heartbeat_ok: boolean
      last_seen_at: string | null
      last_result: Record<string, unknown>
      active_critical: number
      active_warnings: number
      last_email_sent_at: string | null
      last_push_sent_at: string | null
      email_configured: boolean
      pushcut_configured: boolean
      digest_hours: number[]
      timezone: string
    }
  }
}

interface SentryMonitoring {
  configured: boolean
  period_days: number
  environment: 'production'
  projects: Record<string, { unresolved: number; events: number }>
  unresolved: number
  events: number
  by_level: Record<string, number>
  latest_seen_at: string | null
  truncated: boolean
  dashboard_url: string
}

const CHECK_LABELS: Record<string, string> = {
  apns: 'Apple Push',
  fcm: 'Firebase Cloud Messaging',
  email: 'E-Mail-Versand',
  sentry: 'Sentry',
  firebase_analytics: 'Firebase Analytics',
}

const CHECK_ICONS: Record<string, LucideIcon> = {
  apns: Smartphone,
  fcm: BellRing,
  email: Mail,
  sentry: ShieldCheck,
  firebase_analytics: Activity,
}

const CHECK_PURPOSES: Record<string, string> = {
  fcm: 'Stellt Android-Push für Chats, Treffen, Safe Walk und administrative Hinweise zu.',
}

const SERVICE_ICONS: Record<string, LucideIcon> = {
  website: Globe2,
  frontend: Cloud,
  backend: Server,
  worker: Zap,
  postgres: Database,
  redis: Radio,
}

const BACKUP_KIND_LABELS: Record<string, string> = {
  DAILY: 'Täglich',
  WEEKLY: 'Wöchentlich',
  MONTHLY: 'Monatlich',
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('de-DE') : 'Noch nicht vorhanden'
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined) return '–'
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let unit = units[0]
  for (let index = 1; size >= 1024 && index < units.length; index += 1) {
    size /= 1024
    unit = units[index]
  }
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(size)} ${unit}`
}

function shortId(value?: string | null) {
  return value ? value.slice(0, 8) : '–'
}

function StatusBadge({ ok, optional, label }: { ok: boolean | null; optional?: boolean; label?: string }) {
  if (ok === null) {
    return <Badge className="shrink-0 whitespace-nowrap bg-gray-100 text-gray-600">{label ?? 'Nicht bestätigt'}</Badge>
  }
  if (ok) {
    return <Badge className="shrink-0 whitespace-nowrap bg-green-100 text-green-700">{label ?? 'Online'}</Badge>
  }
  if (optional) {
    return <Badge className="shrink-0 whitespace-nowrap bg-amber-100 text-amber-800">{label ?? 'Optional'}</Badge>
  }
  return <Badge className="shrink-0 whitespace-nowrap bg-red-100 text-red-700">{label ?? 'Prüfen'}</Badge>
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-0.5 text-xs text-gray-500">{description}</p>
    </div>
  )
}

function ServiceCard({ service }: { service: RailwayService }) {
  const Icon = SERVICE_ICONS[service.key] ?? Server
  const directCheck = service.status === 'DIRECT'
  return (
    <div className={`rounded-xl border bg-white p-5 ${service.ok ? 'border-gray-200' : 'border-red-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`shrink-0 rounded-lg p-2 ${service.ok ? 'bg-violet-50 text-violet-600' : 'bg-red-50 text-red-600'}`}>
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-900">{service.label}</h4>
            <p className="mt-1 text-xs leading-5 text-gray-500">{service.role}</p>
          </div>
        </div>
        <StatusBadge ok={service.ok} label={service.ok && directCheck ? 'Erreichbar' : undefined} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-xs">
        {directCheck ? (
          <div className="col-span-2">
            <dt className="text-gray-400">Prüfung</dt>
            <dd className="mt-1 font-semibold text-gray-800">
              {service.key === 'website' ? 'Öffentlicher HTTPS-Health-Check' : 'Direkte Verbindung und Heartbeat'}
            </dd>
          </div>
        ) : (
          <>
            <div>
              <dt className="text-gray-400">Replicas</dt>
              <dd className="mt-1 font-semibold text-gray-800">
                {service.running_replicas} / {service.desired_replicas} aktiv
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">Deployment</dt>
              <dd className="mt-1 font-mono font-medium text-gray-700">{shortId(service.deployment_id)}</dd>
            </div>
          </>
        )}
        <div className="col-span-2">
          <dt className="text-gray-400">Quelle</dt>
          <dd className="mt-1 truncate font-medium text-gray-700" title={service.source}>{service.source}</dd>
        </div>
      </dl>
    </div>
  )
}

function IntegrationCard({ checkKey, check }: { checkKey: string; check: Check }) {
  const Icon = CHECK_ICONS[checkKey] ?? Activity
  const detail = check.detail || check.backend || (check.ok ? 'Betriebsbereit' : 'Nicht verfügbar')
  return (
    <div className={`rounded-xl border bg-white p-4 ${!check.ok && !check.optional ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-lg bg-gray-50 p-2 text-gray-600"><Icon size={16} /></span>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{CHECK_LABELS[checkKey] ?? checkKey}</h4>
            {CHECK_PURPOSES[checkKey] && <p className="mt-1 text-xs leading-5 text-gray-500">{CHECK_PURPOSES[checkKey]}</p>}
            <p className={`${CHECK_PURPOSES[checkKey] ? 'mt-2' : 'mt-1'} text-xs font-medium leading-5 text-gray-600`}>{detail}</p>
          </div>
        </div>
        <StatusBadge ok={check.ok} optional={check.optional} label={check.optional && !check.ok ? 'Optional' : undefined} />
      </div>
    </div>
  )
}

export default function HealthPage() {
  const { data: health, isLoading, error, refetch: refetchHealth, isFetching } = useQuery<Health>({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
  })
  const {
    data: sentry,
    error: sentryError,
    refetch: refetchSentry,
    isFetching: isSentryFetching,
  } = useQuery<SentryMonitoring>({
    queryKey: ['sentry-monitoring', 7],
    queryFn: () => getSentryMonitoring(7),
    refetchInterval: 300_000,
  })

  const refreshAll = () => {
    void refetchHealth()
    void refetchSentry()
  }
  const infrastructure = health?.infrastructure
  const overallState = health?.overall?.state ?? 'degraded'
  const overallOk = overallState === 'healthy'
  const overallCritical = overallState === 'critical'
  const integrationChecks = Object.entries(health?.checks ?? {}).filter(
    ([key]) => !['database', 'redis', 'website', 'admin_alerting'].includes(key),
  )
  const postgresVolume = infrastructure?.volumes.find((volume) => volume.service === 'Postgres')
  const redisVolume = infrastructure?.volumes.find((volume) => volume.service === 'Redis')
  const directServices: RailwayService[] = health ? [
    {
      key: 'website',
      name: 'hostly-website',
      label: 'Öffentliche Website',
      role: 'Stellt meet-hostly.com, Produktinformationen und Rechtstexte bereit.',
      ok: health.checks.website?.ok ?? false,
      status: 'DIRECT',
      running_replicas: 0,
      desired_replicas: 0,
      deployment_id: null,
      deployed_at: null,
      regions: [],
      source: 'https://meet-hostly.com/healthz',
    },
    {
      key: 'frontend',
      name: 'hostly_frontend',
      label: 'Admin-Frontend',
      role: 'Stellt die geschützte Verwaltungsoberfläche bereit.',
      ok: true,
      status: 'DIRECT',
      running_replicas: 0,
      desired_replicas: 0,
      deployment_id: null,
      deployed_at: null,
      regions: [],
      source: 'Diese Admin-Oberfläche',
    },
    {
      key: 'backend',
      name: 'hostly-backend',
      label: 'Backend-API',
      role: 'Verarbeitet App- und Admin-Anfragen, Authentifizierung, Events, Chats und Safe Walk.',
      ok: true,
      status: 'DIRECT',
      running_replicas: 0,
      desired_replicas: 0,
      deployment_id: infrastructure?.runtime.deployment_id || null,
      deployed_at: null,
      regions: infrastructure?.runtime.region ? [infrastructure.runtime.region] : [],
      source: 'Aktuelle Health-API',
    },
    {
      key: 'worker',
      name: 'hostly-worker',
      label: 'Hintergrund-Worker',
      role: 'Verarbeitet Safe-Walk-Zeitpunkte, Event-Erinnerungen und Betriebsalarme.',
      ok: Boolean(
        health.workers.safe_walk_cron.ok
        && health.workers.event_reminder_cron.ok
        && health.workers.admin_alerts?.ok,
      ),
      status: 'DIRECT',
      running_replicas: 0,
      desired_replicas: 0,
      deployment_id: null,
      deployed_at: null,
      regions: [],
      source: 'Drei aktuelle Worker-Heartbeats',
    },
    {
      key: 'postgres',
      name: 'Postgres',
      label: 'PostgreSQL',
      role: 'Speichert alle dauerhaften Anwendungs- und Nutzerdaten.',
      ok: infrastructure?.postgres.ok ?? health.checks.database?.ok ?? false,
      status: 'DIRECT',
      running_replicas: 0,
      desired_replicas: 0,
      deployment_id: null,
      deployed_at: null,
      regions: [],
      source: 'Direkte Datenbankabfrage',
    },
    {
      key: 'redis',
      name: 'Redis',
      label: 'Redis',
      role: 'Transportiert kurzlebige Django-Channels-Nachrichten.',
      ok: infrastructure?.redis.ok ?? health.checks.redis?.ok ?? false,
      status: 'DIRECT',
      running_replicas: 0,
      desired_replicas: 0,
      deployment_id: null,
      deployed_at: null,
      regions: [],
      source: 'Direkter Ping und INFO-Abfrage',
    },
  ] : []
  const railwayServices = infrastructure?.services ?? []
  const services = railwayServices.length
    ? [
        ...railwayServices.map((service) => service.key === 'website' ? {
          ...service,
          ok: service.ok && (health?.checks.website?.ok ?? false),
          source: service.source || 'Railway-Deployment + /healthz',
        } : service),
        ...directServices.filter(
          (directService) => directService.key === 'website'
            && !railwayServices.some((service) => service.key === 'website'),
        ),
      ]
    : directServices
  const healthyServiceCount = services.filter((service) => service.ok).length
  const backendService = services.find((service) => service.key === 'backend')
  const pitrOk = infrastructure?.postgres.pitr.ok ?? null
  const backups = infrastructure?.backups

  return (
    <div className="p-8">
      <div className="admin-page-header mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Betrieb</h2>
          <p className="mt-0.5 text-sm text-gray-500">Zentrale Live-Übersicht für Server, Datenbanken, Worker, Backups und externe Dienste</p>
        </div>
        <button
          onClick={refreshAll}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={14} className={isFetching || isSentryFetching ? 'animate-spin' : ''} /> Aktualisieren
        </button>
      </div>

      <ErrorBanner message={error ? getApiErrorMessage(error) : ''} />
      <ErrorBanner message={sentryError ? getApiErrorMessage(sentryError, 'Sentry-Diagnosestatus konnte nicht geladen werden.') : ''} />

      {isLoading || !health ? (
        <div className="text-gray-400">Betriebsstatus wird geladen...</div>
      ) : (
        <>
          <section className={`mb-6 rounded-xl border p-5 ${
            overallCritical ? 'border-red-200 bg-red-50' : overallOk ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
          }`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {overallCritical
                  ? <XCircle size={22} className="mt-0.5 text-red-600" />
                  : overallOk
                    ? <CheckCircle size={22} className="mt-0.5 text-green-600" />
                    : <CircleDashed size={22} className="mt-0.5 text-amber-600" />}
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {overallCritical ? 'Ein kritischer Dienst benötigt Aufmerksamkeit' : overallOk ? 'Alle Kernsysteme laufen' : 'Betrieb läuft mit Hinweisen'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">{health.overall?.summary ?? infrastructure?.detail}</p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>{infrastructure?.provider ?? 'Railway'} · {infrastructure?.environment || infrastructure?.runtime.environment || 'production'}</p>
                <p className="mt-1">Geprüft: {formatDate(health.checked_at)}</p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Badge className="whitespace-nowrap bg-white/70 text-green-700">
                    {healthyServiceCount}/{services.length} Services online
                  </Badge>
                  {backendService && backendService.desired_replicas > 0 && (
                    <Badge className="whitespace-nowrap bg-white/70 text-green-700">
                      {backendService.running_replicas}/{backendService.desired_replicas} Backend-Replikas
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {infrastructure?.runtime && (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-black/5 pt-4 text-xs text-gray-600">
                {infrastructure.runtime.region && <span>Region: <strong>{infrastructure.runtime.region}</strong></span>}
                {infrastructure.runtime.deployment_id && <span>Backend-Deployment: <strong className="font-mono">{shortId(infrastructure.runtime.deployment_id)}</strong></span>}
                {infrastructure.runtime.commit_sha && <span>Commit: <strong className="font-mono">{shortId(infrastructure.runtime.commit_sha)}</strong></span>}
                {infrastructure.runtime.replica_id && <span>Antwortende Replica: <strong className="font-mono">{shortId(infrastructure.runtime.replica_id)}</strong></span>}
              </div>
            )}
          </section>

          <section className="mb-7">
            <SectionTitle
              title="Railway-Services"
              description={infrastructure?.services.length
                ? 'Von Railway bestätigte Deployments und tatsächlich laufende Replica-Anzahl.'
                : 'Direkte Betriebsprüfungen halten den Status verlässlich sichtbar, während Railway-Metadaten neu geladen werden.'}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => <ServiceCard key={service.key} service={service} />)}
            </div>
            {(!infrastructure?.services.length || infrastructure.stale) && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <CircleDashed size={14} className="shrink-0" />
                <span>
                  {infrastructure?.stale
                    ? `Railway-Metadaten werden aktualisiert; angezeigt wird die letzte erfolgreiche Prüfung vom ${formatDate(infrastructure.fetched_at)}.`
                    : 'Railway-Metadaten werden neu geladen. Die grünen Zustände stammen bis dahin aus direkten Verbindungs- und Heartbeat-Prüfungen.'}
                </span>
              </div>
            )}
          </section>

          <section className="mb-7">
            <SectionTitle
              title="Datenbanken und Wiederherstellung"
              description="Direkte Live-Prüfungen von PostgreSQL, Redis, PITR, Volumes und Railway-Backups."
            />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-lg bg-blue-50 p-2 text-blue-600"><Database size={18} /></span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900">PostgreSQL</h4>
                      <p className="mt-0.5 text-xs text-gray-500">Dauerhafte Hauptdatenbank</p>
                    </div>
                  </div>
                  <StatusBadge ok={infrastructure?.postgres.ok ?? health.checks.database?.ok ?? false} />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-xs">
                  <div><dt className="text-gray-400">Antwortzeit</dt><dd className="mt-1 font-semibold text-gray-800">{infrastructure?.postgres.latency_ms ?? '–'} ms</dd></div>
                  <div><dt className="text-gray-400">Version</dt><dd className="mt-1 font-semibold text-gray-800">{infrastructure?.postgres.version ?? '–'}</dd></div>
                  <div><dt className="text-gray-400">Datenbankgröße</dt><dd className="mt-1 font-semibold text-gray-800">{formatBytes(infrastructure?.postgres.database_size_bytes)}</dd></div>
                  <div><dt className="text-gray-400">Volume</dt><dd className="mt-1 font-semibold text-gray-800">{postgresVolume ? `${postgresVolume.used_percent}% belegt` : '–'}</dd></div>
                </dl>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-lg bg-emerald-50 p-2 text-emerald-600"><Radio size={18} /></span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900">Redis</h4>
                      <p className="mt-0.5 text-xs text-gray-500">Kurzlebiger Channel-Transport</p>
                    </div>
                  </div>
                  <StatusBadge ok={infrastructure?.redis.ok ?? health.checks.redis?.ok ?? false} />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-xs">
                  <div><dt className="text-gray-400">Antwortzeit</dt><dd className="mt-1 font-semibold text-gray-800">{infrastructure?.redis.latency_ms ?? '–'} ms</dd></div>
                  <div><dt className="text-gray-400">Gespeicherte Keys</dt><dd className="mt-1 font-semibold text-gray-800">{infrastructure?.redis.keys ?? '–'}</dd></div>
                  <div><dt className="text-gray-400">Arbeitsspeicher</dt><dd className="mt-1 font-semibold text-gray-800">{formatBytes(infrastructure?.redis.used_memory_bytes)}</dd></div>
                  <div><dt className="text-gray-400">Clients / blockiert</dt><dd className="mt-1 font-semibold text-gray-800">{infrastructure?.redis.connected_clients ?? '–'} / {infrastructure?.redis.blocked_clients ?? '–'}</dd></div>
                  <div><dt className="text-gray-400">Evictions</dt><dd className="mt-1 font-semibold text-gray-800">{infrastructure?.redis.evicted_keys ?? '–'}</dd></div>
                  <div><dt className="text-gray-400">Volume</dt><dd className="mt-1 font-semibold text-gray-800">{redisVolume ? `${redisVolume.used_percent}% belegt` : '–'}</dd></div>
                </dl>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-lg bg-violet-50 p-2 text-violet-600"><Clock3 size={18} /></span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900">Point-in-time Recovery</h4>
                      <p className="mt-0.5 text-xs text-gray-500">PostgreSQL-WAL-Archivierung</p>
                    </div>
                  </div>
                  <StatusBadge ok={pitrOk} label={pitrOk ? 'Aktiv' : undefined} />
                </div>
                <dl className="mt-5 space-y-3 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-gray-400">Archivierte WAL-Segmente</dt><dd className="font-semibold text-gray-800">{infrastructure?.postgres.pitr.archived_count ?? 0}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-400">Archivfehler</dt><dd className="font-semibold text-gray-800">{infrastructure?.postgres.pitr.failed_count ?? 0}</dd></div>
                  <div><dt className="text-gray-400">Letztes Archiv</dt><dd className="mt-1 font-semibold text-gray-800">{formatDate(infrastructure?.postgres.pitr.last_archived_at)}</dd></div>
                  <div><dt className="text-gray-400">Ziel</dt><dd className="mt-1 font-semibold text-gray-800">{infrastructure?.pitr_bucket?.name ?? (pitrOk ? 'Railway PITR · WAL-Archivierung aktiv' : '–')}</dd></div>
                </dl>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-lg bg-amber-50 p-2 text-amber-600"><HardDrive size={18} /></span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900">Volume-Backups</h4>
                      <p className="mt-0.5 text-xs text-gray-500">Unabhängig von PITR</p>
                    </div>
                  </div>
                  <StatusBadge ok={backups?.ok ?? null} label={backups?.ok ? 'Gesichert' : backups ? undefined : 'Metadaten'} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {backups?.schedules.map((schedule) => (
                    <Badge key={schedule.id} className="bg-gray-100 text-gray-700">
                      {BACKUP_KIND_LABELS[schedule.kind] ?? schedule.kind}
                    </Badge>
                  ))}
                </div>
                <dl className="mt-4 space-y-3 text-xs">
                  <div><dt className="text-gray-400">Letztes Backup</dt><dd className="mt-1 font-semibold text-gray-800">{backups ? backups.latest?.name ?? 'Noch keines' : '–'}</dd></div>
                  <div><dt className="text-gray-400">Erstellt</dt><dd className="mt-1 font-semibold text-gray-800">{backups ? formatDate(backups.latest?.createdAt) : '–'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-400">Verfügbare Backups</dt><dd className="font-semibold text-gray-800">{backups?.count ?? '–'}</dd></div>
                </dl>
              </div>
            </div>
          </section>

          <section className="mb-7">
            <SectionTitle
              title="Hintergrunddienste"
              description="Die drei Aufgaben laufen gemeinsam im separaten Singleton-Service hostly-worker."
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-violet-50 p-2 text-violet-600"><Zap size={18} /></span>
                    <div><h4 className="text-sm font-semibold text-gray-900">Safe-Walk-Verarbeitung</h4><p className="mt-0.5 text-xs text-gray-500">Alle 30 Sekunden</p></div>
                  </div>
                  <StatusBadge ok={health.workers.safe_walk_cron.ok} />
                </div>
                <p className="mt-4 text-xs leading-5 text-gray-500">Check-ins, Grace Periods, Eskalationen, Einladungsablauf und sichere Datenlöschung.</p>
                <p className="mt-3 text-xs text-gray-500">Heartbeat: <strong className="text-gray-700">{formatDate(health.workers.safe_walk_cron.last_seen_at)}</strong></p>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-xs">
                  <div><dt className="text-gray-400">Check-ins fällig</dt><dd className="mt-1 text-xl font-bold text-gray-900">{health.workers.safe_walk_cron.overdue_check_ins}</dd></div>
                  <div><dt className="text-gray-400">Eskalationen fällig</dt><dd className="mt-1 text-xl font-bold text-gray-900">{health.workers.safe_walk_cron.overdue_escalations}</dd></div>
                </dl>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-blue-50 p-2 text-blue-600"><BellRing size={18} /></span>
                    <div><h4 className="text-sm font-semibold text-gray-900">Event-Erinnerungen</h4><p className="mt-0.5 text-xs text-gray-500">1 Tag und 2 Stunden vorher</p></div>
                  </div>
                  <StatusBadge ok={health.workers.event_reminder_cron.ok} />
                </div>
                <p className="mt-4 text-xs leading-5 text-gray-500">Versendet Push und E-Mail idempotent, damit kein Kanal doppelt ausgelöst wird.</p>
                <p className="mt-3 text-xs text-gray-500">Heartbeat: <strong className="text-gray-700">{formatDate(health.workers.event_reminder_cron.last_seen_at)}</strong></p>
                <div className="mt-4 rounded-lg bg-gray-50 p-3">
                  {health.workers.event_reminder_cron.sample.length === 0
                    ? <p className="text-xs text-gray-400">Keine fälligen Erinnerungen</p>
                    : health.workers.event_reminder_cron.sample.map((line) => <p key={line} className="font-mono text-xs text-gray-600">{line}</p>)}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-red-50 p-2 text-red-600"><Activity size={18} /></span>
                    <div><h4 className="text-sm font-semibold text-gray-900">Betriebsalarmierung</h4><p className="mt-0.5 text-xs text-gray-500">E-Mail und Pushcut</p></div>
                  </div>
                  <StatusBadge ok={health.workers.admin_alerts?.ok ?? false} />
                </div>
                <p className="mt-4 text-xs leading-5 text-gray-500">Meldet kritische Systemzustände sofort und versendet geplante Zusammenfassungen.</p>
                <p className="mt-3 text-xs text-gray-500">Heartbeat: <strong className="text-gray-700">{formatDate(health.workers.admin_alerts?.last_seen_at)}</strong></p>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-xs">
                  <div><dt className="text-gray-400">Kritisch / Warnungen</dt><dd className="mt-1 text-xl font-bold text-gray-900">{health.workers.admin_alerts?.active_critical ?? 0} / {health.workers.admin_alerts?.active_warnings ?? 0}</dd></div>
                  <div><dt className="text-gray-400">Kanäle</dt><dd className="mt-1 font-semibold text-gray-800">E-Mail {health.workers.admin_alerts?.email_configured ? '✓' : '–'} · Pushcut {health.workers.admin_alerts?.pushcut_configured ? '✓' : '–'}</dd></div>
                </dl>
              </div>
            </div>
          </section>

          <section className="mb-7">
            <SectionTitle
              title="Externe Dienste"
              description="Versand-, Analyse- und Diagnoseverbindungen außerhalb der Railway-Infrastruktur."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {integrationChecks.map(([key, check]) => <IntegrationCard key={key} checkKey={key} check={check} />)}
            </div>
          </section>

          {sentry && (
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-violet-50 p-2 text-violet-600"><ShieldCheck size={18} /></span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">Sentry-Fehlerdiagnose</h3>
                      <StatusBadge ok={sentry.configured} optional={!sentry.configured} label={sentry.configured ? 'Verbunden' : 'Lesezugriff fehlt'} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">Produktion · letzte {sentry.period_days} Tage · ausschließlich aggregierte Werte</p>
                  </div>
                </div>
                <a href={sentry.dashboard_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700">
                  Sentry öffnen <ExternalLink size={12} />
                </a>
              </div>
              {sentry.configured ? (
                <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div><dt className="text-xs uppercase tracking-wide text-gray-400">Offene Fehlergruppen</dt><dd className="mt-1 text-2xl font-bold text-gray-900">{sentry.unresolved}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-gray-400">Ereignisse</dt><dd className="mt-1 text-2xl font-bold text-gray-900">{sentry.events}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-gray-400">Backend / iOS</dt><dd className="mt-1 text-sm font-semibold text-gray-900">{sentry.projects['hostly-backend']?.unresolved ?? 0} / {sentry.projects['hostly-ios']?.unresolved ?? 0}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-gray-400">Letztes Ereignis</dt><dd className="mt-1 text-sm font-semibold text-gray-900">{formatDate(sentry.latest_seen_at)}</dd></div>
                </dl>
              ) : (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Für die aggregierte Fehlerübersicht fehlt noch der serverseitige Sentry-Lesetoken.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
