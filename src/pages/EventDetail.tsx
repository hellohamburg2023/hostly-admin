import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteEvent, deleteEventPhoto, getApiErrorMessage, getEvent, patchEvent } from '../api'
import { formatDate } from '../adminFormat'
import { Badge, DetailRow, ErrorBanner, Section } from '../adminUi'
import { SAFETY_STATUS_LABELS, SAFETY_STATUS_STYLES } from '../safeWalk'
import { ArrowLeft, Ban, MapPin, Trash2 } from 'lucide-react'

interface CompactUser {
  id: number
  email: string
  username: string
  display_name: string
  photo_url: string
  city: string
  verification_status: string
}

interface Report {
  id: number
  reason: string
  status: string
  created_at: string
  reporter_id: number
  reporter_email: string
  reported_user_id: number | null
  reported_user_email: string | null
}

interface EventDetail {
  id: number
  uuid: string
  title: string
  description: string
  status: string
  city: string
  public_location: string
  precise_location: string
  latitude: string | null
  longitude: string | null
  starts_at: string
  ends_at: string | null
  min_participants: number
  participant_limit: number
  participant_count: number
  request_count: number
  report_count: number
  women_only: boolean
  safety_badges: string[]
  rules: string
  age_restriction_enabled: boolean
  min_age: number | null
  max_age: number | null
  icon: string
  interests: string[]
  host_id: number
  host_email: string
  host_name: string
  category_name: string
  created_at: string
  updated_at: string
  host: CompactUser
  participants: { id: number; user: CompactUser; created_at: string; accepted_by_email: string }[]
  requests: { id: number; user: CompactUser; message: string; status: string; created_at: string }[]
  reports: Report[]
  reviews: { id: number; reviewer: CompactUser; reviewee: CompactUser; rating: number; comment: string; created_at: string }[]
  photos: { id: number; uploaded_by: CompactUser; photo_url: string; caption: string; created_at: string }[]
  safe_walks: {
    id: number
    user: CompactUser | null
    status: string
    destination_label: string
    expected_arrival_at: string
    grace_minutes: number
    check_in_sent_at: string | null
    last_location_at: string | null
    overdue_minutes: number
    contact_count: number
    escalated_at: string | null
  }[]
  chat_messages: { id: number; sender: CompactUser; message_type: string; body: string; created_at: string }[]
  audit_logs: { id: number; action: string; actor_email: string; created_at: string }[]
  personal_verifications: { id: number; verifier: CompactUser; verified_user: CompactUser; created_at: string }[]
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  full: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-purple-100 text-purple-700',
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
  active: 'bg-green-100 text-green-700',
  escalated: 'bg-red-100 text-red-700',
  arrived: 'bg-blue-100 text-blue-700',
}

