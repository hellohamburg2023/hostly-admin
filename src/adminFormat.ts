export function formatDate(value?: string | null, withTime = false) {
  if (!value) return 'Nie'
  return new Date(value).toLocaleString('de-DE', withTime ? {
    dateStyle: 'medium',
    timeStyle: 'short',
  } : { dateStyle: 'medium' })
}

export function activityLabel(days?: number | null) {
  if (days === null || days === undefined) return 'nie aktiv'
  if (days === 0) return 'heute aktiv'
  if (days === 1) return 'seit 1 Tag inaktiv'
  return `seit ${days} Tagen inaktiv`
}

interface AccountStatusSource {
  is_active: boolean
  is_deleted?: boolean
  email_verified_at?: string | null
  suspended_at?: string | null
}

export function accountStatus(user: AccountStatusSource) {
  if (user.is_deleted) {
    return { key: 'deleted', label: 'Gelöscht', className: 'bg-gray-200 text-gray-700' }
  }
  if (user.suspended_at) {
    return { key: 'suspended', label: 'Gesperrt', className: 'bg-red-100 text-red-600' }
  }
  if (user.is_active) {
    return { key: 'active', label: 'Aktiv', className: 'bg-green-100 text-green-700' }
  }
  if (!user.email_verified_at) {
    return {
      key: 'email_pending',
      label: 'E-Mail-Bestätigung ausstehend',
      className: 'bg-amber-100 text-amber-800',
    }
  }
  return { key: 'inactive', label: 'Inaktiv', className: 'bg-gray-100 text-gray-600' }
}
