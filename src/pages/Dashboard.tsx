import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getAnalytics, getApiErrorMessage, getProductAnalytics, getStats } from '../api'
import { ErrorBanner } from '../adminUi'
import {
  Area, AreaChart, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Users, CalendarDays, AlertTriangle, TrendingUp, Activity, Footprints, Wifi } from 'lucide-react'

interface Stats {
  users: {
    total: number
    active: number
    new_this_week: number
    new_this_month: number
    active_1d: number
    active_7d: number
    active_30d: number
    inactive_over_30d: number
    never_active: number
    online_now: number
    online_window_minutes: number
    deleted: number
  }
  events: { total: number; by_status: Record<string, number> }
  profiles: { pending_verification: number; verified: number }
  reports: { open: number; reviewing: number }
  ideas: { total: number }
  safe_walks: Record<string, number>
}

interface Analytics {
  users_by_week: { period: string; count: number }[]
  users_by_city: { city: string; count: number }[]
  events_by_week: { period: string; count: number }[]
  requests: { total: number; accepted: number; acceptance_rate: number }
  reports_by_event: { event_id: number; event__title: string; count: number }[]
  reports_by_user: { reported_user_id: number; reported_user__email: string; count: number }[]
  verification: { total: number; verified: number; pending: number; rate: number }
  safe_walks: { total: number; active: number; escalated: number; needs_attention: number; safe_walk: number; meeting_safety: number; escalation_rate: number }
}

interface ProductActivityAnalytics {
  configured: boolean
  activity_patterns?: {
    period_days: number
    by_hour: { hour: number; label: string; average_active_users: number }[]
    by_weekday: { weekday: number; label: string; average_active_users: number }[]
  }
}

const STATUS_COLORS: Record<string, string> = {
  open: '#16a34a',
  full: '#2563eb',
  draft: '#94a3b8',
  cancelled: '#dc2626',
  completed: '#7c3aed',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  full: 'Voll',
  draft: 'Entwurf',
  cancelled: 'Abgesagt',
  completed: 'Abgeschlossen',
}

const STATUS_ORDER = ['open', 'full', 'draft', 'completed', 'cancelled']
const AXIS_COLOR = '#94a3b8'
const GRID_COLOR = '#e2e8f0'
const TOOLTIP_STYLE = {
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  color: '#334155',
  fontSize: '12px',
}

function KPI({ icon: Icon, label, value, sub, color = 'violet' }: { icon: React.ElementType; label: string; value: number | string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, description, meta, children }: { title: string; description: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-400">{description}</p>
        </div>
        {meta && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500">{meta}</span>}
      </div>
      {children}
    </section>
  )
}

function ChartState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-60 items-center justify-center rounded-lg bg-gray-50 text-center text-sm text-gray-400">
      {children}
    </div>
  )
}

function weekLabel(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0
}

function cityTick(value: string) {
  return value.length > 14 ? `${value.slice(0, 13)}…` : value
}

function hasValues(data: { count: number }[]) {
  return data.some((row) => Number.isFinite(row.count) && row.count > 0)
}