function UserLine({ user }: { user: CompactUser | null }) {
  if (!user) return <p className="text-sm font-medium text-gray-500">Gelöschtes Mitglied</p>
  return (
    <Link to={`/users/${user.id}`} className="flex items-center gap-3 hover:text-violet-700">
      {user.photo_url ? (
        <img src={user.photo_url} className="h-8 w-8 rounded-full object-cover" alt="" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
          {(user.display_name || user.username || user.email || '?')[0].toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{user.display_name || user.username || user.email}</p>
        <p className="truncate text-xs text-gray-400">{user.email}</p>
      </div>
    </Link>
  )
}

export default function EventDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: event, isLoading, error } = useQuery<EventDetail>({
    queryKey: ['event', id],
    queryFn: () => getEvent(id as string),
    enabled: Boolean(id),
  })
  const mutation = useMutation({
    mutationFn: (status: string) => patchEvent(Number(id), { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', id] }),
  })
  const photoMutation = useMutation({
    mutationFn: (photoId: number) => deleteEventPhoto(Number(id), photoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', id] }),
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      navigate('/events', { replace: true })
    },
  })

  const errorMessage = error
    ? getApiErrorMessage(error)
    : mutation.error
      ? getApiErrorMessage(mutation.error)
      : photoMutation.error
        ? getApiErrorMessage(photoMutation.error)
        : deleteMutation.error
          ? getApiErrorMessage(deleteMutation.error)
          : ''

  if (isLoading) return <div className="p-8 text-gray-400">Laden...</div>
  if (!event) return <div className="p-8 text-gray-400">Event nicht gefunden</div>

  const mapUrl = event.latitude && event.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
    : ''

  return (
    <div className="p-8">
      <Link to="/events" className="mb-5 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> Zurück zu Events
      </Link>
      <ErrorBanner message={errorMessage} />

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="admin-detail-header flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge className={STATUS_STYLES[event.status] || STATUS_STYLES.draft}>{event.status}</Badge>
              {event.women_only && <Badge className="bg-pink-100 text-pink-700">Women only</Badge>}
              {event.report_count > 0 && <Badge className="bg-red-100 text-red-700">{event.report_count} Meldungen</Badge>}
            </div>
            <h2 className="break-words text-xl font-bold text-gray-900">{event.title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">{event.description}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {event.status !== 'cancelled' && event.status !== 'completed' && (
              <button
                onClick={() => mutation.mutate('cancelled')}
                className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                <Ban size={15} /> Event absagen
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const confirmation = prompt(`Event „${event.title}“ endgültig löschen? Alle zugehörigen Daten werden entfernt.\n\nTippe LÖSCHEN zur Bestätigung.`)
                if (confirmation === 'LÖSCHEN') deleteMutation.mutate()
              }}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={15} /> Endgültig löschen
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div>
          <Section title="Basisdaten">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <dl className="grid grid-cols-1 gap-4">
                <DetailRow label="Host" value={<UserLine user={event.host} />} />
                <DetailRow label="Kategorie" value={event.category_name} />
                <DetailRow label="Stadt" value={event.city} />
                <DetailRow label="Öffentlicher Ort" value={event.public_location} />
                <DetailRow label="Genauer Ort" value={event.precise_location} />
                <DetailRow label="Koordinaten" value={mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-700 hover:text-violet-900"><MapPin size={13} /> Karte öffnen</a> : '-'} />
                <DetailRow label="Start" value={formatDate(event.starts_at, true)} />
                <DetailRow label="Ende" value={formatDate(event.ends_at, true)} />
                <DetailRow label="Teilnehmer" value={`${event.participant_count}/${event.participant_limit} · min. ${event.min_participants}`} />
                <DetailRow label="Sicherheitsbadges" value={event.safety_badges?.join(', ')} />
                <DetailRow label="Altersbereich" value={event.age_restriction_enabled ? `${event.min_age ?? '?'} bis ${event.max_age ?? '?'} Jahre` : 'Keine Altersbeschränkung'} />
                <DetailRow label="Interessen" value={event.interests?.join(', ')} />
                <DetailRow label="Regeln" value={event.rules} />
              </dl>
            </div>
          </Section>

          <Section title="Fotos">
            <div className="grid grid-cols-2 gap-3">
              {event.photos.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Fotos</p>
              ) : event.photos.map((photo) => (
                <div key={photo.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <a href={photo.photo_url} target="_blank" rel="noreferrer" className="block">
                    <img src={photo.photo_url} className="aspect-square w-full object-cover" alt={photo.caption} />
                  </a>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <p className="truncate text-xs text-gray-500">{photo.caption || photo.uploaded_by?.email || 'Foto'}</p>
                    <button
                      onClick={() => {
                        if (confirm('Eventfoto löschen?')) photoMutation.mutate(photo.id)
                      }}
                      className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50"
                      title="Foto löschen"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="xl:col-span-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Teilnehmer">
              <div className="rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <UserLine user={event.host} />
                    <Badge className="bg-violet-100 text-violet-700">Host</Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Erstellt {formatDate(event.created_at, true)}</p>
                </div>
                {event.participants.map((participant) => (
                  <div key={participant.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
                    <UserLine user={participant.user} />
                    <p className="mt-1 text-xs text-gray-400">Seit {formatDate(participant.created_at, true)}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Join-Anfragen">
              <div className="rounded-xl border border-gray-200 bg-white">
                {event.requests.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">Keine Anfragen</p>
                ) : event.requests.map((request) => (
                  <div key={request.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <UserLine user={request.user} />
                      <Badge className={STATUS_STYLES[request.status] || STATUS_STYLES.pending}>{request.status}</Badge>
                    </div>
                    {request.message && <p className="mt-2 text-sm text-gray-600">{request.message}</p>}
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <Section title="Meldungen">
            <div className="rounded-xl border border-gray-200 bg-white">
              {event.reports.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Keine Meldungen</p>
              ) : event.reports.map((report) => (
                <Link key={report.id} to={`/reports/${report.id}`} className="block border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-gray-50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">{report.reason}</p>
                    <Badge className={report.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}>{report.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(report.created_at, true)} · {report.reporter_email}</p>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Safe-Walks">
            <div className="rounded-xl border border-gray-200 bg-white">
              {event.safe_walks.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Keine Safe-Walks</p>
              ) : event.safe_walks.map((walk) => (
                <div key={walk.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <UserLine user={walk.user} />
                    <div className="flex items-center gap-2">
                      <Badge className={SAFETY_STATUS_STYLES[walk.status] || STATUS_STYLES.draft}>{SAFETY_STATUS_LABELS[walk.status] || walk.status}</Badge>
                      <Link to={`/safe-walks/${walk.id}`} className="text-xs font-medium text-violet-700 hover:text-violet-900">Details</Link>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Ziel: {walk.destination_label} · Erwartet {formatDate(walk.expected_arrival_at, true)}
                    {walk.overdue_minutes > 0 ? ` · ${walk.overdue_minutes} Min. überfällig` : ''}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Kontakte: {walk.contact_count} · Grace: {walk.grace_minutes} Min.
                    {walk.check_in_sent_at ? ` · Check-in-Push ${formatDate(walk.check_in_sent_at, true)}` : ' · Check-in noch nicht gesendet'}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Persönliche Verifizierungen">
            <div className="rounded-xl border border-gray-200 bg-white">
              {event.personal_verifications.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Keine persönlichen Verifizierungen aus diesem Event</p>
              ) : event.personal_verifications.map((verification) => (
                <div key={verification.id} className="flex flex-col items-start justify-between gap-2 border-b border-gray-100 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
                  <p className="text-sm text-gray-700">
                    <Link to={`/users/${verification.verifier.id}`} className="font-medium text-violet-700">{verification.verifier.display_name || verification.verifier.email}</Link>
                    {' hat '}
                    <Link to={`/users/${verification.verified_user.id}`} className="font-medium text-violet-700">{verification.verified_user.display_name || verification.verified_user.email}</Link>
                    {' persönlich verifiziert'}
                  </p>
                  <p className="shrink-0 text-xs text-gray-400">{formatDate(verification.created_at, true)}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Chat-Kontext">
            <div className="rounded-xl border border-gray-200 bg-white">
              {event.chat_messages.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Keine Chat-Nachrichten</p>
              ) : event.chat_messages.map((message) => (
                <div key={message.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">{message.sender?.display_name || message.sender?.email || 'System'}</p>
                    <p className="text-xs text-gray-400">{formatDate(message.created_at, true)}</p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{message.body}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
