import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createIdea, deleteIdea, getApiErrorMessage, getCategories, getIdeas,
  getInterests, pageResults, patchIdea,
} from '../api'
import { formatDate } from '../adminFormat'
import { Badge, EmptyState, ErrorBanner, Pagination } from '../adminUi'
import { Check, Lightbulb, Pencil, Plus, Search, Trash2, X } from 'lucide-react'

interface Category {
  id: number
  name: string
  slug: string
}

interface Interest {
  id: number
  name: string
  slug: string
}

interface Idea {
  id: number
  title: string
  subtitle: string
  description: string
  rules: string
  city: string
  system_image: string
  is_template: boolean
  sort_order: number
  created_at: string
  created_by_id: number | null
  created_by_email: string
  created_by_name: string
  category_id: number
  category_name: string
  category_slug: string
  interests: number[]
  signal_count: number
}

interface Page<T> {
  results?: T[]
  next?: string | null
  previous?: string | null
}

const BLANK_FORM = {
  title: '',
  subtitle: '',
  description: '',
  rules: '',
  city: '',
  category_id: '',
  interests: [] as number[],
  system_image: 'lightbulb',
  is_template: true,
  sort_order: 0,
}

type IdeaForm = typeof BLANK_FORM

function formFromIdea(idea: Idea): IdeaForm {
  return {
    title: idea.title || '',
    subtitle: idea.subtitle || '',
    description: idea.description || '',
    rules: idea.rules || '',
    city: idea.city || '',
    category_id: idea.category_id ? String(idea.category_id) : '',
    interests: idea.interests || [],
    system_image: idea.system_image || 'lightbulb',
    is_template: idea.is_template,
    sort_order: idea.sort_order || 0,
  }
}

function payloadFromForm(form: IdeaForm) {
  return {
    ...form,
    category_id: Number(form.category_id),
    interests: form.interests,
    sort_order: Number(form.sort_order) || 0,
  }
}

