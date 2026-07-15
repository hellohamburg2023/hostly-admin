export interface CompactAdminUser {
  id: number
  email: string
  username: string
  display_name: string
  city?: string
  photo_url?: string
  verification_status?: string
  is_deleted?: boolean
}

export interface SafeWalkSession {
  id: number
  public_id: string
  kind: string
  event_id: number | null
  event_title: string
  event_city: string
  user: CompactAdminUser | null
  destination_label: string
  destination_type: string
  transport_mode: string
  expected_arrival_at: string | null
  last_extended_at: string | null
  last_extension_minutes: number | null
  extension_history: { minutes?: number; extended_at?: string; expected_arrival_at?: string }[]
  grace_minutes: number
  last_latitude: string | null
  last_longitude: string | null
  location_disclosure: 'emergency' | 'protected' | 'unavailable'
  last_location_at: string | null
  last_upload_at: string | null
  last_app_contact_at: string | null
  last_known_accuracy: number | null
  note: string
  status: string
  check_in_sent_at: string | null
  started_at: string | null
  arrival_due_at: string | null
  meeting_activated_at: string | null
  arrived_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  escalated_at: string | null
  scheduled_deletion_at: string | null
  trusted_contact_type: string
  trusted_hostly_user: CompactAdminUser | null
  owner_activity_token_updated_at: string | null
  version: number
  created_at: string
  updated_at: string
  overdue_minutes: number
  needs_attention: boolean
  contact_count: number
  invite_count: number
  accepted_invite_count: number
  location_point_count: number
  access_count: number
}

export interface SafeWalkDetail extends SafeWalkSession {
  contacts: { id: number; user: CompactAdminUser; notified_at: string | null; created_at: string }[]
  invites: {
    id: number
    status: string
    claimed_at: string | null
    revoked_at: string | null
    expires_at: string
    claimed_by_user: CompactAdminUser | null
    client_type: string
    notification_capability: string
    activity_bundle_id: string
    activity_token_updated_at: string | null
    has_push_capability: boolean
    has_live_activity_capability: boolean
    created_at: string
  }[]
  access_audits: { id: number; actor_type: string; actor_id: string; action: string; timestamp: string }[]
  meeting_snapshot: {
    event_id: number | null
    other_participant: CompactAdminUser | null
    captured_at: string
  } | null
}

export const SAFETY_STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  waiting_for_trusted_contact: 'Wartet auf Vertrauenskontakt',
  ready: 'Startbereit',
  active: 'Aktiv',
  arrival_due: 'Ankunft fällig',
  grace_period: 'Check-in offen',
  escalated: 'Eskaliert',
  completed_safe: 'Sicher beendet',
  completed_after_escalation: 'Nach Eskalation beendet',
  cancelled: 'Abgebrochen',
  expired: 'Abgelaufen',
  deleted: 'Gelöscht',
  arrived: 'Angekommen (alt)',
}

export const SAFETY_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  waiting_for_trusted_contact: 'bg-slate-100 text-slate-700',
  ready: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  arrival_due: 'bg-amber-100 text-amber-800',
  grace_period: 'bg-orange-100 text-orange-800',
  escalated: 'bg-red-100 text-red-700',
  completed_safe: 'bg-emerald-100 text-emerald-700',
  completed_after_escalation: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-500',
  deleted: 'bg-gray-100 text-gray-400',
  arrived: 'bg-blue-100 text-blue-700',
}

export const SAFETY_KIND_LABELS: Record<string, string> = {
  safe_walk: 'Safe Walk',
  meeting_safety: 'Meeting Safety',
}

export const TRUST_MODE_LABELS: Record<string, string> = {
  hostly: 'Hostly-Kontakt',
  external: 'Externer Kontakt',
  link: 'Sicherheitslink',
}

export const TRANSPORT_LABELS: Record<string, string> = {
  walk: 'Zu Fuß',
  bike: 'Fahrrad',
  car: 'Auto',
  transit: 'ÖPNV',
}

export function freshnessLabel(value: string | null) {
  if (!value) return 'Kein Signal'
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return 'Gerade eben'
  if (minutes < 60) return `vor ${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`
  return `vor ${Math.floor(hours / 24)} Tagen`
}
