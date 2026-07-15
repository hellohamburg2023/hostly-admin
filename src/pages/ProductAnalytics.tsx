import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, CalendarCheck, MousePointerClick, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { getApiErrorMessage, getProductAnalytics } from '../api'
import { ErrorBanner } from '../adminUi'
import { formatDate } from '../adminFormat'

interface ProductAnalytics {
  configured: boolean
  days: number
  refreshed_at?: string
  required_settings?: string[]
  summary?: { active_users: number; sessions: number; events: number }
  events?: { event_name: string; label: string; count: number; users: number }[]
  daily?: ({ date: string; total: number } & Record<string, number | string>)[]
  ratios?: { onboarding_per_signup: number; join_request_per_event_view: number }
  privacy_note?: string
}

function KPI({ label, value, sub, icon: Icon }: { label: string; value: number | string; sub: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
        </div>
        <div className="rounded-lg bg-violet-50 p-2 text-violet-600"><Icon size={18} /></div>
      </div>
    </div>
  )
}

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export default function ProductAnalyticsPage() {
  const [days, setDays] = useState(30)
  const { data, isLoading, error, refetch, isFetching } = useQuery<ProductAnalytics>({
    queryKey: ['product-analytics', days],
    queryFn: () => getProductAnalytics(days),
    staleTime: 5 * 60_000,
  })

  const daily = (data?.daily ?? []).map((row) => ({ ...row, label: dateLabel(String(row.date)) }))
  const events = [...(data?.events ?? [])].sort((a, b) => b.count - a.count)

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Firebase Produkt-Analytics</h2>
          <p className="mt-0.5 text-sm text-gray-500">Pseudonyme Nutzungssignale der iOS-App über die Google Analytics Data API</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value={7}>7 Tage</option>
            <option value={30}>30 Tage</option>
            <option value={90}>90 Tage</option>
          </select>
          <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Aktualisieren
          </button>
        </div>
      </div>

      <ErrorBanner message={error ? getApiErrorMessage(error) : ''} />

      {isLoading ? (
        <div className="text-gray-400">Firebase-Auswertung wird geladen...</div>
      ) : data?.configured === false ? (
        <div className="max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <Activity size={20} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <h3 className="font-semibold text-amber-950">Firebase Analytics ist in der App aktiv, der Admin-Lesezugriff ist noch nicht verbunden.</h3>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                Aktiviere im Google-Cloud-Projekt die Analytics Data API, gib einem Service Account Leserechte auf die GA4-Property und hinterlege im Backend die folgenden Railway-Variablen:
              </p>
              <div className="mt-3 rounded-lg bg-white/70 p-3 font-mono text-xs text-amber-950">
                {(data.required_settings ?? ['GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_JSON']).map((setting) => <p key={setting}>{setting}</p>)}
              </div>
              <p className="mt-3 text-xs text-amber-800">Der Service-Account-Schlüssel bleibt ausschließlich im Backend und wird nie an den Browser ausgeliefert.</p>
            </div>
          </div>
        </div>
      ) : data?.configured ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KPI icon={Users} label="Aktive Nutzer" value={data.summary?.active_users ?? 0} sub={`letzte ${data.days} Tage`} />
            <KPI icon={Activity} label="Sitzungen" value={data.summary?.sessions ?? 0} sub="Firebase Sessions" />
            <KPI icon={MousePointerClick} label="Ereignisse" value={data.summary?.events ?? 0} sub="alle Analytics-Ereignisse" />
            <KPI icon={CalendarCheck} label="Onboarding-Quote" value={`${data.ratios?.onboarding_per_signup ?? 0}%`} sub="Abschlüsse je Registrierung" />
            <KPI icon={MousePointerClick} label="Join-Quote" value={`${data.ratios?.join_request_per_event_view ?? 0}%`} sub="Join-Anfragen je Event-Aufruf" />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 xl:col-span-2">
              <h3 className="mb-1 text-sm font-semibold text-gray-700">Produktaktivität pro Tag</h3>
              <p className="mb-4 text-xs text-gray-400">Aktivierung, Event-Angebot, Matching und Safety-Nutzung</p>
              <ResponsiveContainer width="100%" height={310}>
                <LineChart data={daily} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line name="Registrierungen" type="monotone" dataKey="sign_up" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line name="Onboardings" type="monotone" dataKey="onboarding_complete" stroke="#16a34a" strokeWidth={2} dot={false} />
                  <Line name="Event erstellt" type="monotone" dataKey="event_create" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  <Line name="Safety gestartet" type="monotone" dataKey="safe_walk_start" stroke="#dc2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 text-sm font-semibold text-gray-700">Ereignisvolumen</h3>
              <p className="mb-4 text-xs text-gray-400">Kontrollierte Hostly-Ereignisse</p>
              <ResponsiveContainer width="100%" height={310}>
                <BarChart data={events.slice(0, 7)} layout="vertical" margin={{ left: 18 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={118} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Ereignisse" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Produkt-Ereignis</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Ereignisse</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Nutzer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map((event) => (
                  <tr key={event.event_name}>
                    <td className="px-4 py-3"><p className="font-medium text-gray-900">{event.label}</p><p className="font-mono text-xs text-gray-400">{event.event_name}</p></td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{event.count}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{event.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <div className="flex items-start gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0" /><p>{data.privacy_note}</p></div>
            <p className="shrink-0 text-xs text-green-700">Stand {formatDate(data.refreshed_at, true)}</p>
          </div>
        </>
      ) : null}
    </div>
  )
}
