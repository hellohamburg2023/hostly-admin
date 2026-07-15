import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getApiErrorMessage, getSafeWalk } from '../api'
import { formatDate } from '../adminFormat'
import { Badge, DetailRow, ErrorBanner, Section } from '../adminUi'
import {
  SAFETY_KIND_LABELS,
  SAFETY_STATUS_LABELS,
  SAFETY_STATUS_STYLES,
  TRANSPORT_LABELS,
  TRUST_MODE_LABELS,
  freshnessLabel,
  type CompactAdminUser,
  type SafeWalkDetail,
} from '../safeWalk'
import { ArrowLeft, ExternalLink, MapPin, Radio, ShieldAlert, Smartphone, Users } from 'lucide-react'

const AUDIT_ACTIONS: Record<string, string> = {
  invite_claimed: 'Sicherheitslink angenommen',
  public_status: 'Öffentlichen Status abgerufen',
  activity_registered: 'Live Activity registriert',
  accepted_invite_link_view: 'Angenommenen Sicherheitslink geöffnet',
  public_link_view: 'Sicherheitslink geöffnet',
}

const ACTOR_LABELS: Record<string, string> = {
  owner: 'Eigentümer',
  trusted_user: 'Hostly-Kontakt',
  web_credential: 'Sicherheitslink',
  system: 'System',
  unknown: 'Unbekannt',
}

function UserLink({ user, fallback = 'Kein Nutzer' }: { user: CompactAdminUser | null; fallback?: string }) {
  if (!user) return <span className="text-gray-400">{fallback}</span>
  return (
    <Link to={`/users/${user.id}`} className="font-medium text-gray-900 hover:text-violet-700">
      {user.display_name || user.username || user.email}
      <span className="ml-1 font-normal text-gray-400">({user.email})</span>
    </Link>
  )
}

