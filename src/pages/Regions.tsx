import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  BellRing,
  Check,
  CirclePause,
  Gauge,
  MapPin,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
  activateRegionalWaitlist,
  createRegion,
  deleteRegion,
  getApiErrorMessage,
  getRegionalConfiguration,
  getRegionMemberships,
  getRegions,
  migrateExistingRegions,
  pageResults,
  patchRegion,
  patchRegionalConfiguration,
  runRegionAction,
} from '../api'
import { ErrorBanner } from '../adminUi'

type RegionStatus = 'waitlist' | 'active' | 'paused'

interface RegionalConfiguration {
  id: number
  regional_waitlist_enabled: boolean
  default_radius_km: string
  default_member_threshold: number
  default_host_threshold: number
  updated_at: string
}

interface NotificationJob {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  recipient_count: number
  eligible_device_count: number
  accepted_device_count: number
  rejected_device_count: number
  disabled_recipient_count: number
  no_device_recipient_count: number
  completed_at: string | null
  last_error: string
}

interface Region {
  id: number
  name: string
  center_latitude: string
  center_longitude: string
  radius_km: string
  status: RegionStatus
  creation_source: 'manual' | 'automatic' | 'migration'
  member_threshold: number
  host_threshold: number
  activated_at: string | null
  member_count: number
  host_count: number
  members_missing: number
  hosts_missing: number
  active_member_count: number
  visitor_count: number
  selected_visitor_count: number
  event_count: number
  notification_job: NotificationJob | null
  updated_at: string
}

interface Membership {
  id: number
  user_id: number
  user_email: string
  user_display_name: string
  user_city: string
  user_deleted_at?: string | null
  user_is_deleted?: boolean
  is_test_user: boolean
  region_id: number
  region_name: string
  launch_role: 'guest' | 'host' | 'both' | ''
  status: 'waiting' | 'active' | 'left'
  origin: 'onboarding' | 'migration' | 'manual'
  is_home: boolean
  is_selected_visit: boolean
  visit_started_at: string | null
  joined_at: string
  join_welcome_seen_at: string | null
  launch_welcome_seen_at: string | null
}

interface RegionForm {
  name: string
  center_latitude: string
  center_longitude: string
  radius_km: string
  member_threshold: string
  host_threshold: string
}

interface MigrationResult {
  applied: boolean
  stats: {
    users_assigned: number
    users_already_assigned: number
    users_unmatched: number
    users_requiring_selection: number
    users_bypassed: number
    regions_created: number
    regions_reused: number
    events_assigned: number
    events_unmatched: number
  }
}

const EMPTY_FORM: RegionForm = {
  name: '',
  center_latitude: '',
  center_longitude: '',
  radius_km: '40',
  member_threshold: '20',
  host_threshold: '2',
}

const STATUS_LABELS: Record<RegionStatus, string> = {
  waitlist: 'Im Aufbau',
  active: 'Aktiv',
  paused: 'Pausiert',
}

const ROLE_LABELS: Record<Membership['launch_role'], string> = {
  guest: 'Gast',
  host: 'Host',
  both: 'Gast & Host',
  '': '–',
}

function pct(value: number, target: number) {
  if (!target) return 0
  return Math.min(100, Math.round((value / target) * 100))
}

function formatDate(value: string | null) {
  if (!value) return '–'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '–' : date.toLocaleString('de-DE')
}

function statusClasses(status: RegionStatus) {
  if (status === 'active') return 'border-green-200 bg-green-50 text-green-700'
  if (status === 'paused') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-violet-200 bg-violet-50 text-violet-700'
}

function membershipAccessLabel(membership: Membership) {
  if (isDeletedMembership(membership)) return 'Kein Zugang'
  if (membership.status === 'left') return 'Beendet'
  if (membership.is_home) return 'Heimatregion'
  if (membership.is_selected_visit) return 'Gastzugang aktiv'
  if (membership.status === 'active') return 'Früherer Besuch'
  return 'Ungültige Zuordnung'
}

function membershipAccessClasses(membership: Membership) {
  if (isDeletedMembership(membership)) return 'bg-gray-100 text-gray-600'
  if (membership.status === 'left') return 'bg-gray-100 text-gray-600'
  if (membership.is_home) return 'bg-blue-50 text-blue-700'
  if (membership.is_selected_visit) return 'bg-violet-100 text-violet-800'
  if (membership.status === 'active') return 'bg-gray-100 text-gray-600'
  return 'bg-red-50 text-red-700'
}

