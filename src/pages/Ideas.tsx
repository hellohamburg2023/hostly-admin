import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createIdea, cursorFromUrl, deleteIdea, getApiErrorMessage, getCategories, getIdeas,
  getInterests, pageResults, patchIdea,
} from '../api'
import { SystemIcon, SystemIconSelect } from '../adminIcons'
import { formatDate } from '../adminFormat'
import { Badge, EmptyState, ErrorBanner, Pagination } from '../adminUi'
import {
  Check, ChevronDown, FileText, Lightbulb, MapPin, Pencil, Plus, Search,
  Settings2, Sparkles, Trash2, UserRound, X,
} from 'lucide-react'

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

async function getAllIdeasForSorting(): Promise<Idea[]> {
  const allIdeas: Idea[] = []
  let nextCursor = ''

  do {
    const response = await getIdeas({
      page_size: '60',
      ...(nextCursor ? { cursor: nextCursor } : {}),
    }) as Page<Idea> | Idea[]

    if (Array.isArray(response)) return response
    allIdeas.push(...(response.results ?? []))
    nextCursor = cursorFromUrl(response.next)
  } while (nextCursor)

  return allIdeas
}

export default function IdeasPage() {
  const [cursor, setCursor] = useState('')
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<IdeaForm>(BLANK_FORM)
  const titleInputRef = useRef<HTMLInputElement>(null)
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
  const {
    data: allIdeas = [],
    isLoading: isLoadingSortOrders,
    error: sortOrdersError,
  } = useQuery({
    queryKey: ['ideas', 'all-for-sorting'],
    queryFn: getAllIdeasForSorting,
  })
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

  const pageErrorMessage = error
    ? getApiErrorMessage(error)
    : deleteMut.error
      ? getApiErrorMessage(deleteMut.error)
      : ''
  const formErrorMessage = createMut.error
    ? getApiErrorMessage(createMut.error)
    : updateMut.error
      ? getApiErrorMessage(updateMut.error)
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

  const occupiedSortOrders = new Set(
    allIdeas
      .filter((idea) => idea.id !== editId)
      .map((idea) => idea.sort_order),
  )
  const highestSortOrder = allIdeas.reduce((highest, idea) => Math.max(highest, idea.sort_order), 0)
  const nextSortOrder = Math.max(highestSortOrder + 1, 1)
  const maxSortOption = Math.max(nextSortOrder, form.sort_order)
  const sortOrderOptions = Array.from({ length: maxSortOption }, (_, index) => index + 1)
  const sortOrderConflict = occupiedSortOrders.has(form.sort_order)
  const invalidSortOrder = form.sort_order < 1
  const sortOrdersReady = !isLoadingSortOrders && !sortOrdersError

  const saveForm = () => {
    if (!form.title.trim() || !form.category_id || invalidSortOrder || sortOrderConflict) return
    const payload = payloadFromForm(form)
    if (editId) updateMut.mutate({ id: editId, payload })
    else createMut.mutate(payload)
  }

  const startAdd = () => {
    createMut.reset()
    updateMut.reset()
    setAdding(true)
    setEditId(null)
    setForm({
      ...BLANK_FORM,
      is_template: kind !== 'ideas',
      sort_order: sortOrdersReady ? nextSortOrder : 0,
    })
  }

  const startEdit = (idea: Idea) => {
    createMut.reset()
    updateMut.reset()
    setAdding(false)
    setEditId(idea.id)
    setForm(formFromIdea(idea))
  }

  const cancelForm = () => {
    if (createMut.isPending || updateMut.isPending) return
    createMut.reset()
    updateMut.reset()
    setAdding(false)
    setEditId(null)
    setForm(BLANK_FORM)
  }

  const showForm = adding || editId !== null
  const isSaving = createMut.isPending || updateMut.isPending
  const canSave = Boolean(
    form.title.trim()
    && form.category_id
    && !invalidSortOrder
    && !sortOrderConflict
    && sortOrdersReady,
  ) && !isSaving
  const formTitle = editId
    ? `${form.is_template ? 'Vorlage' : 'Nutzer-Idee'} bearbeiten`
    : `${form.is_template ? 'Neue Vorlage' : 'Neue Nutzer-Idee'} erstellen`
  const saveLabel = editId
    ? 'Änderungen speichern'
    : form.is_template
      ? 'Vorlage erstellen'
      : 'Idee erstellen'

  useEffect(() => {
    if (adding && form.sort_order === 0 && sortOrdersReady) {
      setForm((value) => ({ ...value, sort_order: nextSortOrder }))
    }
  }, [adding, form.sort_order, nextSortOrder, sortOrdersReady])

  useEffect(() => {
    if (!showForm) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => titleInputRef.current?.focus(), 0)

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        setAdding(false)
        setEditId(null)
        setForm(BLANK_FORM)
      }
    }
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [showForm, isSaving])

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

      <ErrorBanner message={pageErrorMessage} />

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
                    <SystemIcon name={idea.system_image} size={17} />
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

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cancelForm()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="idea-form-title"
            className="flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-3xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex min-w-0 gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  {form.is_template ? <FileText size={19} /> : <Lightbulb size={19} />}
                </div>
                <div>
                  <h3 id="idea-form-title" className="text-lg font-semibold text-gray-900">{formTitle}</h3>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {editId
                      ? 'Passe die Inhalte und Zuordnung an.'
                      : form.is_template
                        ? 'Erstelle eine wiederverwendbare Event-Idee für die App.'
                        : 'Erfasse eine konkrete Idee aus der Community.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelForm}
                disabled={isSaving}
                aria-label="Dialog schließen"
                className="-mr-1 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault()
                saveForm()
              }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                <ErrorBanner message={formErrorMessage} />

                <fieldset>
                  <legend className="text-sm font-semibold text-gray-900">Was möchtest du erstellen?</legend>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={form.is_template}
                      onClick={() => setForm((value) => ({ ...value, is_template: true }))}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                        form.is_template
                          ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Sparkles size={18} className={form.is_template ? 'mt-0.5 text-violet-700' : 'mt-0.5 text-gray-400'} />
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          App-Vorlage
                          {form.is_template && <Check size={15} className="text-violet-700" />}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-gray-500">Wiederverwendbar und für alle Städte geeignet</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={!form.is_template}
                      onClick={() => setForm((value) => ({ ...value, is_template: false }))}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                        !form.is_template
                          ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <UserRound size={18} className={!form.is_template ? 'mt-0.5 text-violet-700' : 'mt-0.5 text-gray-400'} />
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          Nutzer-Idee
                          {!form.is_template && <Check size={15} className="text-violet-700" />}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-gray-500">Konkreter Vorschlag aus der Community</span>
                      </span>
                    </button>
                  </div>
                </fieldset>

                <div className="my-6 border-t border-gray-100" />

                <section aria-labelledby="idea-basics-heading">
                  <div className="mb-3">
                    <h4 id="idea-basics-heading" className="text-sm font-semibold text-gray-900">Basisdaten</h4>
                    <p className="mt-0.5 text-xs text-gray-500">Diese Angaben helfen Nutzern, die Idee schnell einzuordnen.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-gray-700">
                        Titel <span className="text-red-500">*</span>
                      </span>
                      <input
                        ref={titleInputRef}
                        value={form.title}
                        onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
                        placeholder="z. B. Gemeinsam töpfern"
                        maxLength={120}
                        required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-gray-700">Kurzer Untertitel</span>
                      <input
                        value={form.subtitle}
                        onChange={(event) => setForm((value) => ({ ...value, subtitle: event.target.value }))}
                        placeholder="Ein kurzer Satz, der in der App neugierig macht"
                        maxLength={180}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                      />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-sm font-medium text-gray-700">
                        Kategorie <span className="text-red-500">*</span>
                      </span>
                      <select
                        value={form.category_id}
                        onChange={(event) => setForm((value) => ({ ...value, category_id: event.target.value }))}
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                      >
                        <option value="">Kategorie auswählen</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <MapPin size={14} className="text-gray-400" /> Stadt
                        <span className="font-normal text-gray-400">(optional)</span>
                      </span>
                      <input
                        value={form.city}
                        onChange={(event) => setForm((value) => ({ ...value, city: event.target.value }))}
                        placeholder={form.is_template ? 'Für alle Städte leer lassen' : 'z. B. Berlin'}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                      />
                    </label>
                  </div>
                </section>

                <div className="my-6 border-t border-gray-100" />

                <section aria-labelledby="idea-content-heading">
                  <div className="mb-3">
                    <h4 id="idea-content-heading" className="text-sm font-semibold text-gray-900">Inhalt</h4>
                    <p className="mt-0.5 text-xs text-gray-500">Beschreibe, was die Teilnehmenden erwartet.</p>
                  </div>
                  <div className="space-y-4">
                    <label>
                      <span className="mb-1.5 block text-sm font-medium text-gray-700">Beschreibung</span>
                      <textarea
                        value={form.description}
                        onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                        placeholder="Worum geht es bei der Idee und wie könnte sie ablaufen?"
                        className="min-h-28 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                      />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-sm font-medium text-gray-700">
                        Regeln oder Sicherheitshinweise
                        <span className="ml-1 font-normal text-gray-400">(optional)</span>
                      </span>
                      <textarea
                        value={form.rules}
                        onChange={(event) => setForm((value) => ({ ...value, rules: event.target.value }))}
                        placeholder="Was sollten Teilnehmende vorab wissen?"
                        className="min-h-20 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                      />
                    </label>
                  </div>
                </section>

                <div className="my-6 border-t border-gray-100" />

                <section aria-labelledby="idea-interests-heading">
                  <div className="mb-3 flex items-end justify-between gap-4">
                    <div>
                      <h4 id="idea-interests-heading" className="text-sm font-semibold text-gray-900">Passende Interessen</h4>
                      <p className="mt-0.5 text-xs text-gray-500">Mehrfachauswahl möglich</p>
                    </div>
                    {form.interests.length > 0 && (
                      <span className="shrink-0 text-xs font-medium text-violet-700">
                        {form.interests.length} ausgewählt
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => {
                      const selected = form.interests.includes(interest.id)
                      return (
                        <button
                          key={interest.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleInterest(interest.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            selected
                              ? 'border-violet-200 bg-violet-100 text-violet-800'
                              : 'border-transparent bg-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {selected && <Check size={12} />}
                          {interest.name}
                        </button>
                      )
                    })}
                  </div>
                </section>

                <details className="group mt-6 rounded-xl border border-gray-200 bg-gray-50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-gray-700 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2"><Settings2 size={15} /> Erweiterte Einstellungen</span>
                    <ChevronDown size={16} className="text-gray-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 md:flex-row md:items-center md:gap-6">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="shrink-0 text-sm font-medium text-gray-700">Icon in der App</span>
                      <SystemIconSelect
                        value={form.system_image}
                        onChange={(system_image) => setForm((value) => ({ ...value, system_image }))}
                        className="min-w-0 flex-1"
                      />
                    </label>
                    <label className="min-w-0 flex-1">
                      <span className="flex items-center gap-3">
                        <span className="shrink-0 text-sm font-medium text-gray-700">Position in der Liste</span>
                        <select
                          value={form.sort_order}
                          disabled={!sortOrdersReady}
                          onChange={(event) => setForm((value) => ({ ...value, sort_order: Number(event.target.value) }))}
                          className={`min-w-0 flex-1 rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                            sortOrderConflict ? 'border-red-400' : 'border-gray-300'
                          }`}
                        >
                          {!sortOrdersReady && <option value={0}>Positionen werden geladen …</option>}
                          {sortOrdersReady && invalidSortOrder && (
                            <option value={0} disabled>Bitte eine freie Position auswählen</option>
                          )}
                          {sortOrderOptions.map((position) => {
                            const isOccupied = occupiedSortOrders.has(position)
                            return (
                              <option key={position} value={position} disabled={isOccupied}>
                                Position {position}
                                {position === 1 ? ' — ganz oben' : ''}
                                {position === nextSortOrder ? ' — am Ende' : ''}
                                {isOccupied ? ' — bereits belegt' : ''}
                              </option>
                            )
                          })}
                        </select>
                      </span>
                      {sortOrdersError ? (
                        <span className="mt-1 block text-right text-xs text-red-600">Die verfügbaren Positionen konnten nicht geladen werden.</span>
                      ) : invalidSortOrder ? (
                        <span className="mt-1 block text-right text-xs text-red-600">Bitte wähle eine freie Position aus.</span>
                      ) : sortOrderConflict ? (
                        <span className="mt-1 block text-right text-xs text-red-600">Diese Position ist bereits belegt. Bitte wähle eine freie Position.</span>
                      ) : null}
                    </label>
                  </div>
                </details>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-4 border-t border-gray-100 bg-white px-5 py-4 sm:px-7">
                <p className="hidden text-xs text-gray-400 sm:block"><span className="text-red-500">*</span> Pflichtfelder</p>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelForm}
                    disabled={isSaving}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={!canSave}
                    className="inline-flex min-w-36 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
                  >
                    {isSaving ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Wird gespeichert …
                      </>
                    ) : (
                      <>
                        <Check size={15} /> {saveLabel}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
