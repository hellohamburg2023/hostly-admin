import { useQuery } from '@tanstack/react-query'
import { getIdeas } from '../api'
import { MapPin, ThumbsUp, Tag } from 'lucide-react'

interface Idea {
  id: number
  title: string
  city: string
  created_at: string
  created_by_id: number
  created_by_email: string
  category_id: number
  category_name: string
  signal_count: number
}

export default function IdeasPage() {
  const { data, isLoading } = useQuery({ queryKey: ['ideas'], queryFn: getIdeas })
  const ideas: Idea[] = data?.results ?? data ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Ideen</h2>
          <p className="text-sm text-gray-500 mt-0.5">Von Nutzern vorgeschlagene Event-Ideen</p>
        </div>
        <span className="text-sm text-gray-500">{ideas.length} Ideen</span>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Laden…</div>
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
                <span className="flex items-center gap-1"><MapPin size={10} />{idea.city}</span>
                <span className="flex items-center gap-1"><Tag size={10} />{idea.category_name}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {idea.created_by_email} · {new Date(idea.created_at).toLocaleDateString('de-DE')}
              </p>
            </div>
          ))}
          {ideas.length === 0 && (
            <div className="col-span-full bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              Keine Ideen vorhanden
            </div>
          )}
        </div>
      )}
    </div>
  )
}
