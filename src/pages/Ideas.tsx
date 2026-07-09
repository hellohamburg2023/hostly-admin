import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getApiErrorMessage, getIdeas, pageResults } from '../api'
import { formatDate } from '../adminFormat'
import { EmptyState, ErrorBanner, Pagination } from '../adminUi'
import { MapPin, ThumbsUp, Tag } from 'lucide-react'

interface Idea {
  id: number
  title: string
  city: string
  created_at: string
  created_by_id: number
  created_by_email: string
  created_by_name: string
  category_id: number
  category_name: string
  signal_count: number
}

interface Page<T> {
  results?: T[]
  next?: string | null
  previous?: string | null
}

export default function IdeasPage() {
  const [cursor, setCursor] = useState('')
  const { data, isLoading, error } = useQuery<Page<Idea> | Idea[]>({
    queryKey: ['ideas', cursor],
    queryFn: () => getIdeas(cursor ? { cursor } : undefined),
  })
  const ideas = pageResults<Idea>(data)
  const page = data && !Array.isArray(data) ? data : undefined

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Ideen</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Diese Einträge kommen aus der mobilen Ideen-Funktion. Leer bedeutet: Es wurde noch keine Idee von Nutzern eingereicht.
          </p>
        </div>
        <span className="text-sm text-gray-500">{ideas.length} angezeigt</span>
      </div>

      <ErrorBanner message={error ? getApiErrorMessage(error) : ''} />

      {isLoading ? (
        <div className="text-gray-400">Laden...</div>
      ) : ideas.length === 0 ? (
        <EmptyState>Keine Nutzer-Ideen vorhanden</EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ideas.map((idea) => (
            <div key={idea.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-gray-900">{idea.title}</h3>
                <div className="flex items-center gap-1 bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full text-sm font-medium shrink-0">
                  <ThumbsUp size={12} />
                  {idea.signal_count}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><MapPin size={10} />{idea.city || 'Keine Stadt'}</span>
                <span className="flex items-center gap-1"><Tag size={10} />{idea.category_name || 'Keine Kategorie'}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                <Link to={`/users/${idea.created_by_id}`} className="hover:text-violet-700">
                  {idea.created_by_name || idea.created_by_email}
                </Link>{' '}
                · {formatDate(idea.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
      <Pagination data={page} onCursor={setCursor} />
    </div>
  )
}
