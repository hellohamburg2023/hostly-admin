export interface ReportPresentationInput {
  reason: string
  details?: string | null
  event_id?: number | null
  event_title?: string | null
  reported_user_id?: number | null
  reported_user_email?: string | null
}

export interface ChatReportContext {
  roomId: number
  messageId: number
  excerpt: string
}

const REASON_LABELS: Record<string, string> = {
  inappropriate_content: 'Unangemessener Inhalt',
  'inappropriate content': 'Unangemessener Inhalt',
  harassment: 'Belästigung oder Hass',
  'harassment or hate': 'Belästigung oder Hass',
  abuse: 'Missbrauch oder Belästigung',
  spam_or_scam: 'Spam oder Betrug',
  'spam or scam': 'Spam oder Betrug',
  unsafe_meetup: 'Unsicheres Treffen',
  'unsafe meetup': 'Unsicheres Treffen',
  unsafe: 'Unsicheres Treffen',
  other: 'Sonstiges',
}

export const REPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Neu',
  reviewing: 'In Prüfung',
  resolved: 'Erledigt',
  dismissed: 'Kein Verstoß',
}

export const REPORT_STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  reviewing: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-600',
}

export const REPORT_DECISION_LABELS: Record<string, string> = {
  needs_review: 'Prüfung begonnen',
  no_violation: 'Kein Verstoß festgestellt',
  violation_confirmed: 'Verstoß bestätigt',
  user_suspended: 'Gemeldete Person gesperrt',
  reporter_suspended: 'Meldende Person gesperrt',
  event_cancelled: 'Event abgesagt',
}

export function reportReasonLabel(reason?: string | null) {
  const value = reason?.trim() || ''
  if (!value) return 'Kein Grund angegeben'
  return REASON_LABELS[value.toLowerCase()] || value
}

export function reportStatusLabel(status?: string | null) {
  if (!status) return 'Unbekannt'
  return REPORT_STATUS_LABELS[status] || status
}

export function reportDecisionLabel(decision?: string | null) {
  if (!decision) return ''
  return REPORT_DECISION_LABELS[decision] || decision
}

export function splitReportDetails(details?: string | null): {
  userDetails: string
  chatContext: ChatReportContext | null
} {
  const value = details?.trim() || ''
  if (!value) return { userDetails: '', chatContext: null }

  const match = value.match(/(?:^|\n\n)Chat room (\d+), message (\d+):\s*([\s\S]*)$/i)
  if (!match || match.index === undefined) return { userDetails: value, chatContext: null }

  return {
    userDetails: value.slice(0, match.index).trim(),
    chatContext: {
      roomId: Number(match[1]),
      messageId: Number(match[2]),
      excerpt: match[3].trim(),
    },
  }
}

export function reportTargetLabel(report: ReportPresentationInput) {
  const { chatContext } = splitReportDetails(report.details)
  if (chatContext) {
    return report.event_title
      ? `Chat-Nachricht im Event „${report.event_title}“`
      : 'Chat-Nachricht'
  }
  if (report.event_id) {
    return report.event_title ? `Event „${report.event_title}“` : `Event #${report.event_id}`
  }
  if (report.reported_user_id) {
    return report.reported_user_email
      ? `Profil von ${report.reported_user_email}`
      : `Nutzerprofil #${report.reported_user_id}`
  }
  return 'Allgemeiner Inhalt in Hostly'
}

export function reportTargetType(report: ReportPresentationInput) {
  if (splitReportDetails(report.details).chatContext) return 'Chat-Nachricht'
  if (report.event_id) return 'Event'
  if (report.reported_user_id) return 'Nutzerprofil'
  return 'Allgemeine Meldung'
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  report_action: 'Maßnahme zur Meldung durchgeführt',
  report_update: 'Status der Meldung geändert',
  user_suspended_from_report: 'Gemeldete Person gesperrt',
  reporter_suspended_from_report: 'Meldende Person gesperrt',
  event_cancelled_from_report: 'Gemeldetes Event abgesagt',
}

export function reportAuditActionLabel(action?: string | null) {
  if (!action) return 'Admin-Aktion'
  return AUDIT_ACTION_LABELS[action] || action.replaceAll('_', ' ')
}
