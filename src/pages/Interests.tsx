import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInterests, createInterest, patchInterest, deleteInterest } from '../api'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface Interest { id: number; name: string; slug: string; group_title: string; sort_order: number }

export default function InterestsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['interests'], queryFn: getInterests })
  const interests: Interest[] = data?.results ?? data ?? []

  const [editId, setEditId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState({ name: '', slug: '', group_title: '', sort_order: 0 })
  const [adding, setAdding] = useState(false)
  const [newValues, setNewValues] = useState({ name: '', slug: '', group_title: '', sort_order: 0 })

  const createMut = useMutation({
    mutationFn: createInterest,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['interests'] }); setAdding(false); setNewValues({ name: '', slug: '', group_title: '', sort_order: 0 }) },
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Interessen</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Neues Interesse
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gruppe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reihenfolge</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {adding && (
                <tr className="bg-violet-50">
                  <td className="px-4 py-2"><input autoFocus value={newValues.name} onChange={e => setNewValues(v => ({ ...v, name: e.target.value }))} placeholder="Name" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                  <td className="px-4 py-2">
                    <input list="groups-list" value={newValues.group_title} onChange={e => setNewValues(v => ({ ...v, group_title: e.target.value }))} placeholder="Gruppe" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                    <datalist id="groups-list">{groups.map(g => <option key={g} value={g} />)}</datalist>
                  </td>
                  <td className="px-4 py-2"><input value={newValues.slug} onChange={e => setNewValues(v => ({ ...v, slug: e.target.value }))} placeholder="slug" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                  <td className="px-4 py-2"><input type="number" value={newValues.sort_order} onChange={e => setNewValues(v => ({ ...v, sort_order: Number(e.target.value) }))} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                  <td className="px-4 py-2 flex gap-1">
                    <button onClick={() => createMut.mutate(newValues)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
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
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {editId === i.id ? <input value={editValues.slug} onChange={e => setEditValues(v => ({ ...v, slug: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /> : i.slug}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {editId === i.id ? <input type="number" value={editValues.sort_order} onChange={e => setEditValues(v => ({ ...v, sort_order: Number(e.target.value) }))} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" /> : i.sort_order}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {editId === i.id ? (
                        <>
                          <button onClick={() => updateMut.mutate({ id: i.id, data: editValues })} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(i.id); setEditValues({ name: i.name, slug: i.slug, group_title: i.group_title, sort_order: i.sort_order }) }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Pencil size={14} /></button>
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
