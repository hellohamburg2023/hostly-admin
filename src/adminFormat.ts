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
