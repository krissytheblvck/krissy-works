'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, LayoutList, Columns } from 'lucide-react'
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
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>All Projects ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setView('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    view === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <LayoutList size={13} /> List
                </button>
                <button
                  onClick={() => setView('pipeline')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${
                    view === 'pipeline' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Columns size={13} /> Pipeline
                </button>
              </div>
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search code, client, location…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-4 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 w-56"
                />
              </div>
            </div>
          </div>

          {/* Status filter tabs — list view only */}
          {view === 'list' && (
            <div className="flex gap-1.5 flex-wrap">
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    filter === s
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {s === 'all' ? 'All' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      {/* ── LIST VIEW ──────────────────────────────────────────────────── */}
      {view === 'list' && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Location</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Updated</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{project.project_code}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[160px]">{project.title}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{project.client?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs hidden sm:table-cell">{project.location ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{PROJECT_TYPE_LABELS[project.type]}</td>
                    <td className="px-6 py-4">
                      <Badge className={STATUS_COLORS[project.status]}>
                        {STATUS_LABELS[project.status]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {(() => { const e = project.estimations?.[0]; const v = e?.quoted_price || e?.total_cost; return v ? formatCurrency(v) : <span className="text-gray-300">—</span> })()}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs hidden md:table-cell">{formatDate(project.updated_at)}</td>
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
              <div className="text-center py-12 text-gray-400 text-sm">
                {q || filter !== 'all' ? 'No projects match your filter.' : 'No projects yet.'}
              </div>
            )}
          </div>
        </CardContent>
      )}

      {/* ── PIPELINE VIEW ──────────────────────────────────────────────── */}
      {view === 'pipeline' && (
        <CardContent className="p-4">
          <div className="overflow-x-auto pb-2">
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
                    {/* Column header */}
                    <div className={`rounded-t-lg px-3 py-2 ${STATUS_COLORS[stage]}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">
                          {STAGE_ICONS[stage]} {STATUS_LABELS[stage]}
                        </span>
                        <span className="text-xs font-bold bg-white/40 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {stageProjects.length}
                        </span>
                      </div>
                      {stageValue > 0 && (
                        <p className="text-xs mt-0.5 opacity-75">{formatCurrency(stageValue)}</p>
                      )}
                    </div>

                    {/* Cards */}
                    <div className="bg-gray-50 rounded-b-lg border border-t-0 border-gray-200 min-h-[120px] p-2 space-y-2">
                      {stageProjects.length === 0 && (
                        <p className="text-xs text-gray-300 text-center pt-4">empty</p>
                      )}
                      {stageProjects.map((p) => (
                        <Link key={p.id} href={`/projects/${p.id}`}>
                          <div className="bg-white rounded-lg border border-gray-200 p-2.5 hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer">
                            <p className="text-xs font-bold text-gray-900">{p.project_code}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{p.title}</p>
                            <p className="text-xs text-gray-400 truncate">{p.client?.name}</p>
                            {(() => { const e = p.estimations?.[0]; const v = e?.quoted_price || e?.total_cost; return v ? <p className="text-xs font-semibold text-gray-700 mt-1.5">{formatCurrency(v)}</p> : null })()}
                            <p className="text-xs text-gray-300 mt-1">{formatDate(p.updated_at)}</p>
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
