import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, CalendarCheck, ExternalLink, MousePointerClick, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { getApiErrorMessage, getProductAnalytics } from '../api'
import { Badge, ErrorBanner } from '../adminUi'
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
      <div className="admin-page-header mb-6 flex flex-wrap items-start justify-between gap-4">
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
        <div className="max-w-4xl overflow-hidden rounded-xl border border-amber-200 bg-white">
          <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 p-5">
            <Activity size={20} className="mt-0.5 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-amber-950">Admin-Auswertung einrichten</h3>
                <Badge className="bg-amber-100 text-amber-800">Firebase-Projekt hostly-50833</Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-amber-900">Die iOS-App sendet bereits freigegebene Analytics-Ereignisse. Für dieses Dashboard fehlt nur der schreibgeschützte Zugriff auf die GA4-Property.</p>
            </div>
          </div>
          <ol className="grid gap-4 p-5 md:grid-cols-3">
            <li className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Schritt 1</p>
              <h4 className="mt-1 text-sm font-semibold text-gray-900">Data API aktivieren</h4>
              <p className="mt-1 text-xs leading-5 text-gray-500">Im Google-Cloud-Projekt <span className="font-medium text-gray-700">hostly-50833</span> die Google Analytics Data API einschalten.</p>
              <a className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700" href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=hostly-50833" target="_blank" rel="noreferrer">API öffnen <ExternalLink size={12} /></a>
            </li>
            <li className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Schritt 2</p>
              <h4 className="mt-1 text-sm font-semibold text-gray-900">Lesezugriff vergeben</h4>
              <p className="mt-1 text-xs leading-5 text-gray-500">Service Account erstellen und seine E-Mail in der GA4-Property mit der Rolle <span className="font-medium text-gray-700">Betrachter</span> hinzufügen.</p>
              <a className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700" href="https://console.cloud.google.com/iam-admin/serviceaccounts?project=hostly-50833" target="_blank" rel="noreferrer">Service Accounts <ExternalLink size={12} /></a>
            </li>
            <li className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Schritt 3</p>
              <h4 className="mt-1 text-sm font-semibold text-gray-900">Railway verbinden</h4>
              <p className="mt-1 text-xs leading-5 text-gray-500">Im Backend-Service die numerische Property-ID und den vollständigen JSON-Schlüssel hinterlegen.</p>
              <div className="mt-3 space-y-1 rounded-md bg-gray-50 p-2 font-mono text-[11px] text-gray-700">
                {(data.required_settings ?? ['GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_JSON']).map((setting) => <p key={setting} className="break-all">{setting}</p>)}
              </div>
            </li>
          </ol>
          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Der Service-Account-Schlüssel bleibt ausschließlich im Backend und wird niemals an den Browser ausgeliefert.</div>
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

          <div className="admin-table mb-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[520px] text-sm">
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

          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 sm:flex-row">
            <div className="flex items-start gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0" /><p>{data.privacy_note}</p></div>
            <p className="shrink-0 text-xs text-green-700">Stand {formatDate(data.refreshed_at, true)}</p>
          </div>
        </>
      ) : null}
    </div>
  )
}
