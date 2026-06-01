'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Save, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS, STATUS_LABELS } from '@/types'
import type { BalconySurvey, ProjectStatus, ProjectType, SteelProfile, InfillType, GlassSystemType, MountingType, SectionOption, PanelLayout } from '@/types'
import { calculateBalconyEstimation, generateGrasshopperParams } from '@/lib/estimation'
import { DEFAULT_RESOLVED_PRICES } from '@/lib/default-prices'
import { formatCurrency } from '@/lib/utils'
import { saveAreaSurvey, deleteAreaSurvey, updateProjectStatus } from '@/app/actions/projects'
import { QuotationTab } from './QuotationTab'
import { FeedbackBanner } from '@/components/ui/feedback-banner'

const STATUS_FLOW: ProjectStatus[] = [
  'inquiry', 'site_survey', 'concept_design', 'quotation_sent',
  'approved', 'fabrication', 'installation', 'completed',
]
const NEXT_LABEL: Partial<Record<ProjectStatus, string>> = {
  inquiry: 'Start Site Survey',
  site_survey: 'Move to Design',
  concept_design: 'Mark Quotation Sent',
  quotation_sent: 'Mark as Approved',
  approved: 'Start Fabrication',
  fabrication: 'Start Installation',
  installation: 'Mark Completed',
}
const PROFILE_OPTIONS = [
  { value: '20x20', label: '20×20 SHS' },
  { value: '40x20', label: '40×20 RHS' },
  { value: '40x40', label: '40×40 SHS' },
  { value: '60x40', label: '60×40 RHS' },
]
const INFILL_OPTIONS = [
  { value: 'plain_sheet', label: 'Steel Sheet (CNC Cut)' },
  { value: 'glass',       label: 'Glass Panels' },
  { value: 'flat_bars',   label: 'Flat Bars' },
]
const GLASS_SYSTEM_OPTIONS = [
  { value: 'framed_post',  label: 'Steel Posts + Glass Infill' },
  { value: 'spigot',       label: 'Spigot System (Frameless)' },
  { value: 'channel_base', label: 'Channel Base System' },
  { value: 'embedded',     label: 'Embedded in Slab / Beam' },
]
const GLASS_SYSTEM_LABELS: Record<string, string> = {
  framed_post:  'Steel Posts',
  spigot:       'Spigot (Frameless)',
  channel_base: 'Channel Base',
  embedded:     'Embedded',
}
const MOUNTING_OPTIONS = [
  { value: 'wall',  label: 'Wall-Mounted' },
  { value: 'floor', label: 'Floor-Mounted' },
]
const WALL_OPTIONS = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'brick',    label: 'Brick' },
  { value: 'block',    label: 'Block' },
  { value: 'other',    label: 'Other' },
]
const ACCESS_OPTIONS = [
  { value: 'easy',   label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Difficult' },
]

const DEFAULT_SURVEY: Partial<BalconySurvey> = {
  total_length:        6000,
  total_height:        1000,
  post_profile:        '40x40',
  bottom_rail_profile: '40x20',
  top_rail_profile:    '40x40',
  catch_profile:       '20x20',
  infill_type:         'plain_sheet',
  sheet_thickness:     2,
  mounting_type:       'wall',
  wall_type:           'concrete',
  access_difficulty:   'easy',
}

interface AreaState {
  tempId: string
  surveyId: string | null
  name: string
  survey: Partial<BalconySurvey>
  cncRatePerSheet: number
  saved: boolean
}

function genTempId() { return `area_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

function defaultCncRate(thickness: number) {
  return DEFAULT_RESOLVED_PRICES.cutting[thickness as keyof typeof DEFAULT_RESOLVED_PRICES.cutting]?.price ?? 60000
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ProjectClient({ project }: { project: any }) {
  const isDemo = !project

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectMeta = project ?? {
    id: 'demo', project_code: 'BAL-DEMO', status: 'site_survey',
    title: 'Demo Balcony Project', location: 'Kigali, Rwanda',
    client: { name: 'Demo Client' },
    balcony_surveys: [], estimations: [], quotations: [],
  }

  const existingSurveys: BalconySurvey[]  = projectMeta.balcony_surveys ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingEstimations: any[]        = projectMeta.estimations ?? []
  const existingQuotation                 = projectMeta.quotations?.[0]

  // Index estimations by survey_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estBySurveyId: Record<string, any> = Object.fromEntries(
    existingEstimations.map(e => [e.survey_id, e])
  )

  const initAreas: AreaState[] = existingSurveys.length > 0
    ? existingSurveys.map(s => ({
        tempId:          s.id,
        surveyId:        s.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name:            (s as any).name ?? 'Main Area',
        survey:          s,
        cncRatePerSheet: defaultCncRate(s.sheet_thickness ?? 2),
        saved:           true,
      }))
    : [{
        tempId:          genTempId(),
        surveyId:        null,
        name:            'Main Area',
        survey:          { ...DEFAULT_SURVEY },
        cncRatePerSheet: 60000,
        saved:           false,
      }]

  const firstExistingEst = existingEstimations[0]

  const [areas, setAreas]                 = useState<AreaState[]>(initAreas)
  const [activeAreaIdx, setActiveAreaIdx] = useState(0)
  // Project-level costs — shared across all areas
  const [fabricationCost, setFabricationCost]   = useState(
    existingEstimations.reduce((s: number, e: any) => s + (e.labor_cost ?? 0), 0) // eslint-disable-line @typescript-eslint/no-explicit-any
  )
  const [installationCost, setInstallationCost] = useState(firstExistingEst?.installation_cost ?? 0)
  const [consumablesPercent, setConsumablesPercent]     = useState(firstExistingEst?.consumables_percent ?? 7)
  const [surfaceTreatmentType, setSurfaceTreatmentType] = useState<'none' | 'powder_coat' | 'paint'>(
    (firstExistingEst?.surface_treatment_type as 'none' | 'powder_coat' | 'paint') ?? 'none'
  )
  const [surfaceTreatmentRate, setSurfaceTreatmentRate] = useState(firstExistingEst?.surface_treatment_rate ?? 8000)
  const [transportCost, setTransportCost]   = useState(firstExistingEst?.transport_cost ?? 0)
  const [hardwareCost, setHardwareCost]     = useState(firstExistingEst?.hardware_cost ?? 0)
  const [contingencyPercent, setContingencyPercent] = useState(firstExistingEst?.contingency_percent ?? 10)
  const [marginPercent, setMarginPercent]   = useState(firstExistingEst?.margin_percent ?? 30)
  const [activeTab, setActiveTab]           = useState<'survey' | 'estimation' | 'quotation'>('survey')
  const [saving, setSaving]                 = useState(false)
  const [currentStatus, setCurrentStatus]   = useState<ProjectStatus>(projectMeta.status as ProjectStatus)
  const [statusChanging, setStatusChanging] = useState(false)
  const [deletingIdx, setDeletingIdx]       = useState<number | null>(null)
  const [feedback, setFeedback]             = useState<{ text: string; variant: 'error' | 'success' } | null>(null)

  const currentIdx = STATUS_FLOW.indexOf(currentStatus)
  const nextStatus = STATUS_FLOW[currentIdx + 1] as ProjectStatus | undefined

  // ── Area helpers ────────────────────────────────────────────────────────────

  function set(field: keyof BalconySurvey, value: unknown) {
    setAreas(prev => prev.map((a, i) =>
      i === activeAreaIdx ? { ...a, survey: { ...a.survey, [field]: value }, saved: false } : a
    ))
  }

  function pickSection(opt: SectionOption) {
    setAreas(prev => prev.map((a, i) =>
      i === activeAreaIdx ? {
        ...a,
        survey: { ...a.survey, num_sections: opt.num_sections, sheet_width_mm: opt.supplier_sheet.width_mm, sheet_height_mm: opt.supplier_sheet.height_mm },
        saved: false,
      } : a
    ))
  }

  function addArea() {
    const newArea: AreaState = {
      tempId:          genTempId(),
      surveyId:        null,
      name:            `Area ${areas.length + 1}`,
      survey:          { ...DEFAULT_SURVEY },
      cncRatePerSheet: 60000,
      saved:           false,
    }
    setAreas(prev => [...prev, newArea])
    setActiveAreaIdx(areas.length)
  }

  async function removeArea(idx: number) {
    const area = areas[idx]
    if (area.surveyId && !isDemo) {
      if (!confirm(`Delete "${area.name}"? This cannot be undone.`)) return
      setDeletingIdx(idx)
      try {
        await deleteAreaSurvey(area.surveyId, projectMeta.id)
      } catch (e) { console.error(e); return }
      finally { setDeletingIdx(null) }
    }
    setAreas(prev => prev.filter((_, i) => i !== idx))
    setActiveAreaIdx(Math.max(0, idx - 1))
  }

  // ── Per-area calculations ────────────────────────────────────────────────────

  const areaCalcs = useMemo(() => areas.map(area => {
    const s = area.survey
    const isGlassOnly = s.infill_type === 'glass' && !!s.glass_system_type && s.glass_system_type !== 'framed_post'
    const isComplete = isGlassOnly
      ? !!(s.total_length && s.total_height && s.glass_thickness && s.post_spacing && s.mounting_type)
      : !!(s.total_length && s.total_height && s.post_profile && s.bottom_rail_profile && s.top_rail_profile &&
           s.infill_type && s.mounting_type &&
           (s.panel_layout !== 'inset' || (!!s.panel_height_mm && s.panel_height_mm > 0)))

    let estimation: ReturnType<typeof calculateBalconyEstimation> | null = null
    let estimationError = ''
    if (isComplete) {
      try {
        estimation = calculateBalconyEstimation(s as BalconySurvey, DEFAULT_RESOLVED_PRICES)
      } catch (e) {
        estimationError = e instanceof Error ? e.message : 'Could not calculate'
      }
    }

    const cncCuttingCost = estimation && s.infill_type === 'plain_sheet'
      ? (estimation.total_sheets ?? 0) * area.cncRatePerSheet : 0

    return { estimation, estimationError, cncCuttingCost, isGlassOnly, isComplete }
  }), [areas])

  const activeArea = areas[activeAreaIdx] ?? areas[0]
  const activeCalc = areaCalcs[activeAreaIdx] ?? areaCalcs[0]
  const { estimation, estimationError, isGlassOnly } = activeCalc ?? {}

  // ── Aggregated totals ────────────────────────────────────────────────────────

  const totalFrameCost  = areaCalcs.reduce((s, c) => s + (c.estimation?.frame_cost ?? 0), 0)
  const totalInfillArea = areaCalcs.reduce((s, c) => s + (c.estimation?.infill_area_m2 ?? 0), 0)
  const totalSubtotal   = areaCalcs.reduce((s, c) => s + (c.estimation?.subtotal ?? 0), 0)
  const totalCncCost    = areaCalcs.reduce((s, c) => s + c.cncCuttingCost, 0)
  // Labor extracted from subtotals so it can be overridden at project level
  const totalLaborCost  = areaCalcs.reduce((s, c) => s + (c.estimation?.labor_cost ?? 0), 0)
  const totalLaborDays  = areaCalcs.reduce((s, c) => s + (c.estimation?.labor_days ?? 0), 0)

  const consumablesCost       = Math.round(totalFrameCost * consumablesPercent / 100)
  const surfaceTreatmentCost  = surfaceTreatmentType !== 'none' ? Math.round(totalInfillArea * surfaceTreatmentRate) : 0
  // directTotal uses the project-level fabricationCost instead of summed per-area labor
  const directTotal           = (totalSubtotal - totalLaborCost) + fabricationCost + totalCncCost + consumablesCost + surfaceTreatmentCost + transportCost + hardwareCost + installationCost
  const contingencyCost       = Math.round(directTotal * contingencyPercent / 100)
  const adjustedCost          = directTotal + contingencyCost
  const marginCost            = Math.round(adjustedCost * marginPercent / 100)
  const quotedPrice           = adjustedCost + marginCost

  const anyAreaComplete = areaCalcs.some(c => c.isComplete)
  const chosenN = estimation?.num_sections ?? activeArea?.survey.num_sections

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSaveArea() {
    if (!activeCalc.isComplete || isDemo) return
    setSaving(true)
    setFeedback(null)
    try {
      const result = await saveAreaSurvey(
        projectMeta.id,
        activeArea.surveyId,
        activeArea.name,
        activeArea.survey as Omit<BalconySurvey, 'id' | 'project_id' | 'created_at'>,
        activeCalc.cncCuttingCost,
        installationCost,
        { consumablesPercent, surfaceTreatmentType, surfaceTreatmentRate, transportCost, hardwareCost, contingencyPercent, marginPercent, quotedPrice }
      )
      setAreas(prev => prev.map((a, i) =>
        i === activeAreaIdx ? { ...a, surveyId: result.surveyId, saved: true } : a
      ))
      setFeedback({ text: 'Area saved.', variant: 'success' })
    } catch (e) {
      console.error(e)
      setFeedback({ text: 'Failed to save area. Check your connection and try again.', variant: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDownloadBOM() {
    const readyCalcs = areaCalcs.filter(c => c.estimation)
    if (readyCalcs.length === 0) return
    setFeedback(null)
    try {
      const allLineItems = readyCalcs.flatMap((c, i) => {
        const area = areas[i]
        if (!c.estimation) return []
        const header = { label: `── ${area.name} ──`, sub: '', qty: '', unit: '', unit_price: 0, total: 0 }
        return areas.length > 1 ? [header, ...c.estimation.line_items] : c.estimation.line_items
      })
      const totalSub = readyCalcs.reduce((s, c) => s + (c.estimation?.subtotal ?? 0), 0)

      const payload = {
        project_code:     projectMeta.project_code,
        project_title:    projectMeta.title,
        project_location: projectMeta.location,
        project_type:     'Balcony Railing',
        client_name:      projectMeta.client?.name,
        line_items:       allLineItems,
        subtotal:         totalSub,
      }
      const res = await fetch('/api/bom-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('BOM generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${projectMeta.project_code}_BOM.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      setFeedback({ text: 'BOM PDF download failed. Please try again.', variant: 'error' })
    }
  }

  async function handleStatusChange(newStatus: ProjectStatus) {
    if (isDemo) return
    setStatusChanging(true)
    try {
      await updateProjectStatus(projectMeta.id, newStatus)
      setCurrentStatus(newStatus)
    } catch (e) { console.error(e) }
    finally { setStatusChanging(false) }
  }

  function downloadGrasshopperFile() {
    if (!activeArea?.survey.total_length) return
    const params = generateGrasshopperParams(activeArea.survey as BalconySurvey, projectMeta.project_code)
    const blob = new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${projectMeta.project_code}_${activeArea.name.replace(/\s+/g, '_')}_grasshopper.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const firstSavedEstimationId = areas
    .map((a, i) => a.surveyId ? estBySurveyId[a.surveyId]?.id : null)
    .find(id => id) ?? null

  return (
    <div className="min-h-0 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 sm:gap-4 min-w-0">
            <Link href="/dashboard" className="shrink-0 mt-0.5">
              <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-gray-900">{projectMeta.project_code}</h1>
                <Badge className={STATUS_COLORS[currentStatus]}>{STATUS_LABELS[currentStatus]}</Badge>
                {isDemo && <Badge className="bg-amber-100 text-amber-700">Demo</Badge>}
                {!isDemo && nextStatus && (
                  <button onClick={() => handleStatusChange(nextStatus)} disabled={statusChanging}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50">
                    <ChevronRight size={13} />
                    <span className="hidden sm:inline">{statusChanging ? 'Updating...' : NEXT_LABEL[currentStatus]}</span>
                    <span className="sm:hidden">{statusChanging ? '…' : 'Next'}</span>
                  </button>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 truncate">{projectMeta.title} — {projectMeta.client?.name}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {!isDemo && (
              <Button variant="secondary" size="sm" className="w-full sm:w-auto justify-center min-h-11 sm:min-h-0" onClick={handleSaveArea} disabled={saving || !activeCalc.isComplete}>
                <Save size={14} /> {saving ? 'Saving...' : activeArea.saved ? 'Saved ✓' : 'Save Area'}
              </Button>
            )}
            <Button variant="secondary" size="sm" className="w-full sm:w-auto justify-center min-h-11 sm:min-h-0" onClick={downloadGrasshopperFile} disabled={!activeCalc.isComplete}>
              <Download size={14} /> <span className="sm:hidden">Rhino JSON</span><span className="hidden sm:inline">Export to Rhino</span>
            </Button>
          </div>
        </div>
      </header>

      {feedback && (
        <div className="px-4 sm:px-6 pt-3 max-w-7xl mx-auto w-full">
          <FeedbackBanner
            message={feedback.text}
            variant={feedback.variant}
            onDismiss={() => setFeedback(null)}
          />
        </div>
      )}

      {/* Status stepper */}
      {!isDemo && (
        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-2 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex items-center gap-1 min-w-max">
            {STATUS_FLOW.map((s, i) => {
              const isDone    = STATUS_FLOW.indexOf(currentStatus) > i
              const isCurrent = s === currentStatus
              return (
                <div key={s} className="flex items-center gap-1">
                  <button onClick={() => handleStatusChange(s)}
                    disabled={statusChanging || s === currentStatus}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:cursor-default ${
                      isCurrent ? STATUS_COLORS[s] + ' ring-1 ring-current'
                        : isDone ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}>
                    {STATUS_LABELS[s]}
                  </button>
                  {i < STATUS_FLOW.length - 1 && <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs — sticky on mobile for thumb reach */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 shadow-sm sm:shadow-none">
        <div className="max-w-7xl mx-auto flex">
          {(['survey', 'estimation', 'quotation'] as const).map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-2 sm:px-6 py-3.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-12 sm:min-h-0 ${
                activeTab === tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <span className="sm:hidden">{tab === 'survey' ? 'Survey' : tab === 'estimation' ? 'Estimate' : 'Quote'}</span>
              <span className="hidden sm:inline">{tab === 'survey' ? 'Site Survey' : tab === 'estimation' ? 'Estimation' : 'Quotation'}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">

        {/* ── SURVEY TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'survey' && (
          <div className="space-y-4">
            {/* Area tab bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {areas.map((area, i) => (
                <button key={area.tempId} onClick={() => setActiveAreaIdx(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    i === activeAreaIdx
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-500'
                  }`}>
                  {area.name || `Area ${i + 1}`}
                  {area.saved && <span className="ml-1 opacity-50 text-xs">✓</span>}
                </button>
              ))}
              <button onClick={addArea}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 border border-dashed border-gray-300 hover:border-gray-500 hover:text-gray-700 transition-colors">
                <Plus size={13} /> Add Area
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">

                {/* Area identity */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Area Details</CardTitle>
                      {areas.length > 1 && (
                        <button onClick={() => removeArea(activeAreaIdx)}
                          disabled={deletingIdx !== null}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                          <Trash2 size={12} />
                          {deletingIdx === activeAreaIdx ? 'Deleting...' : 'Remove area'}
                        </button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Area Name</label>
                      <input
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        value={activeArea.name}
                        placeholder="e.g. Block A, Pool Deck, Level 2"
                        onChange={e => setAreas(prev => prev.map((a, i) => i === activeAreaIdx ? { ...a, name: e.target.value, saved: false } : a))}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Dimensions */}
                <Card>
                  <CardHeader><CardTitle>Dimensions</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input id="length" label="Total Length *" type="number" unit="mm"
                      value={activeArea.survey.total_length ?? ''} placeholder="e.g. 6000"
                      onChange={e => { set('total_length', Number(e.target.value)); set('num_sections', undefined) }} />
                    <Input id="height" label="Total Height *" type="number" unit="mm"
                      value={activeArea.survey.total_height ?? ''} placeholder="e.g. 1000"
                      onChange={e => { set('total_height', Number(e.target.value)); set('num_sections', undefined) }} />
                  </CardContent>
                </Card>

                {/* Section optimizer — plain_sheet only */}
                {activeArea.survey.infill_type === 'plain_sheet' && estimation && estimation.section_options.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Section Layout</CardTitle>
                      <p className="text-xs text-gray-500 mt-1">
                        System calculated all options. Click a row to choose. Ranked by total cost.
                      </p>
                    </CardHeader>
                    <CardContent className="p-0">
                      <p className="text-[10px] text-gray-400 px-4 pt-2 md:hidden">Swipe table → to compare options</p>
                      <div className="overflow-x-auto scroll-hint-x">
                        <table className="w-full text-xs min-w-[640px]">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                              <th className="px-3 py-2 text-left">Sections</th>
                              <th className="px-3 py-2 text-right">Section W</th>
                              <th className="px-3 py-2 text-right">Cut size</th>
                              <th className="px-3 py-2 text-right">Sheet</th>
                              <th className="px-3 py-2 text-right">Sheets</th>
                              <th className="px-3 py-2 text-right">Waste</th>
                              <th className="px-3 py-2 text-right">Total cost</th>
                              <th className="px-3 py-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {estimation.section_options.map((opt, i) => {
                              const isChosen = opt.num_sections === chosenN
                              const isBest   = i === 0
                              return (
                                <tr key={opt.num_sections} onClick={() => pickSection(opt)}
                                  className={`cursor-pointer transition-colors ${
                                    isChosen ? 'bg-gray-900 text-white'
                                    : 'hover:bg-gray-50 text-gray-700'
                                  } ${!opt.structural ? 'opacity-50' : ''}`}>
                                  <td className="px-3 py-2.5 font-semibold">{opt.num_sections}</td>
                                  <td className="px-3 py-2.5 text-right">{opt.section_width_mm}mm</td>
                                  <td className="px-3 py-2.5 text-right">{opt.cut_width_mm}×{opt.cut_height_mm}mm</td>
                                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                    {opt.supplier_sheet.width_mm}×{opt.supplier_sheet.height_mm}
                                    {opt.panels_per_sheet > 1 && (
                                      <span className={`ml-1 ${isChosen ? 'text-gray-300' : 'text-blue-500'}`}>
                                        ×{opt.panels_per_sheet}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-right">{opt.total_sheets}</td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className={opt.waste_percent > 40 ? (isChosen ? 'text-red-300' : 'text-red-500') : ''}>
                                      {opt.waste_percent}%
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(opt.total_cost)}</td>
                                  <td className="px-3 py-2.5 text-right">
                                    {isBest && !isChosen && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">BEST</span>}
                                    {isChosen && <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-white text-gray-900">✓</span>}
                                    {!opt.structural && <span className="text-xs text-orange-500">⚠ wide</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      {estimation.section_options.some(o => !o.structural) && (
                        <p className="px-4 py-2 text-xs text-orange-600 border-t border-gray-100">
                          ⚠ Options marked &quot;wide&quot; exceed 2000mm between posts — check structural adequacy.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* For glass/flat bars — manual panel width / post spacing */}
                {activeArea.survey.infill_type !== 'plain_sheet' && (
                  <Card>
                    <CardHeader><CardTitle>Panel Layout</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input id="spacing"
                        label={isGlassOnly ? 'Panel Width *' : 'Post Spacing *'}
                        type="number" unit="mm"
                        value={activeArea.survey.post_spacing ?? 1000} placeholder="1000"
                        onChange={e => set('post_spacing', Number(e.target.value))} />
                      {activeArea.survey.infill_type === 'glass' && (() => {
                        const t = activeArea.survey.glass_thickness ?? 10
                        const maxSpan = t <= 8 ? 800 : t <= 10 ? 1100 : 1400
                        const span = activeArea.survey.post_spacing ?? 1000
                        if (isGlassOnly) return null
                        return span > maxSpan ? (
                          <p className="sm:col-span-2 text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                            ⚠ {span}mm post spacing exceeds the {maxSpan}mm structural limit for {t}mm toughened glass.
                          </p>
                        ) : (
                          <p className="sm:col-span-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                            ✓ {span}mm spacing is within the {maxSpan}mm limit for {t}mm glass.
                          </p>
                        )
                      })()}
                      {isGlassOnly && estimation && (
                        <p className="sm:col-span-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                          {estimation.num_sections} panels × {activeArea.survey.post_spacing ?? 1000}mm = {((estimation.num_sections * (activeArea.survey.post_spacing ?? 1000)) / 1000).toFixed(2)}m total glass
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Steel Profiles */}
                {!isGlassOnly && <Card>
                  <CardHeader><CardTitle>Steel Profiles</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select id="post_profile" label="Post *" options={PROFILE_OPTIONS}
                      value={activeArea.survey.post_profile ?? '40x40'}
                      onChange={e => { set('post_profile', e.target.value as SteelProfile); set('num_sections', undefined) }} />
                    <Select id="bottom_rail" label="Bottom Rail *" options={PROFILE_OPTIONS}
                      value={activeArea.survey.bottom_rail_profile ?? '40x20'}
                      onChange={e => { set('bottom_rail_profile', e.target.value as SteelProfile); set('num_sections', undefined) }} />
                    <Select id="top_rail" label="Top Rail *" options={PROFILE_OPTIONS}
                      value={activeArea.survey.top_rail_profile ?? '40x40'}
                      onChange={e => { set('top_rail_profile', e.target.value as SteelProfile); set('num_sections', undefined) }} />
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Inner Catch Frame</label>
                      <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        value={activeArea.survey.catch_profile ?? '20x20'}
                        onChange={e => set('catch_profile', e.target.value)}>
                        <option value="20x20">20×20 SHS (standard)</option>
                        <option value="25x25">25×25 SHS</option>
                        <option value="30x30">30×30 SHS</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>}

                {/* Infill */}
                <Card>
                  <CardHeader><CardTitle>Infill</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select id="infill_type" label="Infill Type *" options={INFILL_OPTIONS}
                      value={activeArea.survey.infill_type ?? 'plain_sheet'}
                      onChange={e => { set('infill_type', e.target.value as InfillType); set('num_sections', undefined) }} />
                    {activeArea.survey.infill_type === 'plain_sheet' && (<>
                      <Input id="sheet_thickness" label="Sheet Thickness" type="number" unit="mm"
                        value={activeArea.survey.sheet_thickness ?? 2} placeholder="2"
                        onChange={e => { set('sheet_thickness', Number(e.target.value)); set('num_sections', undefined) }} />
                      <div className="sm:col-span-2 flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-700">Panel Layout</label>
                        <div className="flex gap-2">
                          {([['full_height', 'Full Height'], ['inset', 'Inset Panel']] as const).map(([v, l]) => (
                            <button key={v} type="button"
                              onClick={() => { set('panel_layout', v as PanelLayout); set('num_sections', undefined) }}
                              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                (activeArea.survey.panel_layout ?? 'full_height') === v
                                  ? 'bg-gray-900 text-white border-gray-900'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                              }`}>
                              {l}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400">
                          {(activeArea.survey.panel_layout ?? 'full_height') === 'full_height'
                            ? 'Panel fills the full opening between rails.'
                            : 'Panel sits inset within the frame — open space above and/or below.'}
                        </p>
                      </div>
                      {(activeArea.survey.panel_layout ?? 'full_height') === 'inset' && (<>
                        <Input id="panel_height_mm" label="Panel Height *" type="number" unit="mm"
                          value={activeArea.survey.panel_height_mm ?? ''} placeholder="e.g. 500"
                          onChange={e => { set('panel_height_mm', Number(e.target.value)); set('num_sections', undefined) }} />
                        <Input id="panel_gap_top" label="Top Gap" type="number" unit="mm"
                          value={activeArea.survey.panel_gap_top_mm ?? 0} placeholder="0"
                          onChange={e => set('panel_gap_top_mm', Number(e.target.value))} />
                        {activeArea.survey.panel_height_mm != null && activeArea.survey.panel_height_mm > 0 && (() => {
                          const topRH = Number((activeArea.survey.top_rail_profile ?? '40x40').split('x')[1]) || 40
                          const botRH = Number((activeArea.survey.bottom_rail_profile ?? '40x20').split('x')[1]) || 20
                          const openH = (activeArea.survey.total_height ?? 0) - topRH - botRH
                          const panH  = activeArea.survey.panel_height_mm ?? 0
                          const gapT  = activeArea.survey.panel_gap_top_mm ?? 0
                          const gapB  = openH - panH - gapT
                          const ok    = gapB >= 0 && panH > 0 && panH < openH
                          return (
                            <div className={`sm:col-span-2 text-xs rounded-lg px-3 py-2 ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                              {ok
                                ? `✓ ${gapT}mm top gap + ${panH}mm panel + ${gapB}mm bottom gap = ${openH}mm opening`
                                : gapB < 0
                                  ? `⚠ Panel (${panH}mm) + top gap (${gapT}mm) exceeds opening height (${openH}mm)`
                                  : `⚠ Panel height must be less than opening height (${openH}mm)`}
                            </div>
                          )
                        })()}
                      </>)}
                    </>)}
                    {activeArea.survey.infill_type === 'glass' && (<>
                      <Select id="glass_system" label="Glass System *" options={GLASS_SYSTEM_OPTIONS}
                        value={activeArea.survey.glass_system_type ?? 'framed_post'}
                        onChange={e => set('glass_system_type', e.target.value as GlassSystemType)} />
                      <Input id="glass_thickness" label="Glass Thickness" type="number" unit="mm"
                        value={activeArea.survey.glass_thickness ?? 10} placeholder="10"
                        onChange={e => set('glass_thickness', Number(e.target.value))} />
                    </>)}
                    {activeArea.survey.infill_type === 'flat_bars' && (<>
                      <Select id="bar_profile" label="Bar Profile" options={PROFILE_OPTIONS}
                        value={activeArea.survey.bar_profile ?? '40x20'}
                        onChange={e => set('bar_profile', e.target.value as SteelProfile)} />
                      <Input id="bar_spacing" label="Bar Spacing" type="number" unit="mm"
                        value={activeArea.survey.bar_spacing ?? 100} placeholder="100"
                        onChange={e => set('bar_spacing', Number(e.target.value))} />
                    </>)}
                  </CardContent>
                </Card>

                {/* Mounting & Site */}
                <Card>
                  <CardHeader><CardTitle>Mounting &amp; Site</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select id="mounting" label="Mounting Type *" options={MOUNTING_OPTIONS}
                      value={activeArea.survey.mounting_type ?? 'wall'}
                      onChange={e => set('mounting_type', e.target.value as MountingType)} />
                    {activeArea.survey.mounting_type === 'wall' && (
                      <Select id="wall_type" label="Wall Type" options={WALL_OPTIONS}
                        value={activeArea.survey.wall_type ?? 'concrete'}
                        onChange={e => set('wall_type', e.target.value as 'concrete' | 'brick' | 'block' | 'other')} />
                    )}
                    <Select id="access" label="Access Difficulty" options={ACCESS_OPTIONS}
                      value={activeArea.survey.access_difficulty ?? 'easy'}
                      onChange={e => set('access_difficulty', e.target.value as 'easy' | 'medium' | 'hard')} />
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Site Notes</label>
                      <textarea rows={2} placeholder="Obstacles, access notes..."
                        value={activeArea.survey.site_notes ?? ''}
                        onChange={e => set('site_notes', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ── Live Sidebar ─────────────────────────────────────────────── */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {activeArea.name}
                      <span className="text-xs font-normal text-gray-400 ml-2">Live Summary</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-sm">
                    {estimationError ? (
                      <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{estimationError}</p>
                    ) : estimation ? (
                      isGlassOnly ? (
                        <>
                          <div className="bg-gray-900 text-white rounded-lg p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Glass System</p>
                            <Row2 label="System" value={GLASS_SYSTEM_LABELS[activeArea.survey.glass_system_type!]} inv />
                            <Row2 label="Panels" value={`${estimation.num_sections} pcs`} inv />
                            <Row2 label="Panel width" value={`${estimation.section_width_mm}mm`} inv />
                            <Row2 label="Glass area" value={`${estimation.infill_area_m2}m²`} inv />
                            <Row2 label="Labor" value={`${estimation.labor_days} day(s)`} inv />
                          </div>
                          <hr className="border-gray-100" />
                          <Row2 label="Glass panels" value={formatCurrency(estimation.infill_cost)} bold />
                          <Row2 label="Hardware" value={formatCurrency(estimation.glass_hardware_cost)} bold />
                          <Row2 label="Labor" value={formatCurrency(estimation.labor_cost)} bold />
                          <div className="pt-2 border-t border-gray-200">
                            <Row2 label="Subtotal" value={formatCurrency(estimation.subtotal)} bold />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-gray-900 text-white rounded-lg p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Chosen Layout</p>
                            <Row2 label="Sections" value={`${estimation.num_sections}`} inv />
                            <Row2 label="Posts" value={`${estimation.post_count} pcs`} inv />
                            <Row2 label="Section width" value={`${estimation.section_width_mm}mm`} inv />
                            <Row2
                              label={activeArea.survey.panel_layout === 'inset' ? 'Panel cut size' : 'Frame opening'}
                              value={`${estimation.opening_width_mm}×${estimation.opening_height_mm}mm`} inv />
                            {activeArea.survey.panel_layout === 'inset' && activeArea.survey.panel_height_mm && (() => {
                              const topRH = Number((activeArea.survey.top_rail_profile ?? '40x40').split('x')[1]) || 40
                              const botRH = Number((activeArea.survey.bottom_rail_profile ?? '40x20').split('x')[1]) || 20
                              const openH = (activeArea.survey.total_height ?? 0) - topRH - botRH
                              const gapT  = activeArea.survey.panel_gap_top_mm ?? 0
                              const gapB  = openH - (activeArea.survey.panel_height_mm ?? 0) - gapT
                              return (<>
                                <Row2 label="Top gap" value={`${gapT}mm`} inv />
                                <Row2 label="Bottom gap" value={`${gapB}mm`} inv />
                              </>)
                            })()}
                            <Row2 label="CNC cut size" value={`${estimation.cut_width_mm}×${estimation.cut_height_mm}mm`} inv />
                            {estimation.panels_per_sheet > 1 && (
                              <Row2 label="Nesting" value={`${estimation.panels_per_sheet} panels/sheet`} inv />
                            )}
                            <Row2 label="Sheets needed" value={`${estimation.chosen_section.total_sheets} sheets`} inv />
                            <Row2 label="Waste" value={`${estimation.chosen_section.waste_percent}%`} inv />
                          </div>
                          <hr className="border-gray-100" />
                          <Row2 label="Rails (top+bot)" value={`${(estimation.top_rail_length_m + estimation.bottom_rail_length_m).toFixed(2)}m`} />
                          <Row2 label="Catch frame" value={`${estimation.catch_total_length_m}m`} />
                          <Row2 label="Infill area" value={`${estimation.infill_area_m2}m²`} />
                          <Row2 label="Labor" value={`${estimation.labor_days} day(s)`} />
                          <hr className="border-gray-100" />
                          <Row2 label="Frame + catch" value={formatCurrency(estimation.frame_cost)} bold />
                          <Row2 label="Sheets" value={formatCurrency(estimation.infill_cost)} bold />
                          <Row2 label="CNC cutting" value={formatCurrency(estimation.cutting_cost)} bold />
                          <Row2 label="Labor (est.)" value={formatCurrency(estimation.labor_cost)} />
                          <div className="pt-2 border-t border-gray-200">
                            <Row2 label="Materials subtotal" value={formatCurrency(estimation.subtotal - estimation.labor_cost)} bold />
                          </div>
                        </>
                      )
                    ) : (
                      <p className="text-gray-400 text-xs">Fill in dimensions to see live calculations.</p>
                    )}
                  </CardContent>
                </Card>

                {/* All-areas total chip (when multiple areas) */}
                {areas.length > 1 && totalSubtotal > 0 && (
                  <Card>
                    <CardContent className="py-3 space-y-1.5 text-sm">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">All Areas (materials + labor)</p>
                      {areaCalcs.map((c, i) => c.estimation && (
                        <Row2 key={areas[i].tempId} label={areas[i].name}
                          value={formatCurrency((c.estimation.subtotal - c.estimation.labor_cost) + c.cncCuttingCost)} />
                      ))}
                      <div className="pt-2 border-t border-gray-200">
                        <Row2 label="Materials total" value={formatCurrency(totalSubtotal - totalLaborCost + totalCncCost)} bold />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!isDemo && (
                  <Button className="w-full" onClick={handleSaveArea} disabled={saving || !activeCalc.isComplete}>
                    <Save size={14} /> {saving ? 'Saving...' : activeArea.saved ? '✓ Saved' : `Save ${activeArea.name}`}
                  </Button>
                )}
                <Button className="w-full" onClick={downloadGrasshopperFile} disabled={!activeCalc.isComplete}>
                  <Download size={14} /> Export to Rhino (.json)
                </Button>
                <Button className="w-full" variant="secondary" onClick={() => setActiveTab('estimation')} disabled={!anyAreaComplete}>
                  Go to Estimation →
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── ESTIMATION TAB ─────────────────────────────────────────────── */}
        {activeTab === 'estimation' && (
          <div className="space-y-6">
            {anyAreaComplete ? (
              <>
                {/* Area tabs for BOM */}
                {areas.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {areas.map((area, i) => (
                      areaCalcs[i].estimation && (
                        <button key={area.tempId} onClick={() => setActiveAreaIdx(i)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            i === activeAreaIdx
                              ? 'bg-gray-900 text-white'
                              : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-500'
                          }`}>
                          {area.name}
                        </button>
                      )
                    ))}
                  </div>
                )}

                {/* BOM for active area */}
                {estimation && (
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Material &amp; Labor — {activeArea.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="md:hidden divide-y divide-gray-100">
                        {estimation.line_items.map((item, i) => (
                          <div key={i} className="px-4 py-3">
                            <div className="flex justify-between gap-2">
                              <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                              <p className="font-semibold text-gray-900 text-sm shrink-0">{formatCurrency(item.total)}</p>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {item.qty} {item.unit} × {formatCurrency(item.unit_price)}
                            </p>
                          </div>
                        ))}
                        <div className="px-4 py-3 bg-gray-50 flex justify-between font-semibold text-sm">
                          <span>{activeArea.name} Subtotal</span>
                          <span>{formatCurrency(estimation.subtotal)}</span>
                        </div>
                      </div>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-6 py-2.5 text-left font-medium text-gray-600">Item</th>
                              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Qty</th>
                              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Unit</th>
                              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Unit Price</th>
                              <th className="px-6 py-2.5 text-right font-medium text-gray-600">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {estimation.line_items.map((item, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-6 py-3">
                                  <p className="font-medium text-gray-900">{item.label}</p>
                                  <p className="text-xs text-gray-400">{item.sub}</p>
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">{item.qty}</td>
                                <td className="px-4 py-3 text-right text-gray-500">{item.unit}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                                <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t border-gray-200">
                              <td colSpan={4} className="px-6 py-3 text-sm font-semibold text-gray-700">
                                {activeArea.name} Subtotal
                              </td>
                              <td className="px-6 py-3 text-right font-bold text-gray-900">{formatCurrency(estimation.subtotal)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={handleDownloadBOM} disabled={!anyAreaComplete}>
                    <Download size={14} /> Download BOM {areas.length > 1 ? '(All Areas)' : ''}
                  </Button>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Variable Costs</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">These costs vary per job — adjust before quoting.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Per-area CNC costs */}
                    {areas.some((a, i) => areaCalcs[i].estimation && !areaCalcs[i].isGlassOnly && a.survey.infill_type === 'plain_sheet') && (
                      <div className={`${areas.length > 1 ? 'border border-gray-100 rounded-lg p-4' : ''}`}>
                        {areas.length > 1 && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">CNC Rate per Area</p>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {areas.map((area, i) => {
                            const c = areaCalcs[i]
                            if (!c.estimation || c.isGlassOnly || area.survey.infill_type !== 'plain_sheet') return null
                            return (
                              <div key={area.tempId} className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-700">
                                  {areas.length > 1 ? `${area.name} — CNC` : 'CNC / Laser Cutting'}
                                  <span className="text-xs text-gray-400 ml-1">— {c.estimation.total_sheets} sheet(s) = {formatCurrency(c.cncCuttingCost)}</span>
                                </label>
                                <div className="flex gap-2 items-center">
                                  <input type="number" min={0} value={area.cncRatePerSheet}
                                    onChange={e => setAreas(prev => prev.map((a, j) => j === i ? { ...a, cncRatePerSheet: Number(e.target.value), saved: false } : a))}
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                                  <span className="text-sm text-gray-500 whitespace-nowrap">RWF / sheet</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Project-level costs */}
                    <div className={`${areas.length > 1 ? 'border border-gray-100 rounded-lg p-4' : ''}`}>
                      {areas.length > 1 && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Project-Level</p>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {!areaCalcs.every(c => c.isGlassOnly) && (
                          <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">
                              Welding Consumables
                              <span className="text-xs text-gray-400 ml-1">= {formatCurrency(consumablesCost)}</span>
                            </label>
                            <div className="flex gap-2 items-center">
                              <input type="number" min={0} max={30} step={0.5} value={consumablesPercent}
                                onChange={e => setConsumablesPercent(Number(e.target.value))}
                                className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                              <span className="text-sm text-gray-500">% of frame cost</span>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-gray-700">Surface Treatment</label>
                          <select value={surfaceTreatmentType}
                            onChange={e => {
                              const t = e.target.value as 'none' | 'powder_coat' | 'paint'
                              setSurfaceTreatmentType(t)
                              if (t === 'powder_coat') setSurfaceTreatmentRate(8000)
                              if (t === 'paint') setSurfaceTreatmentRate(5000)
                            }}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                            <option value="none">None</option>
                            <option value="powder_coat">Powder Coat</option>
                            <option value="paint">Paint / Primer</option>
                          </select>
                          {surfaceTreatmentType !== 'none' && (
                            <div className="flex gap-2 items-center mt-1">
                              <input type="number" min={0} value={surfaceTreatmentRate}
                                onChange={e => setSurfaceTreatmentRate(Number(e.target.value))}
                                className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                              <span className="text-xs text-gray-500">
                                RWF/m² → {formatCurrency(surfaceTreatmentCost)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-gray-700">
                            Fabrication Labor
                            {totalLaborDays > 0 && (
                              <span className="text-xs text-gray-400 ml-1">
                                — {totalLaborDays} day(s) est. = {formatCurrency(totalLaborCost)}
                              </span>
                            )}
                          </label>
                          <input type="number" min={0} value={fabricationCost || ''}
                            placeholder={String(totalLaborCost || 0)}
                            onChange={e => setFabricationCost(Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <p className="text-xs text-gray-400">One crew covers all areas — enter total fabrication cost</p>
                        </div>
                        <Input id="install_cost" label="Installation (all areas)" type="number" unit="RWF"
                          value={installationCost || ''} placeholder="0"
                          onChange={e => setInstallationCost(Number(e.target.value))} />
                        <Input id="transport" label="Transport & Delivery" type="number" unit="RWF"
                          value={transportCost || ''} placeholder="0"
                          onChange={e => setTransportCost(Number(e.target.value))} />
                        <Input id="hardware" label="Hardware & Fixings" type="number" unit="RWF"
                          value={hardwareCost || ''} placeholder="0"
                          onChange={e => setHardwareCost(Number(e.target.value))} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pricing</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">Set your margin before generating the quotation.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">Contingency</label>
                        <div className="flex gap-2 items-center">
                          <input type="number" min={0} max={50} value={contingencyPercent}
                            onChange={e => setContingencyPercent(Number(e.target.value))}
                            className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <span className="text-sm text-gray-500">% risk buffer</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">Business Margin</label>
                        <div className="flex gap-2 items-center">
                          <input type="number" min={0} max={100} value={marginPercent}
                            onChange={e => setMarginPercent(Number(e.target.value))}
                            className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          <span className="text-sm text-gray-500">% overhead + profit</span>
                        </div>
                      </div>
                    </div>

                    {/* All-areas cost summary */}
                    {areas.length > 1 && (
                      <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                        <p className="font-semibold text-gray-500 uppercase tracking-wide mb-2">Area Subtotals</p>
                        {areaCalcs.map((c, i) => c.estimation && (
                          <div key={areas[i].tempId} className="flex justify-between text-gray-600">
                            <span>{areas[i].name}</span>
                            <span>{formatCurrency((c.estimation.subtotal - c.estimation.labor_cost) + c.cncCuttingCost)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-gray-700 font-semibold border-t border-gray-200 pt-1 mt-1">
                          <span>Materials total</span>
                          <span>{formatCurrency(totalSubtotal - totalLaborCost + totalCncCost)}</span>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Your direct cost</span>
                        <span className="font-medium">{formatCurrency(directTotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400 text-xs">
                        <span className="pl-3">+ Contingency ({contingencyPercent}%)</span>
                        <span>+{formatCurrency(contingencyCost)}</span>
                      </div>
                      <div className="flex justify-between text-gray-700 font-medium border-t border-gray-200 pt-2">
                        <span>Adjusted cost</span>
                        <span>{formatCurrency(adjustedCost)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400 text-xs">
                        <span className="pl-3">+ Business margin ({marginPercent}%)</span>
                        <span>+{formatCurrency(marginCost)}</span>
                      </div>
                      <div className="flex justify-between border-t-2 border-gray-900 pt-2 mt-1">
                        <span className="text-base font-bold text-gray-900">QUOTED PRICE</span>
                        <span className="text-2xl font-bold text-gray-900">{formatCurrency(quotedPrice)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {!isDemo && (
                        <Button className="flex-1 min-h-11 sm:min-h-0" onClick={handleSaveArea} disabled={saving}>
                          <Save size={14} /> {saving ? 'Saving...' : 'Save Estimation'}
                        </Button>
                      )}
                      <Button className="flex-1 min-h-11 sm:min-h-0" variant="secondary" onClick={() => setActiveTab('quotation')}>
                        Generate Quotation →
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-gray-400">
                  Complete the site survey first.
                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => setActiveTab('survey')}>← Go to Survey</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── QUOTATION TAB ──────────────────────────────────────────────── */}
        {activeTab === 'quotation' && anyAreaComplete && (
          <QuotationTab
            project={projectMeta}
            projectType={(projectMeta.type as ProjectType) ?? 'balcony'}
            areas={areas.map((area, i) => ({
              name:           area.name,
              survey:         area.survey,
              estimation:     areaCalcs[i].estimation,
              cncCuttingCost: areaCalcs[i].cncCuttingCost,
            }))}
            pricing={{
              consumablesCost, consumablesPercent,
              surfaceTreatmentCost, surfaceTreatmentType, surfaceTreatmentRate,
              transportCost, hardwareCost,
              designCuttingCost: totalCncCost,
              installationCost,
              directTotal, contingencyPercent, contingencyCost,
              adjustedCost, marginPercent, marginCost, quotedPrice,
            }}
            estimationId={firstSavedEstimationId}
            existingQuotation={existingQuotation}
            isDemo={isDemo}
          />
        )}
      </main>
    </div>
  )
}

function Row2({ label, value, bold, inv }: { label: string; value: string; bold?: boolean; inv?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={inv ? 'text-gray-400' : 'text-gray-500'}>{label}</span>
      <span className={inv ? 'text-white font-medium' : bold ? 'font-semibold text-gray-900' : 'text-gray-700'}>{value}</span>
    </div>
  )
}