export default function SafeWalkDetailPage() {
  const { id } = useParams()
  const { data: session, isLoading, error } = useQuery<SafeWalkDetail>({
    queryKey: ['safe-walk', id],
    queryFn: () => getSafeWalk(id as string),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  })

  if (isLoading) return <div className="p-8 text-gray-400">Laden...</div>
  if (!session) return <div className="p-8 text-gray-400">Safety Session nicht gefunden</div>

  const timeline = [
    { label: 'Erstellt', value: session.created_at },
    { label: 'Startbereit / gestartet', value: session.started_at },
    { label: 'Meeting Safety aktiviert', value: session.meeting_activated_at },
    { label: 'Ankunft fällig', value: session.arrival_due_at },
    { label: 'Check-in gesendet', value: session.check_in_sent_at },
    { label: 'Eskaliert', value: session.escalated_at },
    { label: 'Angekommen', value: session.arrived_at },
    { label: 'Abgeschlossen', value: session.completed_at },
    { label: 'Abgebrochen', value: session.cancelled_at },
  ].filter((entry) => entry.value)

  const mapUrl = session.location_disclosure === 'emergency' && session.last_latitude && session.last_longitude
    ? `https://www.google.com/maps/search/?api=1&query=${session.last_latitude},${session.last_longitude}`
    : ''

  return (
    <div className="p-8">
      <Link to="/safe-walks" className="mb-5 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> Zurück zu Safety Operations
      </Link>
      <ErrorBanner message={error ? getApiErrorMessage(error) : ''} />

      <div className={`mb-6 rounded-xl border bg-white p-5 ${session.needs_attention ? 'border-amber-300' : 'border-gray-200'}`}>
        <div className="admin-detail-header flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge className="bg-violet-100 text-violet-700">{SAFETY_KIND_LABELS[session.kind] || session.kind}</Badge>
              <Badge className={SAFETY_STATUS_STYLES[session.status] || 'bg-gray-100 text-gray-600'}>{SAFETY_STATUS_LABELS[session.status] || session.status}</Badge>
              {session.needs_attention && <Badge className="bg-red-100 text-red-700">Handlungsbedarf</Badge>}
            </div>
            <h2 className="text-xl font-bold text-gray-900">Safety Session #{session.id}</h2>
            <p className="mt-1 text-sm text-gray-500">{session.destination_label || 'Geschütztes Ziel'} · {TRUST_MODE_LABELS[session.trusted_contact_type] || session.trusted_contact_type}</p>
          </div>
          <div className="text-left text-xs text-gray-400 sm:text-right">
            <p>Version {session.version}</p>
            <p>Update {formatDate(session.updated_at, true)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div>
          <Section title="Session">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <dl className="grid grid-cols-1 gap-4">
                <DetailRow label="Nutzer" value={<UserLink user={session.user} fallback="Gelöschtes Mitglied" />} />
                <DetailRow label="Event" value={session.event_id ? <Link to={`/events/${session.event_id}`} className="font-medium text-violet-700 hover:text-violet-900">{session.event_title || `Event #${session.event_id}`}</Link> : 'Kein Event verknüpft'} />
                <DetailRow label="Transport" value={TRANSPORT_LABELS[session.transport_mode] || session.transport_mode} />
                <DetailRow label="Erwartete Ankunft" value={formatDate(session.expected_arrival_at, true)} />
                <DetailRow label="Grace Period" value={`${session.grace_minutes} Minuten`} />
                <DetailRow label="Vertrauenskontakt" value={<UserLink user={session.trusted_hostly_user} fallback={TRUST_MODE_LABELS[session.trusted_contact_type] || '-'} />} />
                <DetailRow label="Public ID" value={<span className="break-all font-mono text-xs">{session.public_id}</span>} />
                {session.note && <DetailRow label="Notiz" value={session.note} />}
              </dl>
            </div>
          </Section>

          <Section title="Standort und App-Signale">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                <Radio size={17} className="mt-0.5 text-violet-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">App-Signal {freshnessLabel(session.last_app_contact_at)}</p>
                  <p className="text-xs text-gray-500">Standort {freshnessLabel(session.last_location_at)} · Upload {freshnessLabel(session.last_upload_at)}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4">
                <DetailRow label="Routenpunkte" value={session.location_point_count} />
                <DetailRow label="Genauigkeit" value={session.last_known_accuracy == null ? '-' : `± ${Math.round(session.last_known_accuracy)} m`} />
                <DetailRow label="Live Activity Owner" value={session.owner_activity_token_updated_at ? `Aktiv · ${formatDate(session.owner_activity_token_updated_at, true)}` : 'Nicht registriert'} />
                <DetailRow label="Zugriffe" value={session.access_count} />
              </dl>
              {mapUrl ? (
                <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
                  <MapPin size={15} /> Notfallstandort öffnen <ExternalLink size={13} />
                </a>
              ) : session.location_disclosure === 'protected' ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-violet-50 p-3 text-xs text-violet-800">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                  Koordinaten sind vorhanden, bleiben aber bis zu einer echten Eskalation geschützt.
                </div>
              ) : (
                <p className="mt-4 text-xs text-gray-400">Keine Standortdaten vorhanden.</p>
              )}
            </div>
          </Section>

          {session.meeting_snapshot && (
            <Section title="Meeting-Safety-Snapshot">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <dl className="grid grid-cols-1 gap-4">
                  <DetailRow label="Andere Person" value={<UserLink user={session.meeting_snapshot.other_participant} />} />
                  <DetailRow label="Aufgenommen" value={formatDate(session.meeting_snapshot.captured_at, true)} />
                </dl>
              </div>
            </Section>
          )}
        </div>

        <div className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Status-Zeitachse">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="space-y-4">
                  {timeline.map((entry, index) => (
                    <div key={entry.label} className="relative flex gap-3">
                      {index < timeline.length - 1 && <div className="absolute left-[5px] top-3 h-8 w-px bg-gray-200" />}
                      <div className="relative mt-1 h-3 w-3 shrink-0 rounded-full bg-violet-500 ring-4 ring-violet-50" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{entry.label}</p>
                        <p className="text-xs text-gray-400">{formatDate(entry.value, true)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {session.scheduled_deletion_at && <p className="mt-5 border-t border-gray-100 pt-3 text-xs text-gray-500">Geplante Datenlöschung: {formatDate(session.scheduled_deletion_at, true)}</p>}
              </div>
            </Section>

            <Section title="Verlängerungen">
              <div className="rounded-xl border border-gray-200 bg-white">
                {session.extension_history.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">Keine Verlängerungen</p>
                ) : [...session.extension_history].reverse().map((extension, index) => (
                  <div key={`${extension.extended_at}-${index}`} className="border-b border-gray-100 px-4 py-3 last:border-0">
                    <p className="text-sm font-medium text-gray-900">Um {extension.minutes ?? '?'} Minuten verlängert</p>
                    <p className="text-xs text-gray-400">{formatDate(extension.extended_at, true)} · neues Ziel {formatDate(extension.expected_arrival_at, true)}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <Section title="Kontakte">
            <div className="rounded-xl border border-gray-200 bg-white">
              {session.contacts.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Keine Hostly-Kontakte ausgewählt</p>
              ) : session.contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-0">
                  <div className="flex items-center gap-2"><Users size={15} className="text-gray-400" /><UserLink user={contact.user} /></div>
                  <p className="text-xs text-gray-400">{contact.notified_at ? `Benachrichtigt ${formatDate(contact.notified_at, true)}` : 'Noch nicht benachrichtigt'}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Sicherheitslinks und Live Activities">
            <div className="rounded-xl border border-gray-200 bg-white">
              {session.invites.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Keine Einladungslinks</p>
              ) : session.invites.map((invite) => (
                <div key={invite.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{invite.client_type || 'Web'} · {invite.notification_capability || 'keine Push-Fähigkeit'}</p>
                      <p className="text-xs text-gray-400">Erstellt {formatDate(invite.created_at, true)} · gültig bis {formatDate(invite.expires_at, true)}</p>
                      {invite.claimed_by_user && <p className="mt-1 text-xs text-gray-500">Angenommen von <UserLink user={invite.claimed_by_user} /></p>}
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Badge className={invite.status === 'accepted' ? 'bg-green-100 text-green-700' : invite.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}>{invite.status}</Badge>
                      {invite.has_push_capability && <Badge className="bg-blue-100 text-blue-700">Push</Badge>}
                      {invite.has_live_activity_capability && <Badge className="bg-violet-100 text-violet-700"><Smartphone size={11} className="mr-1" />Live Activity</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Safety-Zugriffsprotokoll">
            <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-white">
              {session.access_audits.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Keine Zugriffe protokolliert</p>
              ) : session.access_audits.map((audit) => (
                <div key={audit.id} className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{AUDIT_ACTIONS[audit.action] || audit.action}</p>
                    <p className="text-xs text-gray-400">{ACTOR_LABELS[audit.actor_type] || audit.actor_type}{audit.actor_id ? ` · Referenz ${audit.actor_id}` : ''}</p>
                  </div>
                  <p className="shrink-0 text-xs text-gray-400">{formatDate(audit.timestamp, true)}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
