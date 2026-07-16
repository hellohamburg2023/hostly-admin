import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage, getCategories, createCategory, patchCategory, deleteCategory } from '../api'
import { ErrorBanner } from '../adminUi'
import { SystemIcon, SystemIconSelect } from '../adminIcons'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface Category { id: number; name: string; slug: string; icon: string; event_count: number; follower_count: number }

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

export default function CategoriesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const categories: Category[] = data?.results ?? data ?? []

  const [editId, setEditId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState({ name: '', icon: '' })
  const [adding, setAdding] = useState(false)
  const [newValues, setNewValues] = useState({ name: '', icon: '' })

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setAdding(false); setNewValues({ name: '', icon: '' }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => patchCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditId(null) },
  })
  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const startEdit = (c: Category) => { setEditId(c.id); setEditValues({ name: c.name, icon: c.icon }) }
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
        <h2 className="text-xl font-bold text-gray-900">Kategorien</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Neue Kategorie
        </button>
      </div>

      <ErrorBanner message={errorMessage} />

      <div className="admin-table overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : (
          <table className="w-full min-w-[650px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Icon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Events</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Abonnenten</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {adding && (
                <tr className="bg-violet-50">
                  <td className="px-4 py-2">
                    <input autoFocus value={newValues.name} onChange={e => setNewValues(v => ({ ...v, name: e.target.value }))} placeholder="Name der Kategorie" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    <span className="mt-1 block text-xs text-gray-500">Die technische Kennung wird automatisch erstellt.</span>
                  </td>
                  <td className="px-4 py-2">
                    <SystemIconSelect value={newValues.icon} onChange={icon => setNewValues(v => ({ ...v, icon }))} />
                  </td>
                  <td className="px-4 py-2 text-gray-400">—</td>
                  <td className="px-4 py-2 text-gray-400">—</td>
                  <td className="px-4 py-2 flex gap-1">
                    <button
                      disabled={!newValues.name.trim() || !newValues.icon}
                      onClick={() => createMut.mutate({ ...newValues, slug: slugFromName(newValues.name) })}
                      className="rounded p-1.5 text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-30"
                    ><Check size={14} /></button>
                    <button onClick={() => setAdding(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                  </td>
                </tr>
              )}
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editId === c.id ? <input autoFocus value={editValues.name} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" /> : c.name}
                  </td>
                  <td className="px-4 py-3">
                    {editId === c.id ? (
                      <SystemIconSelect value={editValues.icon} onChange={icon => setEditValues(v => ({ ...v, icon }))} />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700" title={c.icon}>
                        <SystemIcon name={c.icon} size={17} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.event_count}</td>
                  <td className="px-4 py-3 text-gray-600">{c.follower_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {editId === c.id ? (
                        <>
                          <button
                            disabled={!editValues.name.trim() || !editValues.icon}
                            onClick={() => updateMut.mutate({ id: c.id, data: editValues })}
                            className="rounded p-1.5 text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-30"
                          ><Check size={14} /></button>
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
