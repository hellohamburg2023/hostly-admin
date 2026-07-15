import { useQuery } from '@tanstack/react-query'
import { getAnalytics, getStats } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line,
} from 'recharts'
import { Users, CalendarDays, AlertTriangle, TrendingUp, Activity, Footprints } from 'lucide-react'

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

function weekLabel(value: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<Stats>({ queryKey: ['stats'], queryFn: getStats })
  const { data: analytics } = useQuery<Analytics>({ queryKey: ['analytics'], queryFn: getAnalytics })

  if (isLoading) return <div className="p-8 text-gray-400">Lade Statistiken...</div>
  if (!data) return null

  const eventChartData = Object.entries(data.events.by_status).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    count,
    status,
  }))
  const userGrowth = analytics?.users_by_week.map((row) => ({ ...row, label: weekLabel(row.period) })) ?? []
  const eventGrowth = analytics?.events_by_week.map((row) => ({ ...row, label: weekLabel(row.period) })) ?? []
  const cityData = analytics?.users_by_city.map((row) => ({ ...row, city: row.city || 'Ohne Stadt' })) ?? []
  const liveSafetySessions = ['ready', 'active', 'arrival_due', 'grace_period', 'escalated']
    .reduce((sum, status) => sum + (data.safe_walks[status] ?? 0), 0)

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <KPI icon={Users} label="Nutzer gesamt" value={data.users.total} sub={`${data.users.active} aktiv · ${data.users.deleted} gelöscht`} color="violet" />
        <KPI icon={Activity} label="Aktiv 7 Tage" value={data.users.active_7d} sub={`${data.users.active_30d} in 30 Tagen`} color="green" />
        <KPI icon={TrendingUp} label="Neu diese Woche" value={data.users.new_this_week} sub={`${data.users.new_this_month} diesen Monat`} color="blue" />
        <KPI icon={CalendarDays} label="Events gesamt" value={data.events.total} color="green" />
        <KPI icon={AlertTriangle} label="Offene Meldungen" value={data.reports.open} sub={`${data.reports.reviewing} in Prüfung`} color="red" />
        <KPI icon={Footprints} label="Safety Sessions live" value={liveSafetySessions} sub={`${analytics?.safe_walks.needs_attention ?? data.safe_walks.escalated ?? 0} mit Handlungsbedarf`} color="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Aktivität nach Tagen</h3>
          <div className="space-y-3">
            {[
              { label: 'Heute aktiv', value: data.users.active_1d, color: 'bg-green-500' },
              { label: '7 Tage aktiv', value: data.users.active_7d, color: 'bg-blue-500' },
              { label: '30 Tage aktiv', value: data.users.active_30d, color: 'bg-violet-500' },
              { label: 'Über 30 Tage inaktiv', value: data.users.inactive_over_30d, color: 'bg-amber-500' },
              { label: 'Nie aktiv', value: data.users.never_active, color: 'bg-gray-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct(value, data.users.total)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nutzerwachstum pro Woche</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={userGrowth}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nutzer pro Stadt</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cityData} layout="vertical" margin={{ left: 16 }}>
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="city" width={90} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Events nach Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={eventChartData} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {eventChartData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#7c3aed'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Neue Events pro Woche</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={eventGrowth}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
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
