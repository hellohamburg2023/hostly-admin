import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { BellRing, Check, Search, Send, UserPlus, X } from 'lucide-react'
import {
  getApiErrorMessage,
  getCategories,
  getUser,
  getUsers,
  pageResults,
  previewPushNotification,
  sendPushNotification,
  type AdminPushNotificationDeviceResult,
  type AdminPushNotificationPayload,
  type AdminPushNotificationResult,
} from '../api'
import { ErrorBanner } from '../adminUi'

interface SearchUser {
  id: number
  email: string
  username: string
  profile_display_name: string
  profile_city: string
  is_active: boolean
  is_deleted: boolean
}

interface Category {
  id: number
  name: string
  follower_count: number
}

type TargetType = AdminPushNotificationPayload['target_type']
type CopyField = 'title_de' | 'body_de' | 'title_en' | 'body_en'

const TARGETS: { value: TargetType; label: string; description: string }[] = [
  { value: 'users', label: 'Einzelne Nutzer', description: 'Bis zu 100 gezielt ausgewählte Konten.' },
  { value: 'all', label: 'Alle aktiven Konten', description: 'Alle nicht gesperrten Konten mit erreichbarem Push-Gerät.' },
  { value: 'active_30d', label: 'Letzte 30 Tage aktiv', description: 'Nutzer, die in den letzten 30 Tagen in der App aktiv waren.' },
  { value: 'city', label: 'Stadt', description: 'Alle erreichbaren Nutzer mit derselben Profilstadt.' },
  { value: 'category', label: 'Kategorie-Abonnenten', description: 'Nutzer, die Pushs zu einer Kategorie abonniert haben.' },
]

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200'

