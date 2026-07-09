import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProfiles, patchProfile } from '../api'
import { CheckCircle, XCircle } from 'lucide-react'

interface Profile {
  id: number
  user_id: number
  email: string
  username: string
  display_name: string
  bio: string
  city: string
  birth_date: string | null
  gender: string
  verification_status: string
  photo_url: string
  rating_average: number
  rating_count: number
  created_at: string
  interests: string[]
}

export default function VerificationPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['profiles-pending'],
    queryFn: () => getProfiles({ verification_status: 'pending' }),
  })
  const profiles: Profile[] = data?.results ?? data ?? []

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      patchProfile(id, { verification_status: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles-pending'] }),
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Verifizierungs-Queue</h2>
          <p className="text-sm text-gray-500 mt-0.5">Profile die auf Freigabe warten</p>
        </div>
        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
          {profiles.length} ausstehend
        </span>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Laden…</div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
          <p className="text-gray-500">Keine ausstehenden Verifizierungen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start gap-3 mb-3">
                {p.photo_url ? (
                  <img src={p.photo_url} className="w-12 h-12 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold">
                    {(p.display_name || p.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{p.display_name}</p>
                  <p className="text-xs text-gray-400 truncate">{p.email}</p>
                  <p className="text-xs text-gray-500">{p.city} · {p.gender}</p>
                </div>
              </div>
              {p.bio && <p className="text-xs text-gray-600 mb-3 line-clamp-2">{p.bio}</p>}
              {p.interests.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.interests.slice(0, 4).map((i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">{i}</span>
                  ))}
                  {p.interests.length > 4 && <span className="text-xs text-gray-400">+{p.interests.length - 4}</span>}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => mutation.mutate({ id: p.id, status: 'verified' })}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  <CheckCircle size={14} /> Verifizieren
                </button>
                <button
                  onClick={() => mutation.mutate({ id: p.id, status: 'rejected' })}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  <XCircle size={14} /> Ablehnen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
