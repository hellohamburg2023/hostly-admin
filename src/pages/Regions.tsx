import { useEffect, useMemo, useState } from 'react'
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
  status: string
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
  is_test_user: boolean
  region_id: number
  region_name: string
  launch_role: 'guest' | 'host' | 'both' | ''
  status: 'waiting' | 'active' | 'left'
  origin: 'onboarding' | 'migration' | 'manual'
  joined_at: string
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
  const [defaultRadius, setDefaultRadius] = useState('40')
  const [defaultMembers, setDefaultMembers] = useState('20')
  const [defaultHosts, setDefaultHosts] = useState('2')

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

  const totals = useMemo(() => ({
    active: regions.filter((region) => region.status === 'active').length,
    waiting: regions.filter((region) => region.status === 'waitlist').length,
    paused: regions.filter((region) => region.status === 'paused').length,
    automatic: regions.filter((region) => region.creation_source !== 'manual').length,
    waitingMembers: regions.reduce((sum, region) => sum + region.member_count, 0),
    waitingHosts: regions.reduce((sum, region) => sum + region.host_count, 0),
  }), [regions])

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
      await queryClient.invalidateQueries({ queryKey: ['regional-configuration'] })
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  })
  const activationMutation = useMutation({
    mutationFn: activateRegionalWaitlist,
    onSuccess: async (result: MigrationResult) => {
      setMigrationResult(result)
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
          <p className="mt-1 max-w-3xl text-sm text-gray-500">Radien, individuelle Startschwellen, Wartelisten-Fortschritt, Push-Ergebnisse und Regionsstatus zentral verwalten.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
          <Plus size={17} /> Region anlegen
        </button>
      </div>

      <ErrorBanner message={loadError ? getApiErrorMessage(loadError) : actionError} />

      <section className={`mb-6 rounded-2xl border p-5 ${configuration.data?.regional_waitlist_enabled ? 'border-green-200 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
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
              <p className="mt-1 text-sm text-gray-600">
                {configuration.data?.regional_waitlist_enabled
                  ? 'Ein: Neue Wohnorte werden als Wartelisten-Region vorbereitet. Normale Nutzer wählen Region und Startrolle; Testuser und Superuser behalten Vollzugriff.'
                  : 'Aus: Normale Nutzer behalten Vollzugriff. Beim Aktivieren werden Wohnorte nur als Wartelisten-Regionen vorbereitet – niemand wird dadurch automatisch freigeschaltet.'}
              </p>
              <p className="mt-1 text-xs text-gray-400">Zuletzt geändert: {formatDate(configuration.data?.updated_at ?? null)}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={configMutation.isPending || activationMutation.isPending}
            onClick={() => {
              if (configuration.data?.regional_waitlist_enabled) {
                configMutation.mutate({ regional_waitlist_enabled: false })
                return
              }
              if (window.confirm('City-Start jetzt aktivieren? Bestehende Wohnorte werden automatisch als Wartelisten-Regionen vorbereitet. Nutzer in diesen Städten wählen anschließend ihre Region und Startrolle. Nur bereits bewusst aktive Regionen gewähren Vollzugriff.')) {
                activationMutation.mutate()
              }
            }}
            className={`inline-flex w-full max-w-full items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 lg:w-auto ${
              configuration.data?.regional_waitlist_enabled
                ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                : 'border-gray-900 bg-gray-900 text-white hover:bg-gray-800'
            }`}
            aria-label="Regionsbasierte Warteliste umschalten"
            aria-pressed={Boolean(configuration.data?.regional_waitlist_enabled)}
          >
            <span>{activationMutation.isPending ? 'Wohnorte werden vorbereitet…' : configuration.data?.regional_waitlist_enabled ? 'City-Start deaktivieren' : 'Wohnorte vorbereiten & City-Start aktivieren'}</span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${configuration.data?.regional_waitlist_enabled ? 'bg-green-600' : 'bg-white/25'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${configuration.data?.regional_waitlist_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span>
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-gray-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Bestehende Wohnorte vorbereiten</p>
            <p className="mt-0.5 text-xs text-gray-500">Prüft Bestandsdaten, ohne Wartelisten-Nutzer automatisch freizuschalten.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={migrationMutation.isPending} onClick={() => migrationMutation.mutate(false)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Vorbereitung prüfen
            </button>
            <button
              type="button"
              disabled={migrationMutation.isPending}
              onClick={() => {
                if (window.confirm('Bestehende Wohnorte jetzt als Wartelisten-Regionen vorbereiten? Nutzer werden nur vorhandenen aktiven Regionen zugeordnet; alle anderen wählen Region und Startrolle selbst.')) {
                  migrationMutation.mutate(true)
                }
              }}
              className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              Wohnorte vorbereiten
            </button>
          </div>
        </div>
        {migrationResult && (
          <div className="mt-4 grid gap-2 rounded-xl border border-violet-100 bg-white/70 p-3 text-xs text-gray-600 sm:grid-cols-3 lg:grid-cols-5">
            <span><strong className="text-gray-900">{migrationResult.stats.regions_created}</strong> Regionen {migrationResult.applied ? 'angelegt' : 'neu erforderlich'}</span>
            <span><strong className="text-gray-900">{migrationResult.stats.users_assigned}</strong> Nutzer {migrationResult.applied ? 'zugeordnet' : 'zuordenbar'}</span>
            <span><strong className="text-gray-900">{migrationResult.stats.users_unmatched}</strong> ohne verwertbaren Wohnort</span>
            <span><strong className="text-gray-900">{migrationResult.stats.users_requiring_selection}</strong> brauchen die Regionsauswahl</span>
            <span><strong className="text-gray-900">{migrationResult.stats.events_assigned}</strong> Events {migrationResult.applied ? 'zugeordnet' : 'zuordenbar'}</span>
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

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric icon={MapPin} label="Regionen" value={regions.length} sub={`${totals.active} aktiv · ${totals.automatic} automatisch`} />
        <Metric icon={Activity} label="Im Aufbau" value={totals.waiting} sub={`${totals.paused} pausiert`} />
        <Metric icon={Users} label="Vorgemerkte Nutzer" value={totals.waitingMembers} sub="über alle Wartelisten" />
        <Metric icon={Gauge} label="Startbereite Hosts" value={totals.waitingHosts} sub="Host oder Gast & Host" />
        <Metric icon={BellRing} label="Start-Pushes" value={regions.filter((region) => region.notification_job?.status === 'completed').length} sub="abgeschlossene Jobs" />
      </div>

      {formOpen && (
        <div className="mb-6">
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
              <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-4 text-center">
                <div><p className="text-xl font-bold text-gray-900">{region.active_member_count}</p><p className="text-xs text-gray-500">Zuordnungen</p></div>
                <div><p className="text-xl font-bold text-gray-900">{region.event_count}</p><p className="text-xs text-gray-500">Events</p></div>
                <div><p className="text-sm font-semibold text-gray-900">{formatDate(region.activated_at)}</p><p className="text-xs text-gray-500">Gestartet</p></div>
              </div>
            )}

            {region.notification_job && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-blue-900">Start-Push: {region.notification_job.status}</span>
                  <span className="text-xs text-blue-700">{region.notification_job.accepted_device_count}/{region.notification_job.eligible_device_count} angenommen</span>
                </div>
                {region.notification_job.last_error && <p className="mt-1 text-xs text-red-700">{region.notification_job.last_error}</p>}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              <button type="button" onClick={() => setSelectedRegionId(selectedRegionId === region.id ? null : region.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                <Users size={14} /> Mitglieder
              </button>
              {region.status === 'waitlist' && (
                <button type="button" onClick={() => actionMutation.mutate({ id: region.id, action: 'evaluate' })} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                  <RefreshCw size={14} /> Neu bewerten
                </button>
              )}
              {region.notification_job?.status === 'failed' && (
                <button type="button" onClick={() => actionMutation.mutate({ id: region.id, action: 'retry-launch-push' })} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                  <BellRing size={14} /> Push erneut senden
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
              {region.member_count === 0 && region.active_member_count === 0 && region.event_count === 0 && (
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
        <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h3 className="font-semibold text-gray-900">Regionsmitgliedschaften</h3>
              <p className="mt-0.5 text-sm text-gray-500">{regions.find((region) => region.id === selectedRegionId)?.name}</p>
            </div>
            <button type="button" onClick={() => setSelectedRegionId(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X size={17} /></button>
          </div>
          {membershipsQuery.isLoading ? (
            <p className="p-5 text-sm text-gray-400">Mitgliedschaften werden geladen…</p>
          ) : membershipsQuery.error ? (
            <div className="p-5"><ErrorBanner message={getApiErrorMessage(membershipsQuery.error)} /></div>
          ) : memberships.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr><th className="px-5 py-3">Mitglied</th><th className="px-5 py-3">Startrolle</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Quelle</th><th className="px-5 py-3">Beigetreten</th><th className="px-5 py-3">Begrüßung</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {memberships.map((membership) => (
                    <tr key={membership.id}>
                      <td className="px-5 py-3"><p className="font-medium text-gray-900">{membership.user_display_name || membership.user_email}</p><p className="text-xs text-gray-500">{membership.user_email} · {membership.user_city || 'Ohne Ort'}</p></td>
                      <td className="px-5 py-3 text-gray-700">{ROLE_LABELS[membership.launch_role]}</td>
                      <td className="px-5 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{membership.status}</span></td>
                      <td className="px-5 py-3 text-gray-600">{membership.origin}</td>
                      <td className="px-5 py-3 text-gray-600">{formatDate(membership.joined_at)}</td>
                      <td className="px-5 py-3">{membership.launch_welcome_seen_at ? <Check size={16} className="text-green-600" /> : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-5 text-sm text-gray-400">Für diese Region gibt es noch keine Mitgliedschaften.</p>
          )}
        </section>
      )}
    </div>
  )
}