function membershipStatusLabel(membership: Membership) {
  if (isDeletedMembership(membership)) return 'Konto gelöscht'
  if (membership.status === 'waiting') return 'Wartet auf City-Start'
  if (membership.status === 'active') return 'Aktiv'
  return 'Beendet'
}

function membershipStatusClasses(membership: Membership) {
  if (isDeletedMembership(membership)) return 'bg-red-50 text-red-700'
  if (membership.status === 'waiting') return 'bg-amber-50 text-amber-700'
  if (membership.status === 'active') return 'bg-green-50 text-green-700'
  return 'bg-gray-100 text-gray-600'
}

function isDeletedMembership(membership: Membership) {
  return Boolean(
    membership.user_is_deleted
    || membership.user_email.endsWith('@deleted.hostly.invalid'),
  )
}

function deletedAccountLabel(membership: Membership) {
  return membership.user_deleted_at
    ? `Konto gelöscht am ${formatDate(membership.user_deleted_at)}`
    : 'Konto gelöscht'
}

function notificationJobPresentation(job: NotificationJob) {
  if (job.status === 'pending') {
    return {
      title: 'Startbenachrichtigung vorgemerkt',
      detail: 'Der automatische Versand steht noch aus.',
      classes: 'border-blue-200 bg-blue-50 text-blue-900',
    }
  }
  if (job.status === 'processing') {
    return {
      title: 'Startbenachrichtigung wird versendet',
      detail: 'Der Versand wird gerade verarbeitet.',
      classes: 'border-blue-200 bg-blue-50 text-blue-900',
    }
  }
  if (job.status === 'failed') {
    return {
      title: 'Versand technisch fehlgeschlagen',
      detail: 'Der Versandjob konnte nach mehreren Versuchen nicht abgeschlossen werden.',
      classes: 'border-red-200 bg-red-50 text-red-900',
    }
  }
  if (job.recipient_count === 0) {
    return {
      title: 'Keine Startbenachrichtigung nötig',
      detail: 'Beim Start gab es keine aktiven Heimatnutzer.',
      classes: 'border-gray-200 bg-gray-50 text-gray-800',
    }
  }
  if (job.accepted_device_count > 0 && job.rejected_device_count > 0) {
    return {
      title: 'Startbenachrichtigung teilweise angenommen',
      detail: `${job.accepted_device_count} von ${job.eligible_device_count} Geräten wurden vom Push-Dienst angenommen.`,
      classes: 'border-amber-200 bg-amber-50 text-amber-900',
    }
  }
  if (job.accepted_device_count > 0) {
    return {
      title: 'Startbenachrichtigung an Push-Dienst übergeben',
      detail: `${job.accepted_device_count} ${job.accepted_device_count === 1 ? 'Gerät wurde' : 'Geräte wurden'} vom Push-Dienst angenommen.`,
      classes: 'border-green-200 bg-green-50 text-green-900',
    }
  }
  if (job.rejected_device_count > 0) {
    return {
      title: 'Startbenachrichtigung abgelehnt',
      detail: `${job.rejected_device_count} ${job.rejected_device_count === 1 ? 'Gerät wurde' : 'Geräte wurden'} vom Push-Dienst abgelehnt.`,
      classes: 'border-red-200 bg-red-50 text-red-900',
    }
  }
  if (job.no_device_recipient_count > 0) {
    return {
      title: 'Keine registrierten Push-Geräte',
      detail: `${job.no_device_recipient_count} ${job.no_device_recipient_count === 1 ? 'Nutzer hat' : 'Nutzer haben'} kein aktives Push-Gerät.`,
      classes: 'border-amber-200 bg-amber-50 text-amber-900',
    }
  }
  if (job.disabled_recipient_count > 0) {
    return {
      title: 'Startbenachrichtigungen deaktiviert',
      detail: `${job.disabled_recipient_count} ${job.disabled_recipient_count === 1 ? 'Nutzer hat' : 'Nutzer haben'} Regions-Benachrichtigungen deaktiviert.`,
      classes: 'border-gray-200 bg-gray-50 text-gray-800',
    }
  }
  return {
    title: 'Keine Startbenachrichtigung versendet',
    detail: 'Es gab kein erreichbares Push-Gerät.',
    classes: 'border-amber-200 bg-amber-50 text-amber-900',
  }
}