export default function Dashboard() {
  const { data, isLoading, error: statsError } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: 30_000,
  })
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
    error: analyticsError,
  } = useQuery<Analytics>({ queryKey: ['analytics'], queryFn: getAnalytics })
  const {
    data: productActivity,
    isLoading: isProductActivityLoading,
    error: productActivityError,
  } = useQuery<ProductActivityAnalytics>({
    queryKey: ['product-analytics', 90],
    queryFn: () => getProductAnalytics(90),
    staleTime: 10 * 60_000,
  })

  if (isLoading) return <div className="p-8 text-gray-400">Lade Statistiken...</div>
  if (statsError || !data) {
    return (
      <div className="p-8">
        <ErrorBanner message={getApiErrorMessage(statsError)} />
      </div>
    )
  }

  const statusEntries = Object.entries(data.events.by_status)
  const orderedStatuses = [
    ...STATUS_ORDER.filter((status) => status in data.events.by_status),
    ...statusEntries.map(([status]) => status).filter((status) => !STATUS_ORDER.includes(status)),
  ]
  const eventChartData = orderedStatuses.map((status) => ({
    name: STATUS_LABELS[status] || status,
    count: Number(data.events.by_status[status]) || 0,
    status,
  }))
  const userGrowth = analytics?.users_by_week
    .map((row) => ({ ...row, count: Number(row.count) || 0, label: weekLabel(row.period) }))
    .filter((row) => row.label !== '-') ?? []
  const eventGrowth = analytics?.events_by_week
    .map((row) => ({ ...row, count: Number(row.count) || 0, label: weekLabel(row.period) }))
    .filter((row) => row.label !== '-') ?? []
  const cityData = analytics?.users_by_city
    .map((row) => ({ ...row, count: Number(row.count) || 0, city: row.city?.trim() || 'Ohne Stadt' }))
    .filter((row) => row.count > 0)
    .slice(0, 8) ?? []
  const liveSafetySessions = ['ready', 'active', 'arrival_due', 'grace_period', 'escalated']
    .reduce((sum, status) => sum + (data.safe_walks[status] ?? 0), 0)
  const activityByHour = productActivity?.activity_patterns?.by_hour.map((row) => ({
    ...row,
    count: Number(row.average_active_users) || 0,
  })) ?? []
  const activityByWeekday = productActivity?.activity_patterns?.by_weekday.map((row) => ({
    ...row,
    count: Number(row.average_active_users) || 0,
  })) ?? []
  const busiestWeekday = Math.max(0, ...activityByWeekday.map((row) => row.count))
  const activityPatternState = productActivityError
    ? 'Firebase-Aktivitätsdaten konnten nicht geladen werden.'
    : productActivity?.configured === false
      ? (
          <span>
            Firebase/GA4 ist noch nicht verbunden.{' '}
            <Link to="/product-analytics" className="font-medium text-violet-600 hover:text-violet-700">Jetzt einrichten</Link>
          </span>
        )
      : 'Für diesen Zeitraum liegen noch keine Firebase-Aktivitätsdaten vor.'
  const analyticsStateMessage = analyticsError
    ? 'Analytics-Daten konnten nicht geladen werden.'
    : 'Für diesen Zeitraum liegen noch keine Daten vor.'

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <ErrorBanner message={analyticsError ? getApiErrorMessage(analyticsError) : ''} />

      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4 xl:grid-cols-7">
        <KPI icon={Users} label="Nutzer gesamt" value={data.users.total} sub={`${data.users.active} aktiv · ${data.users.deleted} gelöscht`} color="violet" />
        <KPI icon={Wifi} label="Online jetzt" value={data.users.online_now ?? 0} sub={`Aktivität in den letzten ${data.users.online_window_minutes ?? 5} Min.`} color="green" />
        <KPI icon={Activity} label="Aktiv 7 Tage" value={data.users.active_7d} sub={`${data.users.active_30d} in 30 Tagen`} color="green" />
        <KPI icon={TrendingUp} label="Neu diese Woche" value={data.users.new_this_week} sub={`${data.users.new_this_month} diesen Monat`} color="blue" />
        <KPI icon={CalendarDays} label="Events gesamt" value={data.events.total} color="green" />
        <KPI icon={AlertTriangle} label="Offene Meldungen" value={data.reports.open} sub={`${data.reports.reviewing} in Prüfung`} color="red" />
        <KPI icon={Footprints} label="Safety Sessions live" value={liveSafetySessions} sub={`${analytics?.safe_walks.needs_attention ?? data.safe_walks.escalated ?? 0} mit Handlungsbedarf`} color="amber" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Online nach Uhrzeit" description="Ø aktive Nutzer je Stunde · Firebase/GA4 mit Analytics-Einwilligung" meta="90 Tage">
          {isProductActivityLoading ? (
            <ChartState>Firebase-Aktivität wird geladen…</ChartState>
          ) : hasValues(activityByHour) ? (
            <div className="h-60 w-full" role="img" aria-label="Balkendiagramm der durchschnittlich aktiven Nutzer nach Uhrzeit">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityByHour} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickMargin={10} interval={2} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={36} />
                  <Tooltip separator=": " contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f8fafc' }} labelStyle={{ color: '#64748b', marginBottom: 4 }} />
                  <Bar name="Ø aktive Nutzer" dataKey="count" fill="#7c3aed" radius={[5, 5, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartState>{activityPatternState}</ChartState>
          )}
        </ChartCard>

        <ChartCard title="Online nach Wochentag" description="Ø täglich aktive Nutzer · Firebase/GA4 mit Analytics-Einwilligung" meta="90 Tage">
          {isProductActivityLoading ? (
            <ChartState>Firebase-Aktivität wird geladen…</ChartState>
          ) : hasValues(activityByWeekday) ? (
            <div className="h-60 w-full" role="img" aria-label="Balkendiagramm der durchschnittlich aktiven Nutzer nach Wochentag">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityByWeekday} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={36} />
                  <Tooltip separator=": " contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f8fafc' }} labelStyle={{ color: '#64748b', marginBottom: 4 }} />
                  <Bar name="Ø aktive Nutzer" dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={42}>
                    {activityByWeekday.map((entry) => (
                      <Cell key={entry.weekday} fill={entry.count === busiestWeekday ? '#7c3aed' : '#c4b5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartState>{activityPatternState}</ChartState>
          )}
        </ChartCard>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartCard title="Nutzeraktivität" description="Aktive und inaktive Konten im Verhältnis zur Gesamtzahl" meta={`${data.users.total} gesamt`}>
          <div className="space-y-3">
            {[
              { label: 'Heute aktiv', value: data.users.active_1d, color: 'bg-green-500' },
              { label: '7 Tage aktiv', value: data.users.active_7d, color: 'bg-blue-500' },
              { label: '30 Tage aktiv', value: data.users.active_30d, color: 'bg-violet-500' },
              { label: 'Über 30 Tage inaktiv', value: data.users.inactive_over_30d, color: 'bg-amber-500' },
              { label: 'Nie aktiv', value: data.users.never_active, color: 'bg-gray-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="text-gray-600">{label}</span>
                  <span className="shrink-0 font-medium tabular-nums text-gray-900">{value} <span className="font-normal text-gray-400">· {pct(value, data.users.total)}%</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={data.users.total} aria-valuenow={value}>
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${color}`}
                    style={{ width: `${value > 0 ? Math.max(2, pct(value, data.users.total)) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Nutzerwachstum" description="Neue Konten pro Kalenderwoche" meta="12 Wochen">
          {isAnalyticsLoading ? (
            <ChartState>Diagrammdaten werden geladen…</ChartState>
          ) : hasValues(userGrowth) ? (
            <div className="h-60 w-full" role="img" aria-label="Flächendiagramm der neuen Nutzer pro Woche">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowth} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="userGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickMargin={10} minTickGap={24} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={36} />
                  <Tooltip separator=": " contentStyle={TOOLTIP_STYLE} cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }} labelStyle={{ color: '#64748b', marginBottom: 4 }} />
                  <Area name="Neue Nutzer" type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} fill="url(#userGrowthGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartState>{analyticsStateMessage}</ChartState>
          )}
        </ChartCard>

        <ChartCard title="Nutzer nach Stadt" description="Städte mit den meisten Profilen" meta="Top 8">
          {isAnalyticsLoading ? (
            <ChartState>Diagrammdaten werden geladen…</ChartState>
          ) : hasValues(cityData) ? (
            <div className="h-60 w-full" role="img" aria-label="Balkendiagramm der Nutzer nach Stadt">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityData} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                  <YAxis type="category" dataKey="city" width={98} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={cityTick} />
                  <Tooltip separator=": " contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f8fafc' }} labelStyle={{ color: '#64748b', marginBottom: 4 }} />
                  <Bar name="Nutzer" dataKey="count" fill="#16a34a" radius={[0, 5, 5, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartState>{analyticsStateMessage}</ChartState>
          )}
        </ChartCard>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Events nach Status" description="Aktueller Event-Bestand nach Lebenszyklus" meta={`${data.events.total} gesamt`}>
          {hasValues(eventChartData) ? (
            <div className="h-60 w-full" role="img" aria-label="Balkendiagramm der Events nach Status">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventChartData} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={96} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip separator=": " contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f8fafc' }} labelStyle={{ color: '#64748b', marginBottom: 4 }} />
                  <Bar name="Events" dataKey="count" radius={[0, 5, 5, 0]} maxBarSize={24}>
                    {eventChartData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#7c3aed'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartState>Noch keine Events vorhanden.</ChartState>
          )}
        </ChartCard>

        <ChartCard title="Event-Wachstum" description="Neu erstellte Events pro Kalenderwoche" meta="12 Wochen">
          {isAnalyticsLoading ? (
            <ChartState>Diagrammdaten werden geladen…</ChartState>
          ) : hasValues(eventGrowth) ? (
            <div className="h-60 w-full" role="img" aria-label="Flächendiagramm der neu erstellten Events pro Woche">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={eventGrowth} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eventGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickMargin={10} minTickGap={24} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} width={36} />
                  <Tooltip separator=": " contentStyle={TOOLTIP_STYLE} cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }} labelStyle={{ color: '#64748b', marginBottom: 4 }} />
                  <Area name="Neue Events" type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2.5} fill="url(#eventGrowthGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartState>{analyticsStateMessage}</ChartState>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Join-Requests</h3>
          <p className="text-2xl font-bold text-gray-900">{analytics?.requests.acceptance_rate ?? 0}%</p>
          <p className="text-xs text-gray-500">{analytics?.requests.accepted ?? 0} von {analytics?.requests.total ?? 0} angenommen</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Verifizierungsquote</h3>
          <p className="text-2xl font-bold text-gray-900">{analytics?.verification.rate ?? 0}%</p>
          <p className="text-xs text-gray-500">{analytics?.verification.verified ?? data.profiles.verified} verifiziert · {analytics?.verification.pending ?? data.profiles.pending_verification} offen</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Safe-Walk-Nutzung</h3>
          <p className="text-2xl font-bold text-gray-900">{analytics?.safe_walks.total ?? 0}</p>
          <p className="text-xs text-gray-500">{analytics?.safe_walks.meeting_safety ?? 0} Meeting Safety · {analytics?.safe_walks.escalation_rate ?? 0}% Eskalationen</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ideen</h3>
          <p className="text-2xl font-bold text-gray-900">{data.ideas.total}</p>
          <p className="text-xs text-gray-500">aus der mobilen Ideen-Funktion</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Reports pro Event</h3>
          <div className="space-y-2">
            {(analytics?.reports_by_event ?? []).map((row) => (
              <div key={row.event_id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-gray-600">{row.event__title || `Event ${row.event_id}`}</span>
                <span className="font-semibold text-gray-900">{row.count}</span>
              </div>
            ))}
            {(analytics?.reports_by_event ?? []).length === 0 && <p className="text-sm text-gray-400">Keine Event-Meldungen</p>}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Reports pro Nutzer</h3>
          <div className="space-y-2">
            {(analytics?.reports_by_user ?? []).map((row) => (
              <div key={row.reported_user_id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-gray-600">{row.reported_user__email || `Nutzer ${row.reported_user_id}`}</span>
                <span className="font-semibold text-gray-900">{row.count}</span>
              </div>
            ))}
            {(analytics?.reports_by_user ?? []).length === 0 && <p className="text-sm text-gray-400">Keine Nutzer-Meldungen</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
