import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage, getInterests, createInterest, patchInterest, deleteInterest } from '../api'
import { ErrorBanner } from '../adminUi'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface Interest { id: number; name: string; slug: string; group_title: string; sort_order: number }

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
          onClick={() => setAdding(true)}
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
                    <input list="groups-list" value={newValues.group_title} onChange={e => setNewValues(v => ({ ...v, group_title: e.target.value }))} placeholder="Gruppe" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                    <datalist id="groups-list">{groups.map(g => <option key={g} value={g} />)}</datalist>
                  </td>
                  <td className="px-4 py-2"><input type="number" value={newValues.sort_order} onChange={e => setNewValues(v => ({ ...v, sort_order: Number(e.target.value) }))} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                  <td className="px-4 py-2 flex gap-1">
                    <button
                      disabled={!newValues.name.trim() || !newValues.group_title.trim()}
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
                    {editId === i.id ? <input value={editValues.group_title} onChange={e => setEditValues(v => ({ ...v, group_title: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /> : <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{i.group_title}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {editId === i.id ? <input type="number" value={editValues.sort_order} onChange={e => setEditValues(v => ({ ...v, sort_order: Number(e.target.value) }))} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" /> : i.sort_order}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {editId === i.id ? (
                        <>
                          <button
                            disabled={!editValues.name.trim() || !editValues.group_title.trim()}
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