function canRetryLaunchNotification(job: NotificationJob) {
  return job.status === 'failed'
    || (
      job.status === 'completed'
      && job.accepted_device_count === 0
      && job.rejected_device_count > 0
    )
}

function RegionNotificationResult({ job }: { job: NotificationJob }) {
  const presentation = notificationJobPresentation(job)
  return (
    <div className={`mt-4 rounded-xl border p-3 text-sm ${presentation.classes}`}>
      <p className="font-semibold">{presentation.title}</p>
      <p className="mt-1 text-xs opacity-80">{presentation.detail}</p>
      {(job.disabled_recipient_count > 0 || job.no_device_recipient_count > 0 || job.rejected_device_count > 0) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80">
          {job.rejected_device_count > 0 && <span>{job.rejected_device_count} abgelehnt</span>}
          {job.no_device_recipient_count > 0 && <span>{job.no_device_recipient_count} ohne Push-Gerät</span>}
          {job.disabled_recipient_count > 0 && <span>{job.disabled_recipient_count} deaktiviert</span>}
        </div>
      )}
      {job.last_error && <p className="mt-2 text-xs font-medium text-red-700">{job.last_error}</p>}
      {job.status === 'completed' && job.accepted_device_count > 0 && (
        <p className="mt-2 text-[11px] opacity-65">Die Annahme durch den Push-Dienst ist keine Empfangs- oder Lesebestätigung.</p>
      )}
    </div>
  )
}

function Metric({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub: string; icon: typeof Users }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{sub}</p>
        </div>
        <span className="rounded-lg bg-violet-50 p-2 text-violet-600"><Icon size={18} /></span>
      </div>
    </div>
  )
}