export default function PushNotificationsPage() {
  const [searchParams] = useSearchParams()
  const preselectedUserId = Number(searchParams.get('user')) || null
  const [targetType, setTargetType] = useState<TargetType>(preselectedUserId ? 'users' : 'all')
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [city, setCity] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [copy, setCopy] = useState({ title_de: '', body_de: '', title_en: '', body_en: '' })
  const [preview, setPreview] = useState<AdminPushNotificationResult | null>(null)
  const [sentResult, setSentResult] = useState<AdminPushNotificationResult | null>(null)

  const { data: preselectedUser } = useQuery<SearchUser>({
    queryKey: ['push-preselected-user', preselectedUserId],
    queryFn: () => getUser(preselectedUserId as number),
    enabled: Boolean(preselectedUserId),
  })

  useEffect(() => {
    if (!preselectedUser) return
    setSelectedUsers((current) => current.some((user) => user.id === preselectedUser.id)
      ? current
      : [...current, preselectedUser])
  }, [preselectedUser])

  const { data: userData, isFetching: searchingUsers } = useQuery({
    queryKey: ['push-user-search', userSearch],
    queryFn: () => getUsers({ q: userSearch.trim(), is_active: 'true', account_state: 'registered' }),
    enabled: targetType === 'users' && userSearch.trim().length >= 2,
  })
  const userResults = pageResults<SearchUser>(userData)

  const { data: categoryData, error: categoryError } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    enabled: targetType === 'category',
  })
  const categories = pageResults<Category>(categoryData)

  const previewMutation = useMutation({
    mutationFn: previewPushNotification,
    onSuccess: (result) => {
      setPreview(result)
      setSentResult(null)
    },
  })
  const sendMutation = useMutation({
    mutationFn: sendPushNotification,
    onSuccess: (result) => {
      setSentResult(result)
      setPreview(null)
    },
  })

  const resetOutcome = () => {
    setPreview(null)
    setSentResult(null)
    previewMutation.reset()
    sendMutation.reset()
  }

  const changeTarget = (value: TargetType) => {
    setTargetType(value)
    resetOutcome()
  }

  const updateCopy = (field: CopyField, value: string) => {
    setCopy((current) => ({ ...current, [field]: value }))
    resetOutcome()
  }

  const addUser = (user: SearchUser) => {
    setSelectedUsers((current) => current.some((item) => item.id === user.id) ? current : [...current, user])
    setUserSearch('')
    resetOutcome()
  }

  const removeUser = (id: number) => {
    setSelectedUsers((current) => current.filter((user) => user.id !== id))
    resetOutcome()
  }

  const buildPayload = (): AdminPushNotificationPayload => ({
    target_type: targetType,
    ...(targetType === 'users' ? { user_ids: selectedUsers.map((user) => user.id) } : {}),
    ...(targetType === 'city' ? { city: city.trim() } : {}),
    ...(targetType === 'category' ? { category_id: Number(categoryId) } : {}),
    ...copy,
  })

  const targetComplete = targetType === 'users'
    ? selectedUsers.length > 0
    : targetType === 'city'
      ? Boolean(city.trim())
      : targetType === 'category'
        ? Boolean(categoryId)
        : true
  const germanCopyComplete = Boolean(copy.title_de.trim() && copy.body_de.trim())
  const englishTitlePresent = Boolean(copy.title_en.trim())
  const englishBodyPresent = Boolean(copy.body_en.trim())
  const englishCopyComplete = englishTitlePresent === englishBodyPresent
  const copyComplete = germanCopyComplete && englishCopyComplete

  const sendNow = () => {
    if (!preview) return
    const confirmed = window.confirm(
      `Push-Nachricht jetzt an ${preview.recipient_count} Nutzer auf ${preview.device_count} Geräten senden?`,
    )
    if (confirmed) sendMutation.mutate(buildPayload())
  }

  const errorMessage = previewMutation.error
    ? getApiErrorMessage(previewMutation.error)
    : sendMutation.error
      ? getApiErrorMessage(sendMutation.error)
      : targetType === 'category' && categoryError
        ? getApiErrorMessage(categoryError)
        : ''
  const rejectedDeviceCount = sentResult
    ? sentResult.rejected_device_count
      ?? sentResult.devices.filter((device) => device.delivery_status === 'rejected').length
    : 0

  return (
    <div className="p-8">
      <div className="admin-page-header mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><BellRing size={21} /> Push-Nachrichten</h2>
          <p className="mt-1 text-sm text-gray-500">Deutsch ist erforderlich. Ohne englische Fassung erhalten auch englischsprachige Geräte die deutsche Nachricht.</p>
        </div>
      </div>

      <ErrorBanner message={errorMessage} />
      {sentResult && (
        <div className={`mb-5 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${rejectedDeviceCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-800'}`}>
          <Check className="mt-0.5 shrink-0" size={16} />
          <span>Versand abgeschlossen: {sentResult.sent_device_count ?? 0} angenommen, {rejectedDeviceCount} abgewiesen – insgesamt {sentResult.device_count} Geräte.</span>
        </div>
      )}
      {sentResult && (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Ergebnis je Gerät</h3>
              <p className="mt-1 text-xs text-gray-500">„Angenommen“ bestätigt die Annahme durch APNs/Expo, nicht die Anzeige oder das Öffnen auf dem Gerät.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{sentResult.device_count} Geräte</span>
          </div>
          <DeviceList devices={sentResult.devices} />
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-800">1. Empfänger auswählen</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {TARGETS.map((target) => (
                <button
                  key={target.value}
                  type="button"
                  onClick={() => changeTarget(target.value)}
                  className={`rounded-xl border p-4 text-left transition-colors ${targetType === target.value ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <span className="block text-sm font-semibold text-gray-900">{target.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-gray-500">{target.description}</span>
                </button>
              ))}
            </div>

            {targetType === 'users' && (
              <div className="mt-5">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Nutzer suchen</label>
                <div className="relative max-w-xl">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Name, E-Mail oder Username"
                    className={`${inputClass} pl-9`}
                  />
                  {userSearch.trim().length >= 2 && (
                    <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {searchingUsers ? (
                        <p className="px-3 py-3 text-sm text-gray-400">Suche…</p>
                      ) : userResults.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-gray-400">Keine aktiven Nutzer gefunden.</p>
                      ) : userResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => addUser(user)}
                          className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2.5 text-left last:border-0 hover:bg-violet-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-gray-900">{user.profile_display_name || user.username}</span>
                            <span className="block truncate text-xs text-gray-500">{user.email} · {user.profile_city || 'keine Stadt'}</span>
                          </span>
                          <UserPlus className="shrink-0 text-violet-600" size={16} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <span key={user.id} className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-800">
                      {user.profile_display_name || user.username}
                      <button type="button" aria-label={`${user.email} entfernen`} onClick={() => removeUser(user.id)} className="rounded-full hover:bg-violet-200"><X size={13} /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {targetType === 'city' && (
              <div className="mt-5 max-w-xl">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Profilstadt</label>
                <input value={city} onChange={(event) => { setCity(event.target.value); resetOutcome() }} placeholder="z. B. Berlin" className={inputClass} />
                <p className="mt-1.5 text-xs text-gray-400">Groß-/Kleinschreibung wird ignoriert; die Stadt muss ansonsten dem Profil entsprechen.</p>
              </div>
            )}

            {targetType === 'category' && (
              <div className="mt-5 max-w-xl">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Abonnierte Kategorie</label>
                <select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); resetOutcome() }} className={inputClass}>
                  <option value="">Kategorie auswählen</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.follower_count} Abonnenten)</option>)}
                </select>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-800">2. Nachricht verfassen</h3>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <LanguageCopy
                language="Deutsch (erforderlich)"
                title={copy.title_de}
                body={copy.body_de}
                onTitle={(value) => updateCopy('title_de', value)}
                onBody={(value) => updateCopy('body_de', value)}
              />
              <LanguageCopy
                language="English (optional)"
                title={copy.title_en}
                body={copy.body_en}
                onTitle={(value) => updateCopy('title_en', value)}
                onBody={(value) => updateCopy('body_en', value)}
              />
            </div>
            {!englishCopyComplete && (
              <p className="mt-3 text-xs font-medium text-amber-700">Für eine englische Fassung bitte Titel und Text ausfüllen – oder beide Felder leer lassen.</p>
            )}
            <p className="mt-3 text-xs text-gray-500">Bleibt English leer, wird die deutsche Fassung an alle Geräte gesendet.</p>
            <p className="mt-4 text-xs text-gray-400">Die globale Push-Einstellung der Nutzer wird respektiert. Es wird kein E-Mail-Ersatz versendet.</p>
          </section>
        </div>

        <aside className="xl:col-span-1">
          <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-800">3. Prüfen und senden</h3>
            <p className="mt-2 text-xs leading-5 text-gray-500">Die Vorschau wird direkt im Backend berechnet und berücksichtigt aktive Geräte sowie die Push-Einstellung.</p>
            <button
              type="button"
              disabled={!targetComplete || !copyComplete || previewMutation.isPending || sendMutation.isPending}
              onClick={() => previewMutation.mutate(buildPayload())}
              className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {previewMutation.isPending ? 'Empfänger werden geprüft…' : 'Empfänger prüfen'}
            </button>

            {preview && (
              <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-2xl font-bold text-violet-900">{preview.recipient_count}</p>
                <p className="text-xs font-medium text-violet-700">erreichbare Nutzer auf {preview.device_count} Geräten</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-gray-600">Deutsch</dt><dd className="font-semibold text-gray-900">{preview.language_counts.de} Geräte</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-600">English</dt><dd className="font-semibold text-gray-900">{preview.language_counts.en} Geräte</dd></div>
                </dl>
                {!englishTitlePresent && preview.language_counts.en > 0 && (
                  <p className="mt-3 text-xs text-violet-700">Diese englischsprachigen Geräte erhalten die deutsche Fassung.</p>
                )}
                {preview.devices.length > 0 && (
                  <details className="mt-4 border-t border-violet-200 pt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-violet-800">Geräte anzeigen ({preview.devices.length})</summary>
                    <DeviceList devices={preview.devices} compact />
                  </details>
                )}
                {preview.device_count === 0 ? (
                  <p className="mt-4 text-xs font-medium text-amber-700">Für diese Auswahl ist aktuell kein Push-Gerät erreichbar.</p>
                ) : (
                  <button
                    type="button"
                    onClick={sendNow}
                    disabled={sendMutation.isPending}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    <Send size={15} /> {sendMutation.isPending ? 'Wird gesendet…' : 'Jetzt senden'}
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function DeviceList({
  devices,
  compact = false,
}: {
  devices: AdminPushNotificationDeviceResult[]
  compact?: boolean
}) {
  return (
    <div className={`mt-4 space-y-2 overflow-y-auto ${compact ? 'max-h-72' : 'max-h-[32rem]'}`}>
      {devices.map((device) => (
        <div key={device.id} className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{device.user_display_name || device.user_email}</p>
              <p className="truncate text-xs text-gray-500">{device.user_email}</p>
            </div>
            <DeliveryBadge status={device.delivery_status} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Gerät #{device.id} · {device.platform.toUpperCase()} · {device.provider.toUpperCase()} · {device.preferred_language === 'en' ? 'English' : 'Deutsch'} · Token …{device.token_suffix}
          </p>
          {device.provider_status && (
            <p className="mt-1 text-xs text-gray-400">Push-Dienst Status {device.provider_status}</p>
          )}
          {device.rejection_reason && (
            <p className="mt-1 text-xs font-medium text-red-700">{device.rejection_reason}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function DeliveryBadge({ status }: { status: AdminPushNotificationDeviceResult['delivery_status'] }) {
  const styles = status === 'accepted'
    ? 'bg-green-100 text-green-800'
    : status === 'rejected'
      ? 'bg-red-100 text-red-800'
      : 'bg-violet-100 text-violet-800'
  const label = status === 'accepted' ? 'Angenommen' : status === 'rejected' ? 'Abgewiesen' : 'Bereit'
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{label}</span>
}

function LanguageCopy({
  language,
  title,
  body,
  onTitle,
  onBody,
}: {
  language: string
  title: string
  body: string
  onTitle: (value: string) => void
  onBody: (value: string) => void
}) {
  return (
    <fieldset className="rounded-xl border border-gray-200 p-4">
      <legend className="px-2 text-sm font-semibold text-gray-700">{language}</legend>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Titel</label>
      <input value={title} maxLength={80} onChange={(event) => onTitle(event.target.value)} className={inputClass} />
      <p className="mt-1 text-right text-xs text-gray-400">{title.length}/80</p>
      <label className="mb-1.5 mt-3 block text-xs font-medium uppercase tracking-wide text-gray-500">Text</label>
      <textarea value={body} maxLength={500} rows={5} onChange={(event) => onBody(event.target.value)} className={`${inputClass} resize-y`} />
      <p className="mt-1 text-right text-xs text-gray-400">{body.length}/500</p>
    </fieldset>
  )
}
