import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getReports, patchReport } from '../api'

interface Report {
  id: number
  reason: string
  details: string
  status: string
  created_at: string
  reporter_id: number
  reporter_email: string
  reporter_username: string
  reported_user_id: number | null
  reported_user_email: string | null
  event_id: number | null
  event_title: string | null
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  reviewing: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-500',
}

const STATUS_DE: Record<string, string> = {
  open: 'Offen', reviewing: 'In Prüfung', resolved: 'Gelöst', dismissed: 'Abgewiesen',
}

const NEXT_ACTIONS: Record<string, { label: string; status: string; style: string }[]> = {
  open: [{ label: 'In Prüfung nehmen', status: 'reviewing', style: 'border-amber-300 text-amber-700 hover:bg-amber-50' }],
  reviewing: [
    { label: 'Lösen', status: 'resolved', style: 'border-green-300 text-green-700 hover:bg-green-50' },
    { label: 'Abweisen', status: 'dismissed', style: 'border-gray-300 text-gray-600 hover:bg-gray-50' },
  ],
}

export default function ReportsPage() {
  const [statusFilter, setStatusFilter] = useState('open')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['reports', statusFilter],
    queryFn: () => getReports(statusFilter ? { status: statusFilter } : undefined),
  })
  const reports: Report[] = data?.results ?? data ?? []

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => patchReport(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Meldungen</h2>
        <span className="text-sm text-gray-500">{reports.length} Einträge</span>
      </div>

      <div className="flex gap-2 mb-5">
        {(['', 'open', 'reviewing', 'resolved', 'dismissed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s ? STATUS_DE[s] : 'Alle'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-gray-400">Laden…</div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {STATUS_DE[r.status]}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('de-DE')}</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm mb-0.5">{r.reason}</p>
                  {r.details && <p className="text-sm text-gray-600 mb-2">{r.details}</p>}
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>Von: <span className="text-gray-700">{r.reporter_username}</span> ({r.reporter_email})</p>
                    {r.reported_user_email && <p>Gemeldet: <span className="text-gray-700">{r.reported_user_email}</span></p>}
                    {r.event_title && <p>Event: <span className="text-gray-700">{r.event_title}</span></p>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {(NEXT_ACTIONS[r.status] || []).map((action) => (
                    <button
                      key={action.status}
                      onClick={() => mutation.mutate({ id: r.id, status: action.status })}
                      className={`text-xs border px-3 py-1.5 rounded-lg font-medium transition-colors ${action.style}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              Keine Meldungen in dieser Kategorie
            </div>
          )}
        </div>
      )}
    </div>
  )
}
