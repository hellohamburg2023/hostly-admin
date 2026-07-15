import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getApiErrorMessage, getAuditLogs, pageResults } from '../api'
import { formatDate } from '../adminFormat'
import { EmptyState, ErrorBanner, Pagination } from '../adminUi'
import { Search } from 'lucide-react'

interface AuditLog {
  id: number
  actor_id: number | null
  actor_email: string
  actor_display: string
  action: string
  target_type: string
  target_id: string
  target_repr: string
  ip_address: string
  metadata: Record<string, unknown>
  created_at: string
}

interface Page<T> {
  results?: T[]
  next?: string | null
  previous?: string | null
}

function targetUrl(log: AuditLog) {
  if (log.target_type === 'user' && log.target_id) return `/users/${log.target_id}`
  if (log.target_type === 'event' && log.target_id) return `/events/${log.target_id}`
  if (log.target_type === 'report' && log.target_id) return `/reports/${log.target_id}`
  return ''
}

export default function AuditLogsPage() {
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [targetId, setTargetId] = useState('')
  const [actor, setActor] = useState('')
  const [cursor, setCursor] = useState('')

  const params: Record<string, string> = {}
  if (action) params.action = action
  if (targetType) params.target_type = targetType
  if (targetId) params.target_id = targetId
  if (actor) params.actor = actor
  if (cursor) params.cursor = cursor

  const { data, isLoading, error } = useQuery<Page<AuditLog> | AuditLog[]>({
    queryKey: ['audit-logs', action, targetType, targetId, actor, cursor],
    queryFn: () => getAuditLogs(params),
  })
  const logs = pageResults<AuditLog>(data)
  const page = data && !Array.isArray(data) ? data : undefined

  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setCursor('')
  }

  return (
    <div className="p-8">
      <div className="admin-page-header flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Audit-Log</h2>
          <p className="text-sm text-gray-500 mt-0.5">Admin-Aktionen, Login-Fehler und Moderationsentscheidungen</p>
        </div>
        <span className="text-sm text-gray-500">{logs.length} angezeigt</span>
      </div>

      <ErrorBanner message={error ? getApiErrorMessage(error) : ''} />

      <div className="admin-filters flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={action}
            onChange={(event) => setFilter(setAction, event.target.value)}
            placeholder="Action"
            className="w-56 pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={targetType}
          onChange={(event) => setFilter(setTargetType, event.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Ziele</option>
          <option value="user">User</option>
          <option value="event">Event</option>
          <option value="report">Report</option>
          <option value="profile">Profile</option>
        </select>
        <input
          value={targetId}
          onChange={(event) => setFilter(setTargetId, event.target.value)}
          placeholder="Target-ID"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <input
          value={actor}
          onChange={(event) => setFilter(setActor, event.target.value)}
          placeholder="Actor-ID"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {isLoading ? (
        <div className="text-gray-400">Laden...</div>
      ) : logs.length === 0 ? (
        <EmptyState>Keine Audit-Einträge gefunden</EmptyState>
      ) : (
        <div className="admin-table overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[850px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Zeit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktion</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ziel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">IP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => {
                const url = targetUrl(log)
                return (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(log.created_at, true)}</td>
                    <td className="px-4 py-3">
                      {log.actor_id ? (
                        <Link to={`/users/${log.actor_id}`} className="text-gray-700 hover:text-violet-700">
                          {log.actor_display || log.actor_email}
                        </Link>
                      ) : (
                        <span className="text-gray-500">{log.actor_email || 'System'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{log.action}</td>
                    <td className="px-4 py-3">
                      {url ? (
                        <Link to={url} className="text-gray-700 hover:text-violet-700">
                          {log.target_type}:{log.target_id}
                        </Link>
                      ) : (
                        <span className="text-gray-500">{log.target_type || '-'}</span>
                      )}
                      {log.target_repr && <p className="text-xs text-gray-400">{log.target_repr}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{log.ip_address || '-'}</td>
                    <td className="px-4 py-3">
                      <pre className="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-gray-500">
                        {JSON.stringify(log.metadata)}
                      </pre>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination data={page} onCursor={setCursor} />
    </div>
  )
}
