import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteProfilePhoto, getApiErrorMessage, getUser, patchProfile, patchUser } from '../api'
import { activityLabel, formatDate } from '../adminFormat'
import { Badge, DetailRow, ErrorBanner, Section } from '../adminUi'
import { ArrowLeft, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX } from 'lucide-react'

interface CompactUser {
  id: number
  email: string
  username: string
  display_name?: string
  city?: string
  photo_url?: string
  verification_status?: string
}

interface AdminEvent {
  id: number
  title: string
  status: string
  city: string
  starts_at: string
  participant_count: number
  request_count: number
  report_count: number
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
  event_id: number | null
  event_title: string | null
}

interface UserDetail {
  id: number
  email: string
  username: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
  last_login: string | null
  last_active_at: string | null
  inactive_days: number | null
  email_verified_at: string | null
  onboarding_completed_at: string | null
  profile_display_name: string
  profile_city: string
  profile_verification_status: string
  profile_photo_url: string
  hosted_event_count: number
  participation_count: number
  reports_sent_count: number
  reports_received_count: number
  profile: {
    id: number
    photo_url: string
    bio: string
    city: string
    gender: string
    age_range: string
    women_only_eligible: boolean
    verification_status: string
    verification_note: string
    verification_reviewed_at: string | null
    reviewed_by_email: string
    interests: string[]
    rating_average: number
    rating_count: number
  } | null
  hosted_events: AdminEvent[]
  participations: { id: number; created_at: string; event: AdminEvent }[]
  requests: { id: number; status: string; created_at: string; event_id: number; message: string }[]
  reports_sent: Report[]
  reports_received: Report[]
  reviews_written: { id: number; event_id: number; rating: number; comment: string; created_at: string; reviewee: CompactUser }[]
  reviews_received: { id: number; event_id: number; rating: number; comment: string; created_at: string; reviewer: CompactUser }[]
  blocks_sent: { id: number; created_at: string; blocked: CompactUser }[]
  blocks_received: { id: number; created_at: string; blocker: CompactUser }[]
  push_devices: { id: number; token: string; platform: string; enabled: boolean; created_at: string; updated_at: string }[]
  audit_logs: { id: number; action: string; target_repr: string; metadata: Record<string, unknown>; created_at: string; actor_email: string }[]
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  full: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-purple-100 text-purple-700',
  verified: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-600',
  unverified: 'bg-gray-100 text-gray-600',
}