export default function IdeasPage() {
  const [cursor, setCursor] = useState('')
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<IdeaForm>(BLANK_FORM)
  const qc = useQueryClient()

  const params: Record<string, string> = {}
  if (cursor) params.cursor = cursor
  if (kind) params.kind = kind
  if (q) params.q = q

  const { data, isLoading, error } = useQuery<Page<Idea> | Idea[]>({
    queryKey: ['ideas', cursor, kind, q],
    queryFn: () => getIdeas(params),
  })
  const { data: categoryData } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const { data: interestData } = useQuery({ queryKey: ['interests'], queryFn: getInterests })
  const ideas = pageResults<Idea>(data)
  const categories = pageResults<Category>(categoryData)
  const interests = pageResults<Interest>(interestData)
  const page = data && !Array.isArray(data) ? data : undefined

  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createIdea(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ideas'] })
      setAdding(false)
      setForm(BLANK_FORM)
    },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => patchIdea(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ideas'] })
      setEditId(null)
      setForm(BLANK_FORM)
    },
  })
  const deleteMut = useMutation({
    mutationFn: deleteIdea,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  })

  const errorMessage = error
    ? getApiErrorMessage(error)
    : createMut.error
      ? getApiErrorMessage(createMut.error)
      : updateMut.error
        ? getApiErrorMessage(updateMut.error)
        : deleteMut.error
          ? getApiErrorMessage(deleteMut.error)
          : ''

  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setCursor('')
  }

  const toggleInterest = (id: number) => {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(id)
        ? current.interests.filter((item) => item !== id)
        : [...current.interests, id],
    }))
  }

  const saveForm = () => {
    const payload = payloadFromForm(form)
    if (editId) updateMut.mutate({ id: editId, payload })
    else createMut.mutate(payload)
  }

  const startAdd = () => {
    setAdding(true)
    setEditId(null)
    setForm({ ...BLANK_FORM, is_template: kind !== 'ideas' })
  }

  const startEdit = (idea: Idea) => {
    setAdding(false)
    setEditId(idea.id)
    setForm(formFromIdea(idea))
  }

  const cancelForm = () => {
    setAdding(false)
    setEditId(null)
    setForm(BLANK_FORM)
  }

  const showForm = adding || editId !== null

  return (
    <div className="p-8">
      <div className="admin-page-header flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Vorlagen & Event-Ideen</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Vorlagen entsprechen den Event-Ideen aus der iOS-App. Nutzer-Ideen sind Vorschläge aus der App mit Signalen anderer Nutzer.
          </p>
        </div>
        <button
          onClick={startAdd}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Neue Vorlage/Idee
        </button>
      </div>

      <ErrorBanner message={errorMessage} />

      <div className="admin-filters flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-64 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(event) => setFilter(setQ, event.target.value)}
            placeholder="Titel, Beschreibung, Stadt"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={kind}
          onChange={(event) => setFilter(setKind, event.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Alle</option>
          <option value="templates">Vorlagen</option>
          <option value="ideas">Nutzer-Ideen</option>
        </select>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">{editId ? 'Vorlage/Idee bearbeiten' : 'Neue Vorlage/Idee'}</h3>
            <button onClick={cancelForm} className="rounded p-1.5 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <input value={form.title} onChange={(event) => setForm((v) => ({ ...v, title: event.target.value }))} placeholder="Titel" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input value={form.subtitle} onChange={(event) => setForm((v) => ({ ...v, subtitle: event.target.value }))} placeholder="Untertitel wie in der App" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input value={form.city} onChange={(event) => setForm((v) => ({ ...v, city: event.target.value }))} placeholder="Stadt, optional für Vorlage" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={form.category_id} onChange={(event) => setForm((v) => ({ ...v, category_id: event.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Kategorie wählen</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <input value={form.system_image} onChange={(event) => setForm((v) => ({ ...v, system_image: event.target.value }))} placeholder="SF Symbol/Icon, z.B. tree" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="number" value={form.sort_order} onChange={(event) => setForm((v) => ({ ...v, sort_order: Number(event.target.value) }))} placeholder="Reihenfolge" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <textarea value={form.description} onChange={(event) => setForm((v) => ({ ...v, description: event.target.value }))} placeholder="Beschreibung/Vorlagentext aus der App" className="h-24 rounded-lg border border-gray-300 px-3 py-2 text-sm lg:col-span-2" />
            <textarea value={form.rules} onChange={(event) => setForm((v) => ({ ...v, rules: event.target.value }))} placeholder="Regeln/Sicherheitshinweise" className="h-20 rounded-lg border border-gray-300 px-3 py-2 text-sm lg:col-span-2" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.is_template} onChange={(event) => setForm((v) => ({ ...v, is_template: event.target.checked }))} />
              Als App-Vorlage markieren
            </label>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Interessen</p>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    form.interests.includes(interest.id)
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {interest.name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={cancelForm} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Abbrechen</button>
            <button onClick={saveForm} disabled={!form.title || !form.category_id} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              <Check size={14} /> Speichern
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400">Laden...</div>
      ) : ideas.length === 0 ? (
        <EmptyState>Keine Vorlagen oder Event-Ideen vorhanden</EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ideas.map((idea) => (
            <div key={idea.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                    <Lightbulb size={17} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{idea.title}</h3>
                    {idea.subtitle && <p className="text-sm text-gray-500">{idea.subtitle}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => startEdit(idea)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><Pencil size={14} /></button>
                  <button
                    onClick={() => {
                      if (confirm(`"${idea.title}" löschen?`)) deleteMut.mutate(idea.id)
                    }}
                    className="rounded p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-1">
                <Badge className={idea.is_template ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}>
                  {idea.is_template ? 'App-Vorlage' : 'Nutzer-Idee'}
                </Badge>
                <Badge className="bg-gray-100 text-gray-600">{idea.category_name || idea.category_slug || 'Keine Kategorie'}</Badge>
                {idea.signal_count > 0 && <Badge className="bg-green-100 text-green-700">{idea.signal_count} Signale</Badge>}
              </div>
              {idea.description && <p className="mb-2 line-clamp-3 text-sm text-gray-600">{idea.description}</p>}
              {idea.rules && <p className="mb-2 line-clamp-2 text-xs text-gray-500">Regeln: {idea.rules}</p>}
              <p className="text-xs text-gray-400">
                {idea.city || 'Alle Städte'} · {idea.created_by_id ? (
                  <Link to={`/users/${idea.created_by_id}`} className="hover:text-violet-700">
                    {idea.created_by_name || idea.created_by_email}
                  </Link>
                ) : 'System'} · {formatDate(idea.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
      <Pagination data={page} onCursor={setCursor} />
    </div>
  )
}
