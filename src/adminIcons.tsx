import {
  BookOpen, Briefcase, Camera, Dumbbell, Gamepad2, Globe2, GraduationCap,
  Hammer, HandHeart, Heart, Lightbulb, Monitor, MoonStar, Music2, Paintbrush,
  PawPrint, PersonStanding, Plane, Theater, TreePine, UsersRound, Utensils,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const SYSTEM_ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'lightbulb', label: 'Idee', icon: Lightbulb },
  { value: 'tree', label: 'Natur & draußen', icon: TreePine },
  { value: 'theatermasks', label: 'Kultur & Theater', icon: Theater },
  { value: 'fork.knife', label: 'Essen & Trinken', icon: Utensils },
  { value: 'briefcase', label: 'Beruf & Networking', icon: Briefcase },
  { value: 'figure.run', label: 'Sport & Bewegung', icon: Dumbbell },
  { value: 'gamecontroller', label: 'Spiele', icon: Gamepad2 },
  { value: 'music.note', label: 'Musik', icon: Music2 },
  { value: 'paintbrush', label: 'Kunst & Kreativität', icon: Paintbrush },
  { value: 'heart', label: 'Wellness', icon: Heart },
  { value: 'graduationcap', label: 'Lernen', icon: GraduationCap },
  { value: 'airplane', label: 'Reisen', icon: Plane },
  { value: 'moon.stars', label: 'Nachtleben', icon: MoonStar },
  { value: 'hands.sparkles', label: 'Ehrenamt', icon: HandHeart },
  { value: 'figure.2.and.child.holdinghands', label: 'Familie', icon: UsersRound },
  { value: 'desktopcomputer', label: 'Technologie', icon: Monitor },
  { value: 'pawprint', label: 'Tiere', icon: PawPrint },
  { value: 'figure.yoga', label: 'Yoga & Entspannung', icon: PersonStanding },
  { value: 'globe', label: 'Sprachen & Internationales', icon: Globe2 },
  { value: 'book.fill', label: 'Lesen & Bücher', icon: BookOpen },
  { value: 'camera.fill', label: 'Fotografie', icon: Camera },
  { value: 'paintbrush.fill', label: 'Kreativprojekt', icon: Paintbrush },
  { value: 'bubble.left.fill', label: 'Gespräche', icon: UsersRound },
  { value: 'hammer', label: 'Handwerk & Workshop', icon: Hammer },
]

export function SystemIcon({
  name,
  size = 18,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const Icon = SYSTEM_ICON_OPTIONS.find((option) => option.value === name)?.icon ?? Lightbulb
  return <Icon size={size} className={className} />
}

export function SystemIconSelect({
  value,
  onChange,
  disabled = false,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const isUnknownValue = Boolean(
    value && !SYSTEM_ICON_OPTIONS.some((option) => option.value === value),
  )

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-violet-100 bg-violet-50 text-violet-700">
        <SystemIcon name={value} size={18} />
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Icon auswählen"
        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-gray-100"
      >
        <option value="">Icon auswählen</option>
        {isUnknownValue && <option value={value}>Bisheriges Icon</option>}
        {SYSTEM_ICON_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}
