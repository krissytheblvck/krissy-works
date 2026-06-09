'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { ProjectClient } from './ProjectClient'
import { StaircaseClient } from './StaircaseClient'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { PROJECT_TYPE_LABELS } from '@/types'
import { createProjectElement } from '@/app/actions/projects'
import type { Project, ProjectElement, BalconySurvey, StaircaseSurvey, Estimation, Quotation, ResolvedPrices, ProjectType } from '@/types'

const ELEMENT_TYPE_OPTIONS = Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => ({ value, label }))

interface Props {
  project: Project
  initialPrices: ResolvedPrices
}

export function ProjectElementClient({ project, initialPrices }: Props) {
  const router = useRouter()
  const elements = (project.elements ?? []).sort((a, b) => a.display_order - b.display_order)
  const [activeElementId, setActiveElementId] = useState<string | null>(elements[0]?.id ?? null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newType, setNewType] = useState<ProjectType>('balcony')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const activeElement = elements.find(e => e.id === activeElementId) ?? null

  function elementSurveys(el: ProjectElement): BalconySurvey[] {
    return (project.balcony_surveys ?? []).filter((s: BalconySurvey) => s.element_id === el.id)
  }

  function elementStaircaseSurvey(el: ProjectElement): StaircaseSurvey[] {
    return (project.staircase_surveys ?? []).filter((s: StaircaseSurvey) => s.element_id === el.id)
  }

  function elementEstimations(el: ProjectElement): Estimation[] {
    return (project.estimations ?? []).filter((e: Estimation) => e.element_id === el.id)
  }

  function elementQuotation(el: ProjectElement): Quotation | null {
    return (project.quotations ?? []).find((q: Quotation) => q.element_id === el.id) ?? null
  }

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const el = await createProjectElement(project.id, newType, newName.trim())
      router.refresh()
      setActiveElementId(el.id)
      setShowAddForm(false)
      setNewName('')
    } catch (e) {
      console.error(e)
    } finally {
      setAdding(false)
    }
  }, [newName, newType, project.id, router])

  return (
    <div className="flex flex-1 min-h-0">
      {/* Element sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Elements</p>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
              >
                <Plus size={13} /> Add
              </button>
            )}
          </div>
          {showAddForm && (
            <div className="space-y-2" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}>
              <Select
                id="el-type"
                options={ELEMENT_TYPE_OPTIONS}
                value={newType}
                onChange={(e) => setNewType(e.target.value as ProjectType)}
              />
              <Input
                id="el-name"
                placeholder="Element name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" className="flex-1" onClick={handleAdd} disabled={adding || !newName.trim()}>
                  {adding ? 'Adding...' : 'Add'}
                </Button>
                <button
                  onClick={() => { setShowAddForm(false); setNewName('') }}
                  className="p-1.5 text-muted hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {elements.map(el => (
            <button
              key={el.id}
              onClick={() => setActiveElementId(el.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                el.id === activeElementId
                  ? 'bg-gray-900 text-white'
                  : 'text-muted hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              <span className="block truncate">{el.name}</span>
              <span className="block text-xs opacity-60">{PROJECT_TYPE_LABELS[el.type]}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {activeElement ? (
          activeElement.type === 'staircase' ? (
            <StaircaseClient
              project={project}
              initialPrices={initialPrices}
              elementId={activeElement.id}
              surveys={elementStaircaseSurvey(activeElement)}
              estimations={elementEstimations(activeElement)}
              quotation={elementQuotation(activeElement)}
            />
          ) : (
            <ProjectClient
              project={project}
              initialPrices={initialPrices}
              elementId={activeElement.id}
              surveys={elementSurveys(activeElement)}
              estimations={elementEstimations(activeElement)}
              quotation={elementQuotation(activeElement)}
            />
          )
        ) : (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center space-y-3">
              <p className="text-muted text-sm">No elements in this project.</p>
              <Button onClick={() => setShowAddForm(true)} size="sm">
                <Plus size={14} /> Add First Element
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
