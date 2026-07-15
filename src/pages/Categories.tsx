import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage, getCategories, createCategory, patchCategory, deleteCategory } from '../api'
import { ErrorBanner } from '../adminUi'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface Category { id: number; name: string; slug: string; icon: string; event_count: number; follower_count: number }

export default function CategoriesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const categories: Category[] = data?.results ?? data ?? []

  const [editId, setEditId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState({ name: '', slug: '', icon: '' })
  const [adding, setAdding] = useState(false)
  const [newValues, setNewValues] = useState({ name: '', slug: '', icon: '' })

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setAdding(false); setNewValues({ name: '', slug: '', icon: '' }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => patchCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditId(null) },
  })
  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const startEdit = (c: Category) => { setEditId(c.id); setEditValues({ name: c.name, slug: c.slug, icon: c.icon }) }
  const errorMessage = createMut.error
    ? getApiErrorMessage(createMut.error)
    : updateMut.error
      ? getApiErrorMessage(updateMut.error)
      : deleteMut.error
        ? getApiErrorMessage(deleteMut.error)
        : ''

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Kategorien</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Neue Kategorie
        </button>
      </div>

      <ErrorBanner message={errorMessage} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Icon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Events</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Abonnenten</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {adding && (
                <tr className="bg-violet-50">
                  <td className="px-4 py-2"><input autoFocus value={newValues.name} onChange={e => setNewValues(v => ({ ...v, name: e.target.value }))} placeholder="Name" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                  <td className="px-4 py-2"><input value={newValues.slug} onChange={e => setNewValues(v => ({ ...v, slug: e.target.value }))} placeholder="slug" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                  <td className="px-4 py-2"><input value={newValues.icon} onChange={e => setNewValues(v => ({ ...v, icon: e.target.value }))} placeholder="emoji / code" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /></td>
                  <td className="px-4 py-2 text-gray-400">—</td>
                  <td className="px-4 py-2 text-gray-400">—</td>
                  <td className="px-4 py-2 flex gap-1">
                    <button onClick={() => createMut.mutate(newValues)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                    <button onClick={() => setAdding(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                  </td>
                </tr>
              )}
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editId === c.id ? <input autoFocus value={editValues.name} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /> : c.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {editId === c.id ? <input value={editValues.slug} onChange={e => setEditValues(v => ({ ...v, slug: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /> : c.slug}
                  </td>
                  <td className="px-4 py-3">
                    {editId === c.id ? <input value={editValues.icon} onChange={e => setEditValues(v => ({ ...v, icon: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /> : <span className="text-lg">{c.icon}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.event_count}</td>
                  <td className="px-4 py-3 text-gray-600">{c.follower_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {editId === c.id ? (
                        <>
                          <button onClick={() => updateMut.mutate({ id: c.id, data: editValues })} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(c)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Pencil size={14} /></button>
                          <button
                            disabled={c.event_count > 0}
                            title={c.event_count > 0 ? 'Kategorien mit Events können nicht gelöscht werden' : 'Kategorie löschen'}
                            onClick={() => { if (confirm(`Kategorie "${c.name}" löschen? ${c.follower_count} Abonnements werden dabei entfernt.`)) deleteMut.mutate(c.id) }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:cursor-not-allowed disabled:opacity-30"
                          ><Trash2 size={14} /></button>
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
