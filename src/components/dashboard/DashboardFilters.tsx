'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, LayoutList, Columns, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STATUS_COLORS, STATUS_LABELS, PROJECT_TYPE_LABELS } from '@/types'
import type { ProjectStatus, ProjectType } from '@/types'
import { formatDate, formatCurrency } from '@/lib/utils'

interface ProjectRow {
  id: string
  project_code: string
  client: { name: string }
  type: ProjectType
  status: ProjectStatus
  title: string
  location: string
  created_at: string
  updated_at: string
  estimations?: { total_cost: number; quoted_price?: number }[]
}

const PIPELINE_STAGES: ProjectStatus[] = [
  'inquiry', 'site_survey', 'concept_design', 'quotation_sent',
  'approved', 'fabrication', 'installation', 'completed',
]

const STAGE_ICONS: Record<ProjectStatus, string> = {
  inquiry: '🔍',
  site_survey: '📐',
  concept_design: '✏️',
  quotation_sent: '📄',
  approved: '✅',
  fabrication: '🔩',
  installation: '🏗️',
  completed: '🎉',
}

function projectValue(project: ProjectRow) {
  const e = project.estimations?.[0]
  const v = e?.quoted_price || e?.total_cost
  return v ? formatCurrency(v) : null
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const value = projectValue(project)
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="block rounded-lg border border-border bg-surface p-4 hover:border-stone-400 hover:shadow-sm transition-all active:bg-surface-muted">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{project.project_code}</p>
            <p className="text-sm text-muted truncate mt-0.5">{project.title}</p>
          </div>
          <Badge className={`${STATUS_COLORS[project.status]} shrink-0 text-[10px]`}>
            {STATUS_LABELS[project.status]}
          </Badge>
        </div>
        <p className="text-xs text-muted mt-2 truncate">{project.client?.name ?? '—'}</p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted">
            {PROJECT_TYPE_LABELS[project.type]}
            {project.location ? ` · ${project.location}` : ''}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {value ?? <span className="text-muted font-normal">—</span>}
          </span>
        </div>
        <p className="text-[10px] text-muted mt-2 flex items-center gap-1">
          View project <ChevronRight size={12} />
        </p>
      </div>
    </Link>
  )
}