function SmallEventList({ events }: { events: AdminEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-gray-400">Keine Einträge</p>
  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {events.map((event) => (
        <Link key={event.id} to={`/events/${event.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{event.title}</p>
            <p className="text-xs text-gray-400">{event.city || '-'} · {formatDate(event.starts_at, true)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {event.report_count > 0 && <Badge className="bg-red-100 text-red-700">{event.report_count} Meldungen</Badge>}
            <Badge className={STATUS_STYLES[event.status] || STATUS_STYLES.draft}>{event.status}</Badge>
          </div>
        </Link>
      ))}
    </div>
  )
}

function ReportList({ reports }: { reports: Report[] }) {
  if (reports.length === 0) return <p className="text-sm text-gray-400">Keine Meldungen</p>
  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {reports.map((report) => (
        <Link key={report.id} to={`/reports/${report.id}`} className="block px-4 py-3 hover:bg-gray-50">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-gray-900">{report.reason}</p>
            <Badge className={report.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}>{report.status}</Badge>
          </div>
          <p className="text-xs text-gray-400">
            {formatDate(report.created_at, true)}
            {report.event_title ? ` · ${report.event_title}` : ''}
          </p>
        </Link>
      ))}
    </div>
  )
}

export default function UserDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { data: user, isLoading, error } = useQuery<UserDetail>({
    queryKey: ['user', id],
    queryFn: () => getUser(id as string),
    enabled: Boolean(id),
  })
  const mutation = useMutation({
    mutationFn: (isActive: boolean) => patchUser(Number(id), { is_active: isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', id] }),
  })
  const profileMutation = useMutation({
    mutationFn: ({ profileId, status }: { profileId: number; status: string }) => patchProfile(profileId, { verification_status: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', id] }),
  })
  const photoMutation = useMutation({
    mutationFn: (profileId: number) => deleteProfilePhoto(profileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', id] }),
  })

  const errorMessage = error
    ? getApiErrorMessage(error)
    : mutation.error
      ? getApiErrorMessage(mutation.error)
      : profileMutation.error
        ? getApiErrorMessage(profileMutation.error)
        : photoMutation.error
          ? getApiErrorMessage(photoMutation.error)
          : ''

  if (isLoading) return <div className="p-8 text-gray-400">Laden...</div>
  if (!user) return <div className="p-8 text-gray-400">Nutzer nicht gefunden</div>

  return (
    <div className="p-8">
      <Link to="/users" className="mb-5 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> Zurück zu Nutzern
      </Link>
      <ErrorBanner message={errorMessage} />

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {user.profile_photo_url ? (
              <img src={user.profile_photo_url} className="h-16 w-16 rounded-xl object-cover" alt="" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-600">
                {(user.profile_display_name || user.username || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.profile_display_name || user.username}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge className={user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>{user.is_active ? 'Aktiv' : 'Gesperrt'}</Badge>
                <Badge className={STATUS_STYLES[user.profile_verification_status] || STATUS_STYLES.unverified}>{user.profile_verification_status || 'unverified'}</Badge>
                {user.is_superuser && <Badge className="bg-violet-100 text-violet-700">Superuser</Badge>}
              </div>
            </div>
          </div>
          {!user.is_superuser && (
            <button
              onClick={() => mutation.mutate(!user.is_active)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                user.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              {user.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
              {user.is_active ? 'Nutzer sperren' : 'Nutzer entsperren'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div>
          <Section title="Konto">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <dl className="grid grid-cols-1 gap-4">
                <DetailRow label="Letzte Aktivität" value={`${activityLabel(user.inactive_days)} · ${formatDate(user.last_active_at || user.last_login, true)}`} />
                <DetailRow label="Registriert" value={formatDate(user.date_joined, true)} />
                <DetailRow label="E-Mail verifiziert" value={formatDate(user.email_verified_at, true)} />
                <DetailRow label="Onboarding" value={formatDate(user.onboarding_completed_at, true)} />
                <DetailRow label="Stadt" value={user.profile?.city || user.profile_city} />
                <DetailRow label="Profilnote" value={user.profile?.verification_note} />
              </dl>
            </div>
          </Section>

          <Section title="Profil">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              {user.profile && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {user.profile.verification_status !== 'verified' && (
                    <button
                      onClick={() => profileMutation.mutate({ profileId: user.profile!.id, status: 'verified' })}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                    >
                      <ShieldCheck size={14} /> Verifizieren
                    </button>
                  )}
                  {user.profile.verification_status === 'verified' && (
                    <button
                      onClick={() => profileMutation.mutate({ profileId: user.profile!.id, status: 'unverified' })}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                    >
                      <ShieldOff size={14} /> Verifizierung entfernen
                    </button>
                  )}
                  {user.profile_photo_url && (
                    <button
                      onClick={() => {
                        if (confirm('Profilbild löschen und Verifizierung zurücknehmen?')) photoMutation.mutate(user.profile!.id)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      <Trash2 size={14} /> Profilbild löschen
                    </button>
                  )}
                </div>
              )}
              <dl className="grid grid-cols-1 gap-4">
                <DetailRow label="Bio" value={user.profile?.bio} />
                <DetailRow label="Gender" value={user.profile?.gender} />
                <DetailRow label="Age Range" value={user.profile?.age_range} />
                <DetailRow label="Women only eligible" value={user.profile?.women_only_eligible ? 'Ja' : 'Nein'} />
                <DetailRow label="Bewertung" value={`${user.profile?.rating_average ?? 0} (${user.profile?.rating_count ?? 0})`} />
                <DetailRow label="Interessen" value={user.profile?.interests?.join(', ')} />
              </dl>
            </div>
          </Section>
        </div>

        <div className="xl:col-span-2">
          <Section title="Events als Host">
            <SmallEventList events={user.hosted_events} />
          </Section>
          <Section title="Teilnahmen">
            <SmallEventList events={user.participations.map((row) => row.event)} />
          </Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Meldungen gesendet">
              <ReportList reports={user.reports_sent} />
            </Section>
            <Section title="Meldungen erhalten">
              <ReportList reports={user.reports_received} />
            </Section>
          </div>
          <Section title="Push-Devices">
            <div className="rounded-xl border border-gray-200 bg-white">
              {user.push_devices.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Keine Push-Devices</p>
              ) : user.push_devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{device.platform} · {device.enabled ? 'aktiv' : 'deaktiviert'}</p>
                    <p className="max-w-lg truncate text-xs text-gray-400">{device.token}</p>
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(device.updated_at, true)}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Blocks und Bewertungen">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Blockiert</h4>
                {user.blocks_sent.length === 0 ? <p className="text-sm text-gray-400">Keine</p> : user.blocks_sent.map((block) => (
                  <p key={block.id} className="text-sm text-gray-600">{block.blocked.email} · {formatDate(block.created_at)}</p>
                ))}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Von anderen blockiert</h4>
                {user.blocks_received.length === 0 ? <p className="text-sm text-gray-400">Keine</p> : user.blocks_received.map((block) => (
                  <p key={block.id} className="text-sm text-gray-600">{block.blocker.email} · {formatDate(block.created_at)}</p>
                ))}
              </div>
            </div>
          </Section>
          <Section title="Audit">
            <div className="rounded-xl border border-gray-200 bg-white">
              {user.audit_logs.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Keine Admin-Aktionen</p>
              ) : user.audit_logs.map((log) => (
                <div key={log.id} className="border-b border-gray-100 px-4 py-3 text-sm last:border-0">
                  <p className="font-medium text-gray-900">{log.action}</p>
                  <p className="text-xs text-gray-400">{formatDate(log.created_at, true)} · {log.actor_email || 'System'}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
