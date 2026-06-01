'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MaterialPrice, PriceCategory } from '@/types'
import { upsertPrice, deletePrice } from '@/app/actions/prices'
import { formatCurrency } from '@/lib/utils'
import { FeedbackBanner } from '@/components/ui/feedback-banner'

const PROFILE_OPTIONS = ['20x20', '40x20', '40x40', '60x40', '50x50', '80x40', '100x50', '60x60']

const EMPTY: Record<PriceCategory, Partial<MaterialPrice>> = {
  sheet:   { category: 'sheet',   unit: 'per_sheet', thickness_mm: 2, width_mm: 2000, height_mm: 1000, price: 0, name: '' },
  profile: { category: 'profile', unit: 'per_bar',   profile: '40x40', wall_thickness_mm: 2, bar_length_mm: 6000, price: 0, name: '' },
  cutting: { category: 'cutting', unit: 'per_sheet',  thickness_mm: 2, price: 0, name: '' },
  glass:   { category: 'glass',   unit: 'per_m2',     thickness_mm: 10, price: 0, name: '' },
  labor:   { category: 'labor',   unit: 'per_day',    price: 0, name: '' },
}

interface EditState {
  id: string | 'new'
  data: Partial<MaterialPrice>
}

export function PricesClient({ initialPrices }: { initialPrices: MaterialPrice[] }) {
  const [prices, setPrices] = useState<MaterialPrice[]>(initialPrices)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; variant: 'error' | 'success' } | null>(null)
  const [addingCategory, setAddingCategory] = useState<PriceCategory | null>(null)

  function byCategory(cat: PriceCategory) {
    return prices.filter((p) => p.category === cat)
  }

  function startEdit(price: MaterialPrice) {
    setEditing({ id: price.id, data: { ...price } })
    setAddingCategory(null)
  }

  function startAdd(cat: PriceCategory) {
    setAddingCategory(cat)
    setEditing({ id: 'new', data: { ...EMPTY[cat] } })
  }

  function cancelEdit() {
    setEditing(null)
    setAddingCategory(null)
  }

  function setField(field: keyof MaterialPrice, value: unknown) {
    if (!editing) return
    const updated = { ...editing.data, [field]: value }
    // Auto-generate name for sheets and profiles
    if (field === 'thickness_mm' || field === 'width_mm' || field === 'height_mm') {
      const d = updated
      if (d.category === 'sheet' && d.thickness_mm && d.width_mm && d.height_mm) {
        updated.name = `${d.thickness_mm}mm Sheet ${d.width_mm}×${d.height_mm}`
      }
      if (d.category === 'cutting' && d.thickness_mm) {
        updated.name = `Laser Cut ${d.thickness_mm}mm`
      }
      if (d.category === 'glass' && d.thickness_mm) {
        updated.name = `${d.thickness_mm}mm Glass`
      }
    }
    if (field === 'profile') {
      updated.name = `${value} ${updated.wall_thickness_mm ?? 2}mm wall`
    }
    if (field === 'wall_thickness_mm' && updated.profile) {
      updated.name = `${updated.profile} ${value}mm wall`
    }
    setEditing({ ...editing, data: updated })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    setFeedback(null)
    try {
      await upsertPrice(editing.id === 'new' ? editing.data : { ...editing.data, id: editing.id })
      // Refresh prices list
      const res = await fetch('/api/prices')
      if (res.ok) {
        const updated = await res.json()
        setPrices(updated)
      } else {
        // optimistic update
        if (editing.id === 'new') {
          setPrices((prev) => [...prev, { ...editing.data, id: Date.now().toString(), updated_at: new Date().toISOString(), is_active: true } as MaterialPrice])
        } else {
          setPrices((prev) => prev.map((p) => p.id === editing.id ? { ...p, ...editing.data } as MaterialPrice : p))
        }
      }
      setEditing(null)
      setAddingCategory(null)
      setFeedback({ text: 'Price saved.', variant: 'success' })
    } catch (e) {
      setFeedback({
        text: 'Failed to save: ' + (e instanceof Error ? e.message : 'Unknown error'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this price?')) return
    await deletePrice(id)
    setPrices((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <FeedbackBanner
        message={feedback?.text ?? null}
        variant={feedback?.variant ?? 'error'}
        onDismiss={() => setFeedback(null)}
      />
      <PriceSection
        title="Steel Sheets"
        description="Price per sheet. System calculates how many sheets are needed from the infill area."
        items={byCategory('sheet')}
        editing={editing}
        addingCategory={addingCategory}
        category="sheet"
        onEdit={startEdit}
        onAdd={startAdd}
        onDelete={handleDelete}
        onSave={handleSave}
        onCancel={cancelEdit}
        onField={setField}
        saving={saving}
        renderRow={(p) => (
          <span className="text-gray-500 text-xs">{p.thickness_mm}mm · {p.width_mm}×{p.height_mm}mm · {formatCurrency(p.price)}/sheet</span>
        )}
        renderForm={() => (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input label="Thickness (mm)" type="number" value={editing?.data.thickness_mm ?? ''} onChange={(e) => setField('thickness_mm', Number(e.target.value))} />
            <Input label="Width (mm)" type="number" value={editing?.data.width_mm ?? ''} onChange={(e) => setField('width_mm', Number(e.target.value))} />
            <Input label="Height (mm)" type="number" value={editing?.data.height_mm ?? ''} onChange={(e) => setField('height_mm', Number(e.target.value))} />
            <Input label="Price / sheet (RWF)" type="number" value={editing?.data.price ?? ''} onChange={(e) => setField('price', Number(e.target.value))} />
          </div>
        )}
      />

      <PriceSection
        title="Steel Profiles"
        description="Price per bar. System calculates how many bars are needed from total lengths."
        items={byCategory('profile')}
        editing={editing}
        addingCategory={addingCategory}
        category="profile"
        onEdit={startEdit}
        onAdd={startAdd}
        onDelete={handleDelete}
        onSave={handleSave}
        onCancel={cancelEdit}
        onField={setField}
        saving={saving}
        renderRow={(p) => (
          <span className="text-gray-500 text-xs">{p.profile} · wall {p.wall_thickness_mm}mm · {p.bar_length_mm}mm bar · {formatCurrency(p.price)}/bar</span>
        )}
        renderForm={() => (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Profile</label>
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                value={editing?.data.profile ?? '40x40'}
                onChange={(e) => setField('profile', e.target.value)}
              >
                {PROFILE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="custom">Custom...</option>
              </select>
            </div>
            <Input label="Wall thickness (mm)" type="number" value={editing?.data.wall_thickness_mm ?? 2} onChange={(e) => setField('wall_thickness_mm', Number(e.target.value))} />
            <Input label="Bar length (mm)" type="number" value={editing?.data.bar_length_mm ?? 6000} onChange={(e) => setField('bar_length_mm', Number(e.target.value))} />
            <Input label="Price / bar (RWF)" type="number" value={editing?.data.price ?? ''} onChange={(e) => setField('price', Number(e.target.value))} />
          </div>
        )}
      />

      <PriceSection
        title="Laser / CNC Cutting"
        description="Price per sheet cut. System multiplies by how many sheets are needed for the project."
        items={byCategory('cutting')}
        editing={editing}
        addingCategory={addingCategory}
        category="cutting"
        onEdit={startEdit}
        onAdd={startAdd}
        onDelete={handleDelete}
        onSave={handleSave}
        onCancel={cancelEdit}
        onField={setField}
        saving={saving}
        renderRow={(p) => (
          <span className="text-gray-500 text-xs">{p.thickness_mm}mm sheet · {formatCurrency(p.price)}/sheet cut</span>
        )}
        renderForm={() => (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Sheet thickness (mm)" type="number" value={editing?.data.thickness_mm ?? ''} onChange={(e) => setField('thickness_mm', Number(e.target.value))} />
            <Input label="Price / sheet cut (RWF)" type="number" value={editing?.data.price ?? ''} onChange={(e) => setField('price', Number(e.target.value))} />
          </div>
        )}
      />

      <PriceSection
        title="Glass Panels"
        description="Price per m². System calculates total glass area from infill dimensions."
        items={byCategory('glass')}
        editing={editing}
        addingCategory={addingCategory}
        category="glass"
        onEdit={startEdit}
        onAdd={startAdd}
        onDelete={handleDelete}
        onSave={handleSave}
        onCancel={cancelEdit}
        onField={setField}
        saving={saving}
        renderRow={(p) => (
          <span className="text-gray-500 text-xs">{p.thickness_mm}mm · {formatCurrency(p.price)}/m²</span>
        )}
        renderForm={() => (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Thickness (mm)" type="number" value={editing?.data.thickness_mm ?? ''} onChange={(e) => setField('thickness_mm', Number(e.target.value))} />
            <Input label="Price / m² (RWF)" type="number" value={editing?.data.price ?? ''} onChange={(e) => setField('price', Number(e.target.value))} />
          </div>
        )}
      />

      <PriceSection
        title="Labor Rates"
        description="Daily rates for fabrication and installation."
        items={byCategory('labor')}
        editing={editing}
        addingCategory={addingCategory}
        category="labor"
        onEdit={startEdit}
        onAdd={startAdd}
        onDelete={handleDelete}
        onSave={handleSave}
        onCancel={cancelEdit}
        onField={setField}
        saving={saving}
        renderRow={(p) => (
          <span className="text-gray-500 text-xs">{formatCurrency(p.price)}/day</span>
        )}
        renderForm={() => (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={editing?.data.name ?? ''} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Fabrication Labor" />
            <Input label="Price / day (RWF)" type="number" value={editing?.data.price ?? ''} onChange={(e) => setField('price', Number(e.target.value))} />
          </div>
        )}
      />
    </div>
  )
}

interface PriceSectionProps {
  title: string
  description: string
  items: MaterialPrice[]
  editing: EditState | null
  addingCategory: PriceCategory | null
  category: PriceCategory
  onEdit: (p: MaterialPrice) => void
  onAdd: (c: PriceCategory) => void
  onDelete: (id: string) => void
  onSave: () => void
  onCancel: () => void
  onField: (f: keyof MaterialPrice, v: unknown) => void
  saving: boolean
  renderRow: (p: MaterialPrice) => React.ReactNode
  renderForm: () => React.ReactNode
}

function PriceSection({
  title, description, items, editing, addingCategory, category,
  onEdit, onAdd, onDelete, onSave, onCancel, saving, renderRow, renderForm,
}: PriceSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onAdd(category)}>
            <Plus size={14} /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                {editing?.id === item.id ? (
                  <td className="px-6 py-4" colSpan={2}>
                    <div className="space-y-3">
                      {renderForm()}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={onSave} disabled={saving}>
                          <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={onCancel}>
                          <X size={14} /> Cancel
                        </Button>
                      </div>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {renderRow(item)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>
                          <Pencil size={13} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(item.id)}>
                          <Trash2 size={13} className="text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {/* Add new row form */}
            {addingCategory === category && editing?.id === 'new' && (
              <tr>
                <td className="px-6 py-4" colSpan={2}>
                  <div className="space-y-3">
                    {renderForm()}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={onSave} disabled={saving}>
                        <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={onCancel}>
                        <X size={14} /> Cancel
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {items.length === 0 && addingCategory !== category && (
              <tr>
                <td className="px-6 py-4 text-gray-400 text-sm" colSpan={2}>
                  No prices set yet. Click Add to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