export function DashboardFilters({ projects }: { projects: ProjectRow[] }) {
  const [view, setView] = useState<'list' | 'pipeline'>('list')
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()

  const filtered = projects
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p => !q || (
      p.project_code.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.client?.name?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q)
    ))

  const statuses: (ProjectStatus | 'all')[] = [
    'all', 'inquiry', 'site_survey', 'concept_design',
    'quotation_sent', 'approved', 'fabrication', 'installation', 'completed',
  ]

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-col gap-4">
          <CardTitle>All Projects ({filtered.length})</CardTitle>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex rounded-lg border border-border overflow-hidden w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 px-4 py-2.5 sm:py-1.5 text-xs font-medium transition-colors min-h-11 sm:min-h-0 ${
                  view === 'list' ? 'bg-gray-900 text-white' : 'bg-surface text-muted hover:text-foreground'
                }`}
              >
                <LayoutList size={13} /> List
              </button>
              <button
                type="button"
                onClick={() => setView('pipeline')}
                className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 px-4 py-2.5 sm:py-1.5 text-xs font-medium transition-colors border-l border-border min-h-11 sm:min-h-0 ${
                  view === 'pipeline' ? 'bg-gray-900 text-white' : 'bg-surface text-muted hover:text-foreground'
                }`}
              >
                <Columns size={13} /> Pipeline
              </button>
            </div>

            <div className="relative w-full sm:flex-1 sm:max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Search code, client, location…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 sm:py-1.5 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-[var(--ring)] min-h-11 sm:min-h-0"
              />
            </div>
          </div>

          {view === 'list' && (
            <>
              <div className="md:hidden">
                <label htmlFor="status-filter" className="text-xs font-medium text-muted block mb-1">
                  Status
                </label>
                <select
                  id="status-filter"
                  value={filter}
                  onChange={e => setFilter(e.target.value as ProjectStatus | 'all')}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] min-h-11"
                >
                  {statuses.map(s => (
                    <option key={s} value={s}>
                      {s === 'all' ? 'All statuses' : STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hidden md:flex gap-1.5 flex-wrap">
                {statuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilter(s)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      filter === s
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-surface text-muted border-border hover:border-stone-400'
                    }`}
                  >
                    {s === 'all' ? 'All' : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

            </>
          )}
        </div>
      </CardHeader>

      {view === 'list' && (
        <CardContent className="p-0">
          {/* Mobile: cards */}
          <div className="md:hidden p-4 space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted text-sm">
                {q || filter !== 'all' ? 'No projects match your filter.' : 'No projects yet.'}
              </div>
            ) : (
              filtered.map(project => <ProjectCard key={project.id} project={project} />)
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Project</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Client</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Location</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Value</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Updated</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((project) => (
                  <tr key={project.id} className="hover:bg-surface-muted transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{project.project_code}</p>
                      <p className="text-xs text-muted truncate max-w-[160px]">{project.title}</p>
                    </td>
                    <td className="px-6 py-4 text-foreground">{project.client?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-muted text-xs">{project.location ?? '—'}</td>
                    <td className="px-6 py-4 text-muted">{PROJECT_TYPE_LABELS[project.type]}</td>
                    <td className="px-6 py-4">
                      <Badge className={STATUS_COLORS[project.status]}>
                        {STATUS_LABELS[project.status]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">
                      {projectValue(project) ?? <span className="text-muted">—</span>}
                    </td>
                    <td className="px-6 py-4 text-muted text-xs">{formatDate(project.updated_at)}</td>
                    <td className="px-6 py-4">
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="ghost" size="sm">View →</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted text-sm">
                {q || filter !== 'all' ? 'No projects match your filter.' : 'No projects yet.'}
              </div>
            )}
          </div>
        </CardContent>
      )}

      {view === 'pipeline' && (
        <CardContent className="p-4">
          <p className="text-xs text-muted mb-3 md:hidden">Swipe horizontally to see all stages</p>
          <div className="overflow-x-auto pb-2 scroll-hint-x">
            <div className="flex gap-3 min-w-max">
              {PIPELINE_STAGES.map((stage) => {
                const stageProjects = projects.filter(p =>
                  p.status === stage &&
                  (!q || (
                    p.project_code.toLowerCase().includes(q) ||
                    p.title.toLowerCase().includes(q) ||
                    p.client?.name?.toLowerCase().includes(q)
                  ))
                )
                const stageValue = stageProjects.reduce((sum, p) => {
                  const e = p.estimations?.[0]
                  return sum + (e?.quoted_price || e?.total_cost || 0)
                }, 0)

                return (
                  <div key={stage} className="w-52 flex-shrink-0">
                    <div className={`rounded-t-lg px-3 py-2 ${STATUS_COLORS[stage]}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">
                          {STAGE_ICONS[stage]} {STATUS_LABELS[stage]}
                        </span>
                        <span className="text-xs font-bold bg-surface/40 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {stageProjects.length}
                        </span>
                      </div>
                      {stageValue > 0 && (
                        <p className="text-xs mt-0.5 opacity-75">{formatCurrency(stageValue)}</p>
                      )}
                    </div>

                    <div className="bg-surface-muted rounded-b-lg border border-t-0 border-border min-h-[120px] p-2 space-y-2">
                      {stageProjects.length === 0 && (
                        <p className="text-xs text-muted text-center pt-4">empty</p>
                      )}
                      {stageProjects.map((p) => (
                        <Link key={p.id} href={`/projects/${p.id}`}>
                          <div className="bg-surface rounded-lg border border-border p-2.5 hover:border-stone-400 hover:shadow-sm transition-all cursor-pointer">
                            <p className="text-xs font-bold text-foreground">{p.project_code}</p>
                            <p className="text-xs text-muted truncate mt-0.5">{p.title}</p>
                            <p className="text-xs text-muted truncate">{p.client?.name}</p>
                            {projectValue(p) && (
                              <p className="text-xs font-semibold text-foreground mt-1.5">{projectValue(p)}</p>
                            )}
                            <p className="text-xs text-muted mt-1">{formatDate(p.updated_at)}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
