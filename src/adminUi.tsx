import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cursorFromUrl } from './api'

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
      {message}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
      {children}
    </div>
  )
}

export function Pagination({
  data,
  onCursor,
}: {
  data?: { next?: string | null; previous?: string | null }
  onCursor: (cursor: string) => void
}) {
  const previous = cursorFromUrl(data?.previous)
  const next = cursorFromUrl(data?.next)
  if (!previous && !next) return null
  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <button
        type="button"
        disabled={!previous}
        onClick={() => onCursor(previous)}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
      >
        <ChevronLeft size={14} /> Zurück
      </button>
      <button
        type="button"
        disabled={!next}
        onClick={() => onCursor(next)}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
      >
        Weiter <ChevronRight size={14} />
      </button>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </section>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

export function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-800 break-words">{value || '-'}</dd>
    </div>
  )
}
