import { useQuery } from '@tanstack/react-query'
import { getStats } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Users, CalendarDays, AlertTriangle, ShieldCheck, Lightbulb, TrendingUp } from 'lucide-react'

interface Stats {
  users: { total: number; active: number; new_this_week: number; new_this_month: number }
  events: { total: number; by_status: Record<string, number> }
  profiles: { pending_verification: number; verified: number }
  reports: { open: number; reviewing: number }
  ideas: { total: number }
}

const STATUS_COLORS: Record<string, string> = {
  open: '#8b5cf6', full: '#3b82f6', draft: '#94a3b8', cancelled: '#ef4444', completed: '#10b981',
}
const STATUS_LABELS: Record<string, string> = {
  open: 'Offen', full: 'Voll', draft: 'Entwurf', cancelled: 'Abgesagt', completed: 'Abgeschlossen',
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

export default function Dashboard() {
  const { data, isLoading } = useQuery<Stats>({ queryKey: ['stats'], queryFn: getStats })

  if (isLoading) return <div className="p-8 text-gray-400">Lade Statistiken…</div>
  if (!data) return null

  const eventChartData = Object.entries(data.events.by_status).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    count,
    status,
  }))

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <KPI icon={Users} label="Nutzer gesamt" value={data.users.total} sub={`${data.users.active} aktiv`} color="violet" />
        <KPI icon={TrendingUp} label="Neu diese Woche" value={data.users.new_this_week} sub={`${data.users.new_this_month} diesen Monat`} color="blue" />
        <KPI icon={CalendarDays} label="Events gesamt" value={data.events.total} color="green" />
        <KPI icon={ShieldCheck} label="Verifizierung ausstehend" value={data.profiles.pending_verification} sub={`${data.profiles.verified} verifiziert`} color="amber" />
        <KPI icon={AlertTriangle} label="Offene Meldungen" value={data.reports.open} sub={`${data.reports.reviewing} in Prüfung`} color="red" />
        <KPI icon={Lightbulb} label="Ideen" value={data.ideas.total} color="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Events nach Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={eventChartData} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {eventChartData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#8b5cf6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nutzer-Übersicht</h3>
          <div className="space-y-3">
            {[
              { label: 'Gesamt', value: data.users.total, pct: 100, color: 'bg-violet-500' },
              { label: 'Aktiv', value: data.users.active, pct: Math.round(data.users.active / data.users.total * 100) || 0, color: 'bg-green-500' },
              { label: 'Verifizierte Profile', value: data.profiles.verified, pct: Math.round(data.profiles.verified / data.users.total * 100) || 0, color: 'bg-blue-500' },
              { label: 'Verifizierung ausstehend', value: data.profiles.pending_verification, pct: Math.round(data.profiles.pending_verification / data.users.total * 100) || 0, color: 'bg-amber-500' },
            ].map(({ label, value, pct, color }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
