import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteProfilePhoto, getApiErrorMessage, getProfiles, pageResults, patchProfile } from '../api'
import { formatDate } from '../adminFormat'
import { Badge, EmptyState, ErrorBanner, Pagination } from '../adminUi'
import { CheckCircle, Maximize2, Search, Trash2, X, XCircle } from 'lucide-react'

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
  hostly_verified: boolean
  verification_note: string
  verification_reviewed_at: string | null
  reviewed_by_email: string
  photo_url: string
  rating_average: number
  rating_count: number
  created_at: string
  interests: string[]
}

interface Page<T> {
  results?: T[]
  next?: string | null
  previous?: string | null
}

const STATUS_STYLES: Record<string, string> = {
  verified: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-600',
  unverified: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ausstehend',
  verified: 'Verifiziert',
  rejected: 'Abgelehnt',
  unverified: 'Unverifiziert',
}

export default function VerificationPage() {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [city, setCity] = useState('')
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState('')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [photo, setPhoto] = useState<{ url: string; title: string } | null>(null)
  const qc = useQueryClient()

  const params: Record<string, string> = {}
  if (statusFilter) params.verification_status = statusFilter
  if (city) params.city = city
  if (q) params.q = q
  if (cursor) params.cursor = cursor

  const { data, isLoading, error } = useQuery<Page<Profile> | Profile[]>({
    queryKey: ['profiles', statusFilter, city, q, cursor],
    queryFn: () => getProfiles(params),
  })
  const profiles = pageResults<Profile>(data)
  const page = data && !Array.isArray(data) ? data : undefined

  const mutation = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: string; note: string }) =>
      patchProfile(id, { verification_status: status, verification_note: note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
  const photoMutation = useMutation({
    mutationFn: deleteProfilePhoto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setCursor('')
  }
  const noteFor = (profile: Profile) => notes[profile.id] ?? profile.verification_note ?? ''
  const errorMessage = error
    ? getApiErrorMessage(error)
    : mutation.error
      ? getApiErrorMessage(mutation.error)
      : photoMutation.error
        ? getApiErrorMessage(photoMutation.error)
        : ''

  return (
    <div className="p-8">
      <div className="admin-page-header flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Verifizierung</h2>
          <p className="text-sm text-gray-500 mt-0.5">Profilbilder prüfen, Ablehnungsgrund speichern und Verlauf sehen</p>
        </div>
        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
          {profiles.length} angezeigt
        </span>
      </div>

      <ErrorBanner message={errorMessage} />

      <div className="admin-filters flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-64 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setFilter(setQ, e.target.value)}
            placeholder="Name oder E-Mail"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <input
          value={city}
          onChange={(e) => setFilter(setCity, e.target.value)}
          placeholder="Stadt"
          className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setFilter(setStatusFilter, e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Laden...</div>
      ) : profiles.length === 0 ? (
        <EmptyState>Keine Profile in dieser Auswahl</EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => profile.photo_url && setPhoto({ url: profile.photo_url, title: profile.display_name || profile.email })}
                  className="relative shrink-0"
                  disabled={!profile.photo_url}
                >
                  {profile.photo_url ? (
                    <>
                      <img src={profile.photo_url} className="w-16 h-16 rounded-lg object-cover" alt="" />
                      <span className="absolute bottom-1 right-1 rounded bg-black/55 p-1 text-white"><Maximize2 size={12} /></span>
                    </>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 font-bold">
                      {(profile.display_name || profile.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <Link to={`/users/${profile.user_id}`} className="font-semibold text-gray-900 truncate block hover:text-violet-700">
                    {profile.display_name || profile.username}
                  </Link>
                  <p className="text-xs text-gray-400 truncate">{profile.email}</p>
                  <p className="text-xs text-gray-500">{profile.city || 'Keine Stadt'} · {profile.gender}</p>
                  <Badge className={STATUS_STYLES[profile.verification_status] || STATUS_STYLES.unverified}>
                    {profile.hostly_verified ? 'Durch Hostly verifiziert' : (STATUS_LABELS[profile.verification_status] || profile.verification_status)}
                  </Badge>
                </div>
              </div>
              {profile.bio && <p className="text-xs text-gray-600 mb-3 line-clamp-2">{profile.bio}</p>}
              {profile.interests.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {profile.interests.slice(0, 5).map((interest) => (
                    <span key={interest} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">{interest}</span>
                  ))}
                  {profile.interests.length > 5 && <span className="text-xs text-gray-400">+{profile.interests.length - 5}</span>}
                </div>
              )}
              <div className="mb-3 text-xs text-gray-500">
                <p>Eingereicht: {formatDate(profile.created_at, true)}</p>
                {profile.verification_reviewed_at && (
                  <p>Geprüft: {formatDate(profile.verification_reviewed_at, true)} · {profile.reviewed_by_email || 'Admin'}</p>
                )}
              </div>
              <textarea
                value={noteFor(profile)}
                onChange={(e) => setNotes((current) => ({ ...current, [profile.id]: e.target.value }))}
                placeholder="Ablehnungsgrund oder interne Prüfnotiz"
                className="mb-3 h-20 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => mutation.mutate({ id: profile.id, status: 'verified', note: noteFor(profile) })}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  <CheckCircle size={14} /> Durch Hostly verifizieren
                </button>
                <button
                  onClick={() => mutation.mutate({ id: profile.id, status: 'rejected', note: noteFor(profile) || 'Profil konnte nicht verifiziert werden.' })}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  <XCircle size={14} /> Ablehnen
                </button>
              </div>
              {profile.photo_url && (
                <button
                  onClick={() => {
                    if (confirm('Profilbild löschen?')) photoMutation.mutate(profile.id)
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-50 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                >
                  <Trash2 size={14} /> Bild wegen Richtlinienverstoß löschen
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <Pagination data={page} onCursor={setCursor} />

      {photo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setPhoto(null)}>
          <div className="relative max-h-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-gray-700 shadow"
              aria-label="Schließen"
            >
              <X size={18} />
            </button>
            <img src={photo.url} alt={photo.title} className="max-h-[85vh] max-w-full rounded-lg object-contain bg-white" />
          </div>
        </div>
      )}
    </div>
  )
}
