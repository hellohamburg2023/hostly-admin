import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage, getInterests, createInterest, patchInterest, deleteInterest } from '../api'
import { ErrorBanner } from '../adminUi'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface Interest { id: number; name: string; slug: string; group_title: string; sort_order: number }

function sortOrderDetails(interests: Interest[], groupTitle: string, excludeId?: number | null) {
  const occupied = new Set(
    interests
      .filter((interest) => interest.group_title === groupTitle && interest.id !== excludeId)
      .map((interest) => interest.sort_order),
  )
  const highest = [...occupied].reduce((current, position) => Math.max(current, position), 0)
  return {
    occupied,
    next: Math.max(highest + 1, 1),
  }
}

function InterestSortOrderSelect({
  interests,
  groupTitle,
  value,
  excludeId,
  onChange,
}: {
  interests: Interest[]
  groupTitle: string
  value: number
  excludeId?: number | null
  onChange: (value: number) => void
}) {
  const { occupied, next } = sortOrderDetails(interests, groupTitle, excludeId)
  const highestOption = Math.max(next, value)
  const positions = Array.from({ length: highestOption }, (_, index) => index + 1)
  const hasValidGroup = Boolean(groupTitle.trim())

  return (
    <select
      value={value}
      disabled={!hasValidGroup}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label="Position innerhalb der Gruppe"
      className="w-full min-w-40 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
    >
      {!hasValidGroup && <option value={0}>Zuerst Gruppe wählen</option>}
      {hasValidGroup && value < 1 && <option value={0}>Position wählen</option>}
      {hasValidGroup && positions.map((position) => {
        const isOccupied = occupied.has(position)
        return (
          <option key={position} value={position} disabled={isOccupied}>
            Position {position}
            {position === 1 ? ' — ganz oben' : ''}
            {position === next ? ' — am Ende' : ''}
            {isOccupied ? ' — bereits belegt' : ''}
          </option>
        )
      })}
    </select>
  )
}

function slugFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function InterestsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['interests'], queryFn: getInterests })
  const interests: Interest[] = data?.results ?? data ?? []

  const [editId, setEditId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState({ name: '', group_title: '', sort_order: 0 })
  const [adding, setAdding] = useState(false)
  const [newValues, setNewValues] = useState({ name: '', group_title: '', sort_order: 0 })

  const createMut = useMutation({
    mutationFn: createInterest,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['interests'] }); setAdding(false); setNewValues({ name: '', group_title: '', sort_order: 0 }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => patchInterest(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['interests'] }); setEditId(null) },
  })
  const deleteMut = useMutation({
    mutationFn: deleteInterest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests'] }),
  })

  const groups = [...new Set(interests.map(i => i.group_title).filter(Boolean))]
  const newSortOrderTaken = newValues.sort_order > 0
    && sortOrderDetails(interests, newValues.group_title).occupied.has(newValues.sort_order)
  const editSortOrderTaken = editValues.sort_order > 0
    && sortOrderDetails(interests, editValues.group_title, editId).occupied.has(editValues.sort_order)
  const errorMessage = createMut.error
    ? getApiErrorMessage(createMut.error)
    : updateMut.error
      ? getApiErrorMessage(updateMut.error)
      : deleteMut.error
        ? getApiErrorMessage(deleteMut.error)
        : ''

  return (
    <div className="p-8">
      <div className="admin-page-header flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Interessen</h2>
        <button
          onClick={() => {
            setAdding(true)
            setNewValues({ name: '', group_title: '', sort_order: 0 })
          }}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Neues Interesse
        </button>
      </div>

      <ErrorBanner message={errorMessage} />

      <div className="admin-table overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : (
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gruppe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reihenfolge</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {adding && (
                <tr className="bg-violet-50">
                  <td className="px-4 py-2">
                    <input autoFocus value={newValues.name} onChange={e => setNewValues(v => ({ ...v, name: e.target.value }))} placeholder="Name des Interesses" className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                    <span className="mt-1 block text-xs text-gray-500">Die technische Kennung wird automatisch erstellt.</span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      list="groups-list"
                      value={newValues.group_title}
                      onChange={event => {
                        const group_title = event.target.value
                        const { next } = sortOrderDetails(interests, group_title)
                        setNewValues(value => ({ ...value, group_title, sort_order: group_title.trim() ? next : 0 }))
                      }}
                      placeholder="Gruppe"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <datalist id="groups-list">{groups.map(g => <option key={g} value={g} />)}</datalist>
                  </td>
                  <td className="px-4 py-2">
                    <InterestSortOrderSelect
                      interests={interests}
                      groupTitle={newValues.group_title}
                      value={newValues.sort_order}
                      onChange={sort_order => setNewValues(value => ({ ...value, sort_order }))}
                    />
                  </td>
                  <td className="px-4 py-2 flex gap-1">
                    <button
                      disabled={!newValues.name.trim() || !newValues.group_title.trim() || newValues.sort_order < 1 || newSortOrderTaken}
                      onClick={() => createMut.mutate({ ...newValues, slug: slugFromName(newValues.name) })}
                      className="rounded p-1.5 text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-30"
                    ><Check size={14} /></button>
                    <button onClick={() => setAdding(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                  </td>
                </tr>
              )}
              {interests.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {editId === i.id ? <input autoFocus value={editValues.name} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /> : i.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {editId === i.id ? (
                      <input
                        value={editValues.group_title}
                        onChange={event => {
                          const group_title = event.target.value
                          const { next } = sortOrderDetails(interests, group_title, i.id)
                          setEditValues(value => ({
                            ...value,
                            group_title,
                            sort_order: group_title === i.group_title ? i.sort_order : group_title.trim() ? next : 0,
                          }))
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    ) : <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{i.group_title}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {editId === i.id ? (
                      <InterestSortOrderSelect
                        interests={interests}
                        groupTitle={editValues.group_title}
                        value={editValues.sort_order}
                        excludeId={i.id}
                        onChange={sort_order => setEditValues(value => ({ ...value, sort_order }))}
                      />
                    ) : `Position ${i.sort_order}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {editId === i.id ? (
                        <>
                          <button
                            disabled={!editValues.name.trim() || !editValues.group_title.trim() || editValues.sort_order < 1 || editSortOrderTaken}
                            onClick={() => updateMut.mutate({ id: i.id, data: editValues })}
                            className="rounded p-1.5 text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-30"
                          ><Check size={14} /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(i.id); setEditValues({ name: i.name, group_title: i.group_title, sort_order: i.sort_order }) }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Pencil size={14} /></button>
                          <button onClick={() => { if (confirm(`Interesse "${i.name}" löschen?`)) deleteMut.mutate(i.id) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