function ProgressRow({ label, value, target }: { label: string; value: number; target: number }) {
  const progress = pct(value, target)
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold tabular-nums text-gray-900">{value} / {target}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function RegionFormPanel({
  form,
  editing,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: RegionForm
  editing: Region | null
  saving: boolean
  onChange: (field: keyof RegionForm, value: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  const radius = Math.max(1, Number(form.radius_km) || 1)
  const previewScale = Math.min(92, Math.max(24, 28 + Math.log10(radius) * 30))
  return (
    <section className="rounded-2xl border border-violet-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-gray-900">{editing ? `${editing.name} bearbeiten` : 'Neue Region'}</h3>
          <p className="mt-0.5 text-sm text-gray-500">Mittelpunkt, Radius und Startschwellen festlegen.</p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Formular schließen">
          <X size={18} />
        </button>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Regionsname</span>
            <input value={form.name} onChange={(e) => onChange('name', e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="z. B. Hamburg" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Breitengrad</span>
            <input type="number" step="0.000001" value={form.center_latitude} onChange={(e) => onChange('center_latitude', e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="53.551086" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Längengrad</span>
            <input type="number" step="0.000001" value={form.center_longitude} onChange={(e) => onChange('center_longitude', e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="9.993682" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Radius in km</span>
            <input type="number" min="1" step="0.1" value={form.radius_km} onChange={(e) => onChange('radius_km', e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
          <div className="hidden sm:block" />
          <label>
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Mitglieder bis Start</span>
            <input type="number" min="1" value={form.member_threshold} onChange={(e) => onChange('member_threshold', e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Hosts bis Start</span>
            <input type="number" min="1" value={form.host_threshold} onChange={(e) => onChange('host_threshold', e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
        </div>
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50 to-white p-4 text-center">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <div className="absolute rounded-full border-2 border-violet-400 bg-violet-200/40 transition-all" style={{ width: previewScale, height: previewScale }} />
            <span className="relative rounded-full bg-violet-600 p-2 text-white shadow"><MapPin size={18} /></span>
          </div>
          <p className="font-semibold text-gray-900">{form.name || 'Neue Region'}</p>
          <p className="mt-1 text-sm text-gray-500">Radius {radius.toLocaleString('de-DE')} km</p>
          <p className="mt-2 text-xs text-gray-400">{form.center_latitude || '–'}, {form.center_longitude || '–'}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
        <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
        <button type="button" disabled={saving} onClick={onSubmit} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
          <Save size={16} /> {saving ? 'Speichert…' : editing ? 'Änderungen speichern' : 'Region anlegen'}
        </button>
      </div>
    </section>
  )
}

export default function RegionsPage() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Region | null>(null)
  const [form, setForm] = useState<RegionForm>(EMPTY_FORM)
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null)
  const [configurationIntent, setConfigurationIntent] = useState<'enable' | 'disable' | null>(null)
  const [defaultRadius, setDefaultRadius] = useState('40')
  const [defaultMembers, setDefaultMembers] = useState('20')
  const [defaultHosts, setDefaultHosts] = useState('2')
  const formPanelRef = useRef<HTMLDivElement>(null)
  const membershipsPanelRef = useRef<HTMLElement>(null)

  const configuration = useQuery<RegionalConfiguration>({
    queryKey: ['regional-configuration'],
    queryFn: getRegionalConfiguration,
  })
  const regionsQuery = useQuery({
    queryKey: ['regions'],
    queryFn: () => getRegions(),
  })
  const regions = pageResults<Region>(regionsQuery.data)
  const membershipsQuery = useQuery({
    queryKey: ['region-memberships', selectedRegionId],
    queryFn: () => getRegionMemberships({ region: String(selectedRegionId) }),
    enabled: selectedRegionId !== null,
  })
  const memberships = pageResults<Membership>(membershipsQuery.data)

  useEffect(() => {
    if (!configuration.data) return
    setDefaultRadius(String(configuration.data.default_radius_km))
    setDefaultMembers(String(configuration.data.default_member_threshold))
    setDefaultHosts(String(configuration.data.default_host_threshold))
  }, [configuration.data])

  useEffect(() => {
    if (!formOpen) return
    const frame = window.requestAnimationFrame(() => {
      formPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [formOpen, editing?.id])

  useEffect(() => {
    if (selectedRegionId === null) return
    const frame = window.requestAnimationFrame(() => {
      membershipsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedRegionId, membershipsQuery.isLoading, memberships.length])

  const totals = useMemo(() => ({
    active: regions.filter((region) => region.status === 'active').length,
    waiting: regions.filter((region) => region.status === 'waitlist').length,
    paused: regions.filter((region) => region.status === 'paused').length,
    automatic: regions.filter((region) => region.creation_source !== 'manual').length,
    waitingMembers: regions.reduce((sum, region) => sum + region.member_count, 0),
    waitingHosts: regions.reduce((sum, region) => sum + region.host_count, 0),
    visitors: regions.reduce((sum, region) => sum + region.visitor_count, 0),
    selectedVisitors: regions.reduce((sum, region) => sum + region.selected_visitor_count, 0),
    eligibleLaunchDevices: regions.reduce((sum, region) => sum + (region.notification_job?.eligible_device_count ?? 0), 0),
    acceptedLaunchDevices: regions.reduce((sum, region) => sum + (region.notification_job?.accepted_device_count ?? 0), 0),
  }), [regions])
  const migrationHasChanges = Boolean(migrationResult && (
    migrationResult.stats.regions_created > 0
    || migrationResult.stats.users_assigned > 0
    || migrationResult.stats.events_assigned > 0
  ))

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['regions'] }),
      queryClient.invalidateQueries({ queryKey: ['region-memberships'] }),
      queryClient.invalidateQueries({ queryKey: ['stats'] }),
    ])
  }

  const configMutation = useMutation({
    mutationFn: patchRegionalConfiguration,
    onSuccess: async () => {
      setConfigurationIntent(null)
      setActionError('')
      await queryClient.invalidateQueries({ queryKey: ['regional-configuration'] })
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  })
  const activationMutation = useMutation({
    mutationFn: activateRegionalWaitlist,
    onSuccess: async (result: MigrationResult) => {
      setMigrationResult(result)
      setConfigurationIntent(null)
      setActionError('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['regional-configuration'] }),
        invalidate(),
      ])
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  })
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        center_latitude: form.center_latitude,
        center_longitude: form.center_longitude,
        radius_km: form.radius_km,
        member_threshold: Number(form.member_threshold),
        host_threshold: Number(form.host_threshold),
      }
      return editing ? patchRegion(editing.id, payload) : createRegion(payload)
    },
    onSuccess: async () => {
      setFormOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      setActionError('')
      await invalidate()
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  })
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'evaluate' | 'pause' | 'resume' | 'retry-launch-push' }) => runRegionAction(id, action),
    onSuccess: invalidate,
    onError: (error) => setActionError(getApiErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteRegion,
    onSuccess: invalidate,
    onError: (error) => setActionError(getApiErrorMessage(error)),
  })
  const migrationMutation = useMutation({
    mutationFn: migrateExistingRegions,
    onSuccess: async (result: MigrationResult) => {
      setMigrationResult(result)
      setActionError('')
      if (result.applied) await invalidate()
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
    setActionError('')
  }
  const openEdit = (region: Region) => {
    setEditing(region)
    setForm({
      name: region.name,
      center_latitude: region.center_latitude,
      center_longitude: region.center_longitude,
      radius_km: region.radius_km,
      member_threshold: String(region.member_threshold),
      host_threshold: String(region.host_threshold),
    })
    setFormOpen(true)
    setActionError('')
  }

  if (configuration.isLoading || regionsQuery.isLoading) {
    return <div className="p-8 text-gray-400">Regionen werden geladen…</div>
  }

  const loadError = configuration.error || regionsQuery.error
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Regionen & City-Start</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">Heimatregionen, Wartelisten-Fortschritt, aktive Gastzugänge, Push-Ergebnisse und Regionsstatus zentral verwalten.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
          <Plus size={17} /> Region anlegen
        </button>
      </div>

      <ErrorBanner message={loadError ? getApiErrorMessage(loadError) : actionError} />

      {formOpen && (
        <div ref={formPanelRef} className="mb-6 scroll-mt-4">
          <RegionFormPanel
            form={form}
            editing={editing}
            saving={saveMutation.isPending}
            onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
            onCancel={() => { setFormOpen(false); setEditing(null); setForm(EMPTY_FORM) }}
            onSubmit={() => saveMutation.mutate()}
          />
        </div>
      )}

      <section className={`mb-6 rounded-2xl border p-5 ${configuration.data?.regional_waitlist_enabled ? 'border-green-200 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="flex items-start gap-3">
            <span className={`rounded-xl p-2.5 ${configuration.data?.regional_waitlist_enabled ? 'bg-green-100 text-green-700' : 'border border-gray-200 bg-white text-gray-500'}`}>
              {configuration.data?.regional_waitlist_enabled ? <Activity size={20} /> : <CirclePause size={20} />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-gray-900">Regionsbasierte Warteliste</h3>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                  configuration.data?.regional_waitlist_enabled
                    ? 'bg-green-700 text-white'
                    : 'border border-gray-300 bg-white text-gray-600'
                }`}>
                  {configuration.data?.regional_waitlist_enabled ? 'AKTIV' : 'DEAKTIVIERT'}
                </span>
              </div>
              <p className="mt-1 max-w-4xl text-sm leading-5 text-gray-600" aria-live="polite">
                {configuration.data?.regional_waitlist_enabled
                  ? 'Neue Wohnorte werden für den City-Start vorbereitet. Wartende Nutzer können eine bereits aktive Region als Gast öffnen, dort teilnehmen oder hosten; ihre Heimatregion und deren Fortschritt bleiben unverändert.'
                  : 'Der City-Start ist ausgeschaltet. Normale Nutzer haben Vollzugriff; bestehende Regionen und Wartelistendaten bleiben erhalten.'}
              </p>
              <p className="mt-1 text-xs text-gray-400">Zuletzt geändert: {formatDate(configuration.data?.updated_at ?? null)}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={configMutation.isPending || activationMutation.isPending}
            onClick={() => setConfigurationIntent(configuration.data?.regional_waitlist_enabled ? 'disable' : 'enable')}
            className={`inline-flex min-h-11 w-full max-w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 lg:w-auto ${
              configuration.data?.regional_waitlist_enabled
                ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                : 'border-violet-600 bg-violet-600 text-white hover:bg-violet-700'
            }`}
            aria-expanded={configurationIntent !== null}
            aria-controls="city-start-confirmation"
          >
            {configuration.data?.regional_waitlist_enabled ? <CirclePause size={17} /> : <Play size={17} />}
            <span>{configuration.data?.regional_waitlist_enabled ? 'City-Start ausschalten' : 'City-Start aktivieren'}</span>
          </button>
        </div>
        {configurationIntent && (
          <div
            id="city-start-confirmation"
            role="alert"
            className={`mt-4 rounded-xl border p-4 ${
              configurationIntent === 'disable'
                ? 'border-amber-200 bg-amber-50'
                : 'border-violet-200 bg-violet-50'
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {configurationIntent === 'disable' ? 'City-Start wirklich ausschalten?' : 'City-Start jetzt aktivieren?'}
                </p>
                <p className="mt-1 max-w-3xl text-sm leading-5 text-gray-600">
                  {configurationIntent === 'disable'
                    ? 'Normale Nutzer erhalten wieder Vollzugriff. Regionen und Wartelistendaten werden nicht gelöscht.'
                    : 'Bestehende Wohnorte werden vorbereitet. Nutzer wählen Heimatregion und Startrolle. Solange sie warten, können sie genau eine bereits aktive Region als Gast öffnen, ohne den Heimat-Launch zu verlassen.'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={configMutation.isPending || activationMutation.isPending}
                  onClick={() => setConfigurationIntent(null)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={configMutation.isPending || activationMutation.isPending}
                  onClick={() => {
                    if (configurationIntent === 'disable') {
                      configMutation.mutate({ regional_waitlist_enabled: false })
                    } else {
                      activationMutation.mutate()
                    }
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                    configurationIntent === 'disable'
                      ? 'bg-gray-900 hover:bg-gray-800'
                      : 'bg-violet-600 hover:bg-violet-700'
                  }`}
                >
                  {configMutation.isPending || activationMutation.isPending ? (
                    <><RefreshCw className="animate-spin" size={16} /> Wird geändert…</>
                  ) : configurationIntent === 'disable' ? (
                    <><CirclePause size={16} /> Ausschalten</>
                  ) : (
                    <><Play size={16} /> Aktivieren</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 border-t border-gray-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Bestandsdaten für den City-Start</p>
            <p className="mt-0.5 max-w-3xl text-xs leading-5 text-gray-500">
              {configuration.data?.regional_waitlist_enabled
                ? 'Prüft neue oder bisher nicht zugeordnete Wohnorte und Events seit der letzten Vorbereitung.'
                : 'Optional vorab prüfen. Beim Aktivieren des City-Starts wird dieselbe Vorbereitung automatisch ausgeführt.'}
            </p>
          </div>
          <button
            type="button"
            disabled={migrationMutation.isPending}
            onClick={() => migrationMutation.mutate(false)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {migrationMutation.isPending
              ? <><RefreshCw className="animate-spin" size={15} /> Wird geprüft…</>
              : <><RefreshCw size={15} /> {migrationResult ? 'Erneut prüfen' : 'Bestandsdaten prüfen'}</>}
          </button>
        </div>
        {migrationResult && (
          <div className="mt-4 rounded-xl border border-violet-100 bg-white/70 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {migrationResult.applied ? 'Vorbereitung abgeschlossen' : 'Vorschau – noch nichts geändert'}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-gray-500">
                  {migrationResult.applied
                    ? 'Wartelisten-Nutzer wurden nicht automatisch freigeschaltet.'
                    : migrationHasChanges
                      ? 'Prüfe die Zahlen und wende die Vorbereitung anschließend bewusst an.'
                      : 'Der aktuelle Bestand erfordert keine weitere Vorbereitung.'}
                </p>
              </div>
              {!migrationResult.applied && migrationHasChanges && (
                <button
                  type="button"
                  disabled={migrationMutation.isPending}
                  onClick={() => migrationMutation.mutate(true)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  <Play size={15} /> Vorbereitung anwenden
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-2 border-t border-violet-100 pt-3 text-xs text-gray-600 sm:grid-cols-3 lg:grid-cols-5">
              <span><strong className="text-gray-900">{migrationResult.stats.regions_created}</strong> Regionen {migrationResult.applied ? 'angelegt' : 'neu erforderlich'}</span>
              <span><strong className="text-gray-900">{migrationResult.stats.users_assigned}</strong> Nutzer {migrationResult.applied ? 'zugeordnet' : 'zuordenbar'}</span>
              <span><strong className="text-gray-900">{migrationResult.stats.users_unmatched}</strong> ohne verwertbaren Wohnort</span>
              <span><strong className="text-gray-900">{migrationResult.stats.users_requiring_selection}</strong> brauchen die Regionsauswahl</span>
              <span><strong className="text-gray-900">{migrationResult.stats.events_assigned}</strong> Events {migrationResult.applied ? 'zugeordnet' : 'zuordenbar'}</span>
            </div>
          </div>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
        <div>
          <h3 className="font-semibold text-gray-900">Standards für automatisch angelegte Regionen</h3>
          <p className="mt-1 text-sm text-gray-500">Diese Werte gelten nur beim ersten automatischen Anlegen. Jede Stadt kann danach separat angepasst werden.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">Radius in km
            <input type="number" min="1" step="0.1" value={defaultRadius} onChange={(event) => setDefaultRadius(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
          <label className="text-sm font-medium text-gray-700">Mitglieder bis Start
            <input type="number" min="1" value={defaultMembers} onChange={(event) => setDefaultMembers(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
          <label className="text-sm font-medium text-gray-700">Hosts bis Start
            <input type="number" min="1" value={defaultHosts} onChange={(event) => setDefaultHosts(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={configMutation.isPending}
            onClick={() => configMutation.mutate({
              default_radius_km: defaultRadius,
              default_member_threshold: Number(defaultMembers),
              default_host_threshold: Number(defaultHosts),
            })}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <Save size={16} /> Standards speichern
          </button>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric icon={MapPin} label="Regionen" value={regions.length} sub={`${totals.active} aktiv · ${totals.automatic} automatisch`} />
        <Metric icon={Activity} label="Im Aufbau" value={totals.waiting} sub={`${totals.paused} pausiert`} />
        <Metric icon={Users} label="Heimat-Warteliste" value={totals.waitingMembers} sub="zählt für den City-Start" />
        <Metric icon={Gauge} label="Startbereite Hosts" value={totals.waitingHosts} sub="Host oder Gast & Host" />
        <Metric icon={MapPin} label="Gastzugänge" value={totals.selectedVisitors} sub={`${totals.visitors} Besuchende insgesamt`} />
        <Metric icon={BellRing} label="Push-Versand" value={`${totals.acceptedLaunchDevices}/${totals.eligibleLaunchDevices}`} sub="Geräte vom Push-Dienst angenommen" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {regions.map((region) => (
          <article key={region.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-bold text-gray-900">{region.name}</h3>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(region.status)}`}>{STATUS_LABELS[region.status]}</span>
                  {region.creation_source !== 'manual' && (
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                      {region.creation_source === 'migration' ? 'Automatisch aus Bestand' : 'Automatisch'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">Radius {Number(region.radius_km).toLocaleString('de-DE')} km · {region.center_latitude}, {region.center_longitude}</p>
              </div>
              <button type="button" onClick={() => openEdit(region)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-violet-700" aria-label={`${region.name} bearbeiten`}><Pencil size={17} /></button>
            </div>

            {region.status === 'waitlist' ? (
              <div className="mt-5 space-y-4 rounded-xl bg-gray-50 p-4">
                <ProgressRow label="Mitglieder" value={region.member_count} target={region.member_threshold} />
                <ProgressRow label="Hosts" value={region.host_count} target={region.host_threshold} />
                <p className="text-xs text-gray-500">Noch {region.members_missing} Mitglieder und {region.hosts_missing} Hosts bis zum automatischen Start.</p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-4 text-center sm:grid-cols-4">
                <div><p className="text-xl font-bold text-gray-900">{region.active_member_count}</p><p className="text-xs text-gray-500">Heimatnutzer</p></div>
                <div><p className="text-xl font-bold text-violet-700">{region.selected_visitor_count}</p><p className="text-xs text-gray-500">Gastzugänge aktiv</p></div>
                <div><p className="text-xl font-bold text-gray-900">{region.visitor_count}</p><p className="text-xs text-gray-500">Besuchende gesamt</p></div>
                <div><p className="text-xl font-bold text-gray-900">{region.event_count}</p><p className="text-xs text-gray-500">Events</p></div>
              </div>
            )}
            {region.status === 'active' && (
              <p className="mt-2 text-xs text-gray-400">Gestartet: {formatDate(region.activated_at)}</p>
            )}

            {region.notification_job && <RegionNotificationResult job={region.notification_job} />}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedRegionId(selectedRegionId === region.id ? null : region.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
                  selectedRegionId === region.id
                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                aria-expanded={selectedRegionId === region.id}
                aria-controls="region-memberships"
              >
                <Users size={14} /> {selectedRegionId === region.id ? 'Personen ausblenden' : 'Personen & Gastzugänge'}
              </button>
              {region.notification_job && canRetryLaunchNotification(region.notification_job) && (
                <button type="button" onClick={() => actionMutation.mutate({ id: region.id, action: 'retry-launch-push' })} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                  <BellRing size={14} /> Startbenachrichtigung erneut versuchen
                </button>
              )}
              {region.status === 'paused' ? (
                <button type="button" onClick={() => actionMutation.mutate({ id: region.id, action: 'resume' })} className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50">
                  <Play size={14} /> Fortsetzen
                </button>
              ) : (
                <button type="button" onClick={() => actionMutation.mutate({ id: region.id, action: 'pause' })} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50">
                  <CirclePause size={14} /> Pausieren
                </button>
              )}
              {region.member_count === 0 && region.active_member_count === 0 && region.visitor_count === 0 && region.event_count === 0 && (
                <button type="button" onClick={() => { if (window.confirm(`${region.name} wirklich löschen?`)) deleteMutation.mutate(region.id) }} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                  <Trash2 size={14} /> Löschen
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {!regions.length && !formOpen && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <MapPin size={28} className="mx-auto text-gray-300" />
          <h3 className="mt-3 font-semibold text-gray-800">Noch keine Wohnorte erkannt</h3>
          <p className="mt-1 text-sm text-gray-500">Beim Aktivieren werden Regionen automatisch aus den vorhandenen Wohnorten erzeugt. Manuell anlegen musst du nur Sonderfälle.</p>
        </div>
      )}

      {selectedRegionId !== null && (
        <section ref={membershipsPanelRef} id="region-memberships" className="mt-6 min-h-[calc(100dvh-6rem)] scroll-mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white sm:min-h-0">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h3 className="font-semibold text-gray-900">Heimatnutzer & Besuchende</h3>
              <p className="mt-0.5 text-sm text-gray-500">{regions.find((region) => region.id === selectedRegionId)?.name} · Gastzugänge zählen nicht für den City-Start</p>
            </div>
            <button type="button" onClick={() => setSelectedRegionId(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X size={17} /></button>
          </div>
          {membershipsQuery.isLoading ? (
            <p className="p-5 text-sm text-gray-400">Mitgliedschaften werden geladen…</p>
          ) : membershipsQuery.error ? (
            <div className="p-5"><ErrorBanner message={getApiErrorMessage(membershipsQuery.error)} /></div>
          ) : memberships.length ? (
            <div className="admin-table admin-mobile-table overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-gray-200 text-sm">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[9%]" />
                </colgroup>
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr><th className="px-5 py-3">Person</th><th className="px-5 py-3">Zugang</th><th className="px-5 py-3">Rolle</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Beitritt</th><th className="whitespace-nowrap px-4 py-3 text-center">Begrüßt</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {memberships.map((membership) => (
                    <tr key={membership.id} className={isDeletedMembership(membership) ? 'bg-gray-50/60' : undefined}>
                      <td data-label="Person" className="px-5 py-3">
                        <p className={`font-medium ${isDeletedMembership(membership) ? 'text-gray-600' : 'text-gray-900'}`}>
                          {isDeletedMembership(membership) ? 'Gelöschtes Mitglied' : membership.user_display_name || membership.user_email}
                        </p>
                        <p className="mt-0.5 break-words text-xs text-gray-500">
                          {isDeletedMembership(membership)
                            ? deletedAccountLabel(membership)
                            : `${membership.user_email} · ${membership.user_city || 'Ohne Ort'}`}
                        </p>
                      </td>
                      <td data-label="Zugang" className="px-5 py-3">
                        <span className={`inline-flex max-w-full whitespace-normal rounded-full px-2 py-1 text-left text-xs font-semibold leading-4 ${membershipAccessClasses(membership)}`}>
                          {membershipAccessLabel(membership)}
                        </span>
                      </td>
                      <td data-label="Startrolle" className="px-5 py-3 text-gray-700">{ROLE_LABELS[membership.launch_role]}</td>
                      <td data-label="Status" className="px-5 py-3">
                        <span className={`inline-flex max-w-full whitespace-normal rounded-full px-2 py-1 text-left text-xs font-medium leading-4 ${membershipStatusClasses(membership)}`}>
                          {membershipStatusLabel(membership)}
                        </span>
                      </td>
                      <td data-label="Beitritt" className="px-5 py-3 text-gray-600">{formatDate(membership.visit_started_at || membership.joined_at)}</td>
                      <td data-label="Begrüßt" className="px-5 py-3 sm:text-center">{!isDeletedMembership(membership) && membership.join_welcome_seen_at ? <Check size={16} className="text-green-600 sm:mx-auto" /> : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-5 text-sm text-gray-400">Für diese Region gibt es noch keine Heimatnutzer oder Besuchenden.</p>
          )}
        </section>
      )}
    </div>
  )
}
