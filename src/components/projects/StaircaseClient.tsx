'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Save, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS, STATUS_LABELS } from '@/types'
import type { StaircaseSurvey, ProjectStatus, SteelProfile, InfillType, GlassSystemType } from '@/types'
import type { StaircaseSectionOption } from '@/lib/staircase-estimation'
import { DEFAULT_RESOLVED_PRICES } from '@/lib/default-prices'
import { calculateStaircaseEstimation, generateStaircaseGrasshopperParams } from '@/lib/staircase-estimation'
import { formatCurrency } from '@/lib/utils'
import { saveStaircaseSurveyAndEstimation } from '@/app/actions/staircase'
import { updateProjectStatus } from '@/app/actions/projects'
import { QuotationTab } from './QuotationTab'
import { FeedbackBanner } from '@/components/ui/feedback-banner'

const PROFILE_OPTIONS = [
  { value: '20x20', label: '20×20 SHS' },
  { value: '40x20', label: '40×20 RHS' },
  { value: '40x40', label: '40×40 SHS' },
  { value: '60x40', label: '60×40 RHS' },
]
const INFILL_OPTIONS = [
  { value: 'plain_sheet', label: 'Laser-Cut Sheet' },
  { value: 'glass', label: 'Glass Panels' },
  { value: 'flat_bars', label: 'Flat Bars' },
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
const ACCESS_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Difficult' },
]
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

const DEFAULT_SURVEY: Partial<StaircaseSurvey> = {
  total_rise: 2800,
  total_run: 3500,
  width: 1200,
  num_flights: 1,
  handrail_height: 1000,
  post_spacing: 1200,
  rail_sides: 'one',
  post_profile: '40x40',
  top_rail_profile: '40x40',
  bottom_rail_profile: '40x20',
  catch_profile: '20x20',
  infill_type: 'plain_sheet',
  sheet_thickness: 2,
  access_difficulty: 'easy',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StaircaseClient({ project }: { project: any }) {
  const isDemo = !project
  const projectMeta = project ?? {
    id: 'demo', project_code: 'STA-DEMO', status: 'site_survey',
    title: 'Demo Staircase', location: 'Kigali, Rwanda',
    client: { name: 'Demo Client' },
    staircase_surveys: [], estimations: [], quotations: [],
  }

  const existingSurvey     = projectMeta.staircase_surveys?.[0]
  const existingEstimation = projectMeta.estimations?.[0]
  const existingQuotation  = projectMeta.quotations?.[0]

  const [survey, setSurvey]               = useState<Partial<StaircaseSurvey>>(existingSurvey ?? DEFAULT_SURVEY)
  const [cncRatePerSheet, setCncRate]     = useState<number>(
    DEFAULT_RESOLVED_PRICES.cutting[(existingSurvey?.sheet_thickness ?? 2) as keyof typeof DEFAULT_RESOLVED_PRICES.cutting]?.price ?? 60000
  )
  const [installationCost, setIC]         = useState<number>(existingEstimation?.installation_cost ?? 0)
  const [consumablesPercent, setConsumablesPercent] = useState(existingEstimation?.consumables_percent ?? 7)
  const [surfaceTreatmentType, setSurfaceTreatmentType] = useState<'none' | 'powder_coat' | 'paint'>(
    (existingEstimation?.surface_treatment_type as 'none' | 'powder_coat' | 'paint') ?? 'none'
  )
  const [surfaceTreatmentRate, setSurfaceTreatmentRate] = useState(existingEstimation?.surface_treatment_rate ?? 8000)
  const [transportCost, setTransportCost] = useState(existingEstimation?.transport_cost ?? 0)
  const [hardwareCost, setHardwareCost] = useState(existingEstimation?.hardware_cost ?? 0)
  const [contingencyPercent, setContingencyPercent] = useState(existingEstimation?.contingency_percent ?? 10)
  const [marginPercent, setMarginPercent] = useState(existingEstimation?.margin_percent ?? 30)
  const [activeTab, setActiveTab]         = useState<'survey' | 'estimation' | 'quotation'>('survey')
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(!!existingSurvey)
  const [currentStatus, setCurrentStatus] = useState<ProjectStatus>(projectMeta.status as ProjectStatus)
  const [statusChanging, setStatusChanging] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; variant: 'error' | 'success' } | null>(null)

  const currentIdx = STATUS_FLOW.indexOf(currentStatus)
  const nextStatus = STATUS_FLOW[currentIdx + 1] as ProjectStatus | undefined

  function set(field: keyof StaircaseSurvey, value: unknown) {
    setSurvey(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  function pickSection(opt: StaircaseSectionOption) {
    setSurvey(prev => ({
      ...prev,
      num_sections: opt.num_sections,
      sheet_width_mm:  opt.supplier_sheet.width_mm,
      sheet_height_mm: opt.supplier_sheet.height_mm,
    }))
    setSaved(false)
  }

  const isGlassOnly = survey.infill_type === 'glass' &&
    !!survey.glass_system_type && survey.glass_system_type !== 'framed_post'

  const isComplete = isGlassOnly
    ? !!(survey.total_rise && survey.total_run && survey.width && survey.handrail_height &&
         survey.glass_thickness && survey.post_spacing && survey.rail_sides)
    : !!(survey.total_rise && survey.total_run && survey.width &&
         survey.handrail_height &&
         survey.post_profile && survey.top_rail_profile && survey.bottom_rail_profile &&
         survey.infill_type && survey.rail_sides &&
         (survey.infill_type !== 'plain_sheet' ? survey.post_spacing : true))

  const estimation = isComplete
    ? calculateStaircaseEstimation(survey as StaircaseSurvey, DEFAULT_RESOLVED_PRICES)
    : null

  const cncCuttingCost = estimation && survey.infill_type === 'plain_sheet'
    ? (estimation.total_sheets ?? 0) * cncRatePerSheet : 0
  const consumablesCost = estimation ? Math.round(estimation.frame_cost * consumablesPercent / 100) : 0
  const surfaceTreatmentCost = estimation && surfaceTreatmentType !== 'none'
    ? Math.round(estimation.infill_area_m2 * surfaceTreatmentRate) : 0
  const directTotal = estimation
    ? estimation.subtotal + cncCuttingCost + consumablesCost + surfaceTreatmentCost + transportCost + hardwareCost + installationCost
    : 0
  const contingencyCost = Math.round(directTotal * contingencyPercent / 100)
  const adjustedCost = directTotal + contingencyCost
  const marginCost = Math.round(adjustedCost * marginPercent / 100)
  const quotedPrice = adjustedCost + marginCost
  const grandTotal = quotedPrice

  const chosenN = estimation?.num_sections ?? survey.num_sections

  async function handleSave() {
    if (!isComplete || isDemo) return
    setSaving(true)
    setFeedback(null)
    try {
      await saveStaircaseSurveyAndEstimation(
        projectMeta.id,
        survey as Omit<StaircaseSurvey, 'id' | 'project_id' | 'created_at'>,
        cncCuttingCost,
        installationCost,
        { consumablesPercent, surfaceTreatmentType, surfaceTreatmentRate, transportCost, hardwareCost, contingencyPercent, marginPercent, quotedPrice }
      )
      setSaved(true)
      setFeedback({ text: 'Survey and estimation saved.', variant: 'success' })
    } catch (e) {
      console.error(e)
      setFeedback({ text: 'Failed to save. Check your connection and try again.', variant: 'error' })
    } finally { setSaving(false) }
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

  async function handleDownloadBOM() {
    if (!estimation) return
    setFeedback(null)
    try {
      const payload = {
        project_code: projectMeta.project_code,
        project_title: projectMeta.title,
        project_location: projectMeta.location,
        project_type: 'Staircase Railing',
        client_name: projectMeta.client?.name,
        line_items: estimation.line_items,
        subtotal: estimation.subtotal,
      }
      const res = await fetch('/api/bom-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
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

  function downloadGrasshopperFile() {
    if (!isComplete || !estimation) return
    const params = generateStaircaseGrasshopperParams(survey as StaircaseSurvey, estimation, projectMeta.project_code)
    const blob = new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectMeta.project_code}_grasshopper.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-0 flex flex-col">
      <header className="bg-surface border-b border-border px-4 sm:px-6 py-3 sm:py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 sm:gap-4 min-w-0">
            <Link href="/dashboard" className="shrink-0 mt-0.5">
              <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-foreground">{projectMeta.project_code}</h1>
                <Badge className={STATUS_COLORS[currentStatus]}>{STATUS_LABELS[currentStatus]}</Badge>
                {isDemo && <Badge className="bg-amber-100 text-amber-700">Demo</Badge>}
                {!isDemo && nextStatus && (
                  <button
                    onClick={() => handleStatusChange(nextStatus)}
                    disabled={statusChanging}
                    className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <ChevronRight size={13} />
                    <span className="hidden sm:inline">{statusChanging ? 'Updating...' : NEXT_LABEL[currentStatus]}</span>
                    <span className="sm:hidden">{statusChanging ? '…' : 'Next'}</span>
                  </button>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted truncate">{projectMeta.title} — {projectMeta.client?.name}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {!isDemo && (
              <Button variant="secondary" size="sm" className="w-full sm:w-auto justify-center min-h-11 sm:min-h-0" onClick={handleSave} disabled={saving || !isComplete}>
                <Save size={14} /> {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
              </Button>
            )}
            <Button variant="secondary" size="sm" className="w-full sm:w-auto justify-center min-h-11 sm:min-h-0" onClick={downloadGrasshopperFile} disabled={!isComplete}>
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
        <div className="bg-surface border-b border-border px-4 sm:px-6 py-2 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex items-center gap-1 min-w-max">
            {STATUS_FLOW.map((s, i) => {
              const isDone    = STATUS_FLOW.indexOf(currentStatus) > i
              const isCurrent = s === currentStatus
              return (
                <div key={s} className="flex items-center gap-1">
                  <button
                    onClick={() => handleStatusChange(s)}
                    disabled={statusChanging || s === currentStatus}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:cursor-default ${
                      isCurrent ? STATUS_COLORS[s] + ' ring-1 ring-current'
                        : isDone ? 'bg-surface-muted text-muted hover:bg-surface-hover'
                        : 'bg-surface-muted text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                  {i < STATUS_FLOW.length - 1 && <ChevronRight size={12} className="text-muted flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 sm:px-6 sm:shadow-none">
        <div className="max-w-7xl mx-auto flex">
          {(['survey', 'estimation', 'quotation'] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-2 sm:px-6 py-3.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-12 sm:min-h-0 ${
                activeTab === tab ? 'border-foreground text-foreground' : 'border-transparent text-muted hover:text-foreground'
              }`}>
              <span className="sm:hidden">{tab === 'survey' ? 'Survey' : tab === 'estimation' ? 'Estimate' : 'Quote'}</span>
              <span className="hidden sm:inline">{tab === 'survey' ? 'Site Survey' : tab === 'estimation' ? 'Estimation' : 'Quotation'}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">

        {/* SURVEY TAB */}
        {activeTab === 'survey' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">

              <Card>
                <CardHeader><CardTitle>Staircase Dimensions</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input id="rise" label="Total Rise *" type="number" unit="mm"
                    value={survey.total_rise ?? ''} placeholder="e.g. 2800"
                    onChange={e => { set('total_rise', Number(e.target.value)); set('num_sections', undefined) }} />
                  <Input id="run" label="Total Run *" type="number" unit="mm"
                    value={survey.total_run ?? ''} placeholder="e.g. 3500"
                    onChange={e => { set('total_run', Number(e.target.value)); set('num_sections', undefined) }} />
                  <Input id="width" label="Width *" type="number" unit="mm"
                    value={survey.width ?? ''} placeholder="e.g. 1200"
                    onChange={e => set('width', Number(e.target.value))} />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-foreground">Number of Flights</label>
                    <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      value={survey.num_flights ?? 1}
                      onChange={e => set('num_flights', Number(e.target.value))}>
                      <option value={1}>1 — Straight</option>
                      <option value={2}>2 — With Landing</option>
                    </select>
                  </div>
                  {survey.num_flights === 2 && (
                    <Input id="landing" label="Landing Length" type="number" unit="mm"
                      value={survey.landing_length ?? ''} placeholder="e.g. 1200"
                      onChange={e => set('landing_length', Number(e.target.value))} />
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-foreground">Rail Sides *</label>
                    <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      value={survey.rail_sides ?? 'one'}
                      onChange={e => { set('rail_sides', e.target.value as 'one' | 'both'); set('num_sections', undefined) }}>
                      <option value="one">One side only</option>
                      <option value="both">Both sides</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Handrail</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input id="h_height" label="Handrail Height *" type="number" unit="mm"
                    value={survey.handrail_height ?? 1000} placeholder="1000"
                    onChange={e => { set('handrail_height', Number(e.target.value)); set('num_sections', undefined) }} />
                  {/* Post spacing / panel width for glass/flat_bars */}
                  {survey.infill_type !== 'plain_sheet' && (
                    <Input id="spacing"
                      label={isGlassOnly ? 'Panel Width *' : 'Post Spacing *'}
                      type="number" unit="mm"
                      value={survey.post_spacing ?? 1000} placeholder="1000"
                      onChange={e => set('post_spacing', Number(e.target.value))} />
                  )}
                  {survey.infill_type === 'glass' && !isGlassOnly && (() => {
                    const t = survey.glass_thickness ?? 10
                    const maxSpan = t <= 8 ? 800 : t <= 10 ? 1100 : 1400
                    const span = survey.post_spacing ?? 1000
                    return span > maxSpan ? (
                      <p className="col-span-2 text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                        ⚠ {span}mm post spacing exceeds the {maxSpan}mm structural limit for {t}mm toughened glass — risk of panel deflection or breakage.
                      </p>
                    ) : (
                      <p className="col-span-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                        ✓ {span}mm spacing is within the {maxSpan}mm limit for {t}mm glass.
                      </p>
                    )
                  })()}
                </CardContent>
              </Card>

              {/* Section optimizer — plain_sheet only */}
              {survey.infill_type === 'plain_sheet' && estimation && estimation.section_options.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Section Layout</CardTitle>
                    <p className="text-xs text-muted mt-1">
                      System calculated all options along the stringer. Click a row to choose. Ranked by total cost.
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-[10px] text-muted px-4 pt-2 md:hidden">Swipe table → to compare options</p>
                    <div className="overflow-x-auto scroll-hint-x">
                      <table className="w-full text-xs min-w-[720px]">
                        <thead>
                          <tr className="bg-surface-muted border-b border-border text-muted">
                            <th className="px-3 py-2 text-left">Sections</th>
                            <th className="px-3 py-2 text-right">Spacing</th>
                            <th className="px-3 py-2 text-right">Cut size</th>
                            <th className="px-3 py-2 text-right">Bounding</th>
                            <th className="px-3 py-2 text-right">Sheet</th>
                            <th className="px-3 py-2 text-right">Sheets</th>
                            <th className="px-3 py-2 text-right">Waste</th>
                            <th className="px-3 py-2 text-right">Total cost</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {estimation.section_options.map((opt, i) => {
                            const isChosen = opt.num_sections === chosenN
                            const isBest   = i === 0
                            return (
                              <tr key={opt.num_sections}
                                onClick={() => pickSection(opt)}
                                className={`cursor-pointer transition-colors ${
                                  isChosen ? 'bg-gray-900 text-white'
                                  : 'hover:bg-surface-muted text-foreground'
                                } ${!opt.structural ? 'opacity-50' : ''}`}>
                                <td className="px-3 py-2.5 font-semibold">{opt.num_sections}</td>
                                <td className="px-3 py-2.5 text-right">{opt.section_slope_mm}mm</td>
                                <td className="px-3 py-2.5 text-right">{opt.cut_slope_edge_mm}×{opt.cut_height_mm}mm</td>
                                <td className="px-3 py-2.5 text-right">{opt.cut_bounding_W_mm}×{opt.cut_bounding_H_mm}mm</td>
                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                  {opt.supplier_sheet.width_mm}×{opt.supplier_sheet.height_mm}
                                  {opt.panels_per_sheet > 1 && (
                                    <span className={`ml-1 ${isChosen ? 'text-muted' : 'text-blue-500'}`}>
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
                                <td className="px-3 py-2.5 text-right font-medium">
                                  {formatCurrency(opt.total_cost)}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  {isBest && !isChosen && (
                                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">BEST</span>
                                  )}
                                  {isChosen && (
                                    <span className="text-xs bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100 px-1.5 py-0.5 rounded font-medium">✓</span>
                                  )}
                                  {!opt.structural && (
                                    <span className="text-xs text-orange-500 ml-1">⚠</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {estimation.section_options.some(o => !o.structural) && (
                      <p className="px-4 py-2 text-xs text-orange-600 border-t border-border">
                        ⚠ Options marked wide exceed 2000mm horizontal span between posts — check structural adequacy.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {!isGlassOnly && <Card>
                <CardHeader><CardTitle>Steel Profiles</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select id="post" label="Post Profile *" options={PROFILE_OPTIONS}
                    value={survey.post_profile ?? '40x40'}
                    onChange={e => { set('post_profile', e.target.value as SteelProfile); set('num_sections', undefined) }} />
                  <Select id="top_rail" label="Top Rail *" options={PROFILE_OPTIONS}
                    value={survey.top_rail_profile ?? '40x40'}
                    onChange={e => { set('top_rail_profile', e.target.value as SteelProfile); set('num_sections', undefined) }} />
                  <Select id="bottom_rail" label="Bottom Rail *" options={PROFILE_OPTIONS}
                    value={survey.bottom_rail_profile ?? '40x20'}
                    onChange={e => { set('bottom_rail_profile', e.target.value as SteelProfile); set('num_sections', undefined) }} />
                  {survey.infill_type === 'plain_sheet' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-foreground">Inner Catch Frame</label>
                      <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        value={survey.catch_profile ?? '20x20'}
                        onChange={e => { set('catch_profile', e.target.value); set('num_sections', undefined) }}>
                        <option value="20x20">20×20 SHS (standard)</option>
                        <option value="25x25">25×25 SHS</option>
                        <option value="30x30">30×30 SHS</option>
                      </select>
                    </div>
                  )}
                </CardContent>
              </Card>}

              <Card>
                <CardHeader><CardTitle>Infill Panels</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select id="infill" label="Infill Type *" options={INFILL_OPTIONS}
                    value={survey.infill_type ?? 'plain_sheet'}
                    onChange={e => { set('infill_type', e.target.value as InfillType); set('num_sections', undefined) }} />
                  {survey.infill_type === 'plain_sheet' && (
                    <Input id="thickness" label="Sheet Thickness" type="number" unit="mm"
                      value={survey.sheet_thickness ?? 2}
                      onChange={e => { set('sheet_thickness', Number(e.target.value)); set('num_sections', undefined) }} />
                  )}
                  {survey.infill_type === 'glass' && (
                    <>
                      <Select id="glass_system" label="Glass System *" options={GLASS_SYSTEM_OPTIONS}
                        value={survey.glass_system_type ?? 'framed_post'}
                        onChange={e => set('glass_system_type', e.target.value as GlassSystemType)} />
                      <Input id="glass" label="Glass Thickness" type="number" unit="mm"
                        value={survey.glass_thickness ?? 10}
                        onChange={e => set('glass_thickness', Number(e.target.value))} />
                    </>
                  )}
                  {survey.infill_type === 'flat_bars' && (
                    <>
                      <Select id="bar_profile" label="Bar Profile" options={PROFILE_OPTIONS}
                        value={survey.bar_profile ?? '40x20'}
                        onChange={e => set('bar_profile', e.target.value as SteelProfile)} />
                      <Input id="bar_spacing" label="Bar Spacing" type="number" unit="mm"
                        value={survey.bar_spacing ?? 100}
                        onChange={e => set('bar_spacing', Number(e.target.value))} />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Site Conditions</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select id="access" label="Access Difficulty" options={ACCESS_OPTIONS}
                    value={survey.access_difficulty ?? 'easy'}
                    onChange={e => set('access_difficulty', e.target.value as 'easy' | 'medium' | 'hard')} />
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="text-sm font-medium text-foreground">Site Notes</label>
                    <textarea rows={2} placeholder="Obstacles, access notes..."
                      value={survey.site_notes ?? ''}
                      onChange={e => set('site_notes', e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Live Summary</CardTitle></CardHeader>
                <CardContent className="space-y-2.5 text-sm">
                  {estimation ? isGlassOnly ? (
                    <>
                      <Row label="Stringer length" value={`${estimation.stringer_length_m} m`} />
                      <Row label="Slope angle" value={`${estimation.slope_angle_deg}°`} />
                      <hr className="border-border" />
                      <div className="bg-gray-900 text-white rounded-lg p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Glass System</p>
                        <Row2 label="System" value={GLASS_SYSTEM_LABELS[survey.glass_system_type!]} inv />
                        <Row2 label="Panels" value={`${estimation.num_panels} pcs`} inv />
                        <Row2 label="Panel width" value={`${survey.post_spacing ?? 1000}mm`} inv />
                        <Row2 label="Glass area" value={`${estimation.infill_area_m2}m²`} inv />
                        <Row2 label="Labor" value={`${estimation.labor_days} day(s)`} inv />
                      </div>
                      <hr className="border-border" />
                      <Row label="Glass panels" value={formatCurrency(estimation.infill_cost)} bold />
                      <Row label="Hardware" value={formatCurrency(estimation.glass_hardware_cost)} bold />
                      <Row label="Labor" value={formatCurrency(estimation.labor_cost)} bold />
                      <div className="pt-2 border-t border-border">
                        <Row label="Subtotal" value={formatCurrency(estimation.subtotal)} bold />
                      </div>
                    </>
                  ) : (
                    <>
                      <Row label="Stringer length" value={`${estimation.stringer_length_m} m`} />
                      <Row label="Slope angle" value={`${estimation.slope_angle_deg}°`} />
                      <Row label="Steps" value={`${estimation.num_steps} × ${estimation.step_rise_mm}mm rise`} />

                      {/* Chosen layout (plain_sheet) */}
                      {survey.infill_type === 'plain_sheet' && (
                        <>
                          <hr className="border-border" />
                          <div className="bg-gray-900 text-white rounded-lg p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Chosen Layout</p>
                            <Row2 label="Sections" value={`${estimation.num_sections}`} inv />
                            <Row2 label="Posts" value={`${estimation.post_count} pcs`} inv />
                            <Row2 label="Slope spacing" value={`${estimation.chosen_section.section_slope_mm}mm`} inv />
                            <Row2 label="Horiz. span" value={`${estimation.chosen_section.section_horiz_mm}mm`} inv />
                            <Row2 label="Panel opening" value={`${estimation.opening_slope_edge_mm}×${estimation.opening_height_mm}mm`} inv />
                            <Row2 label="CNC cut" value={`${estimation.cut_slope_edge_mm}×${estimation.cut_height_mm}mm`} inv />
                            <Row2 label="Bounding rect" value={`${estimation.panel_bounding_width_mm}×${estimation.panel_bounding_height_mm}mm`} inv />
                            {estimation.panels_per_sheet > 1 && (
                              <Row2 label="Nesting" value={`${estimation.panels_per_sheet} panels/sheet`} inv />
                            )}
                            <Row2 label="Sheets needed" value={`${estimation.chosen_section.total_sheets}`} inv />
                            <Row2 label="Waste" value={`${estimation.chosen_section.waste_percent}%`} inv />
                          </div>
                        </>
                      )}

                      <hr className="border-border" />
                      <Row label="Posts" value={`${estimation.post_count} pcs`} />
                      <Row label="Panels" value={`${estimation.num_sections * (survey.rail_sides === 'both' ? 2 : 1)} pcs`} />
                      <Row label="Top rail" value={`${estimation.top_rail_length_m} m`} />
                      <Row label="Bottom rail" value={`${estimation.bottom_rail_length_m} m`} />
                      {survey.infill_type === 'plain_sheet' && (
                        <Row label="Catch frame" value={`${estimation.catch_total_length_m} m`} />
                      )}
                      <Row label="Infill area" value={`${estimation.infill_area_m2} m²`} />
                      <Row label="Labor" value={`${estimation.labor_days} day(s)`} />
                      <hr className="border-border" />
                      <Row label="Frame cost" value={formatCurrency(estimation.frame_cost)} bold />
                      <Row label="Infill cost" value={formatCurrency(estimation.infill_cost)} bold />
                      {estimation.cutting_cost > 0 && (
                        <Row label="CNC cutting" value={formatCurrency(estimation.cutting_cost)} bold />
                      )}
                      <Row label="Labor cost" value={formatCurrency(estimation.labor_cost)} bold />
                      <div className="pt-2 border-t border-border">
                        <Row label="Subtotal" value={formatCurrency(estimation.subtotal)} bold />
                      </div>
                    </>
                  ) : (
                    <p className="text-muted text-xs">Fill in dimensions to see live calculations.</p>
                  )}
                </CardContent>
              </Card>

              {!isDemo && (
                <Button className="w-full" onClick={handleSave} disabled={saving || !isComplete}>
                  <Save size={14} /> {saving ? 'Saving...' : saved ? '✓ Saved to Database' : 'Save Survey & Estimation'}
                </Button>
              )}
              <Button className="w-full" onClick={downloadGrasshopperFile} disabled={!isComplete}>
                <Download size={14} /> Export to Rhino (.json)
              </Button>
              <Button className="w-full" variant="secondary" onClick={() => setActiveTab('estimation')} disabled={!isComplete}>
                Go to Estimation →
              </Button>
            </div>
          </div>
        )}

        {/* ESTIMATION TAB */}
        {activeTab === 'estimation' && (
          <div className="space-y-6">
            {estimation ? (
              <>
                {/* CNC Panel info card */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-blue-900">CNC Panel Dimensions</CardTitle>
                    <p className="text-xs text-blue-700">
                      Exact measurements for CNC/laser cutter.
                      All {estimation.num_sections * (survey.rail_sides === 'both' ? 2 : 1)} panels are identical parallelograms.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                      <CNCCell label="Slope Edge (top & bottom)" value={`${estimation.cut_slope_edge_mm} mm`} />
                      <CNCCell label="Height (left & right)" value={`${estimation.cut_height_mm} mm`} />
                      <CNCCell label="Interior Angle" value={`${estimation.panel_angle_deg}°`} />
                      <CNCCell label="Bounding Width" value={`${estimation.panel_bounding_width_mm} mm`} />
                      <CNCCell label="Bounding Height" value={`${estimation.panel_bounding_height_mm} mm`} />
                    </div>
                    <p className="text-xs text-blue-600 mt-3">
                      ↗ Slope: {estimation.slope_angle_deg}° — Rotate alternate panels 180° when nesting to save material.
                      {estimation.panels_per_sheet > 1 && ` Nesting: ${estimation.panels_per_sheet} panels/sheet.`}
                    </p>
                  </CardContent>
                </Card>

                {/* Geometry summary */}
                <Card>
                  <CardHeader><CardTitle>Staircase Geometry</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <CNCCell label="Stringer Length" value={`${estimation.stringer_length_m} m`} />
                    <CNCCell label="Steps" value={`${estimation.num_steps} × ${estimation.step_rise_mm}mm rise`} />
                    <CNCCell label="Step Going" value={`${estimation.step_going_mm} mm`} />
                    <CNCCell label="Infill Area" value={`${estimation.infill_area_m2} m²`} />
                  </CardContent>
                </Card>

                {/* Line items */}
                <Card>
                  <CardHeader><CardTitle>Material &amp; Labor Breakdown</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="md:hidden divide-y divide-border">
                      {estimation.line_items.map((item, i) => (
                        <div key={i} className="px-4 py-3">
                          <div className="flex justify-between gap-2">
                            <p className="font-medium text-foreground text-sm">{item.label}</p>
                            <p className="font-semibold text-foreground text-sm shrink-0">{formatCurrency(item.total)}</p>
                          </div>
                          <p className="text-xs text-muted mt-0.5">{item.sub}</p>
                          <p className="text-xs text-muted mt-1">
                            {item.qty} {item.unit} × {formatCurrency(item.unit_price)}
                          </p>
                        </div>
                      ))}
                      <div className="px-4 py-3 bg-surface-muted flex justify-between font-semibold text-sm">
                        <span>Materials + Labor Subtotal</span>
                        <span>{formatCurrency(estimation.subtotal)}</span>
                      </div>
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-surface-muted border-b border-border">
                            <th className="px-6 py-2.5 text-left font-medium text-muted">Item</th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted">Qty</th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted">Unit</th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted">Unit Price</th>
                            <th className="px-6 py-2.5 text-right font-medium text-muted">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {estimation.line_items.map((item, i) => (
                            <tr key={i} className="hover:bg-surface-muted">
                              <td className="px-6 py-3">
                                <p className="font-medium text-foreground">{item.label}</p>
                                <p className="text-xs text-muted">{item.sub}</p>
                              </td>
                              <td className="px-4 py-3 text-right text-foreground">{item.qty}</td>
                              <td className="px-4 py-3 text-right text-muted">{item.unit}</td>
                              <td className="px-4 py-3 text-right text-foreground">{formatCurrency(item.unit_price)}</td>
                              <td className="px-6 py-3 text-right font-semibold text-foreground">{formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-surface-muted border-t border-border">
                            <td colSpan={4} className="px-6 py-3 text-sm font-semibold text-foreground">Materials + Labor Subtotal</td>
                            <td className="px-6 py-3 text-right font-bold text-foreground">{formatCurrency(estimation.subtotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={handleDownloadBOM} disabled={!estimation}>
                    <Download size={14} /> Download BOM
                  </Button>
                </div>

                {/* Variable Costs */}
                <Card>
                  <CardHeader>
                    <CardTitle>Variable Costs</CardTitle>
                    <p className="text-xs text-muted mt-1">These costs vary per job — adjust before quoting.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {!isGlassOnly && (survey.infill_type === 'plain_sheet' ? (
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-foreground">
                            CNC / Laser Cutting
                            {estimation && <span className="text-xs text-muted ml-1">— {estimation.total_sheets} sheet(s) = {formatCurrency(cncCuttingCost)}</span>}
                          </label>
                          <div className="flex gap-2 items-center">
                            <input type="number" min={0} value={cncRatePerSheet}
                              onChange={e => setCncRate(Number(e.target.value))}
                              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
                            <span className="text-sm text-muted whitespace-nowrap">RWF / sheet</span>
                          </div>
                        </div>
                      ) : (
                        <Input id="cnc_flat" label="CNC / Laser Cutting" type="number" unit="RWF"
                          value={cncCuttingCost || ''} placeholder="0"
                          onChange={e => setCncRate(Number(e.target.value))} />
                      ))}
                      <Input id="install_cost" label="Installation" type="number" unit="RWF"
                        value={installationCost || ''} placeholder="0"
                        onChange={e => setIC(Number(e.target.value))} />
                      {!isGlassOnly && (
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-foreground">
                            Welding Consumables
                            {estimation && <span className="text-xs text-muted ml-1">= {formatCurrency(consumablesCost)}</span>}
                          </label>
                          <div className="flex gap-2 items-center">
                            <input type="number" min={0} max={30} step={0.5} value={consumablesPercent}
                              onChange={e => setConsumablesPercent(Number(e.target.value))}
                              className="w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
                            <span className="text-sm text-muted">% of frame cost</span>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-foreground">Surface Treatment</label>
                        <select value={surfaceTreatmentType}
                          onChange={e => {
                            const t = e.target.value as 'none' | 'powder_coat' | 'paint'
                            setSurfaceTreatmentType(t)
                            if (t === 'powder_coat') setSurfaceTreatmentRate(8000)
                            if (t === 'paint') setSurfaceTreatmentRate(5000)
                          }}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]">
                          <option value="none">None</option>
                          <option value="powder_coat">Powder Coat</option>
                          <option value="paint">Paint / Primer</option>
                        </select>
                        {surfaceTreatmentType !== 'none' && (
                          <div className="flex gap-2 items-center mt-1">
                            <input type="number" min={0} value={surfaceTreatmentRate}
                              onChange={e => setSurfaceTreatmentRate(Number(e.target.value))}
                              className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
                            <span className="text-xs text-muted">
                              RWF/m²{estimation ? ` → ${formatCurrency(surfaceTreatmentCost)}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                      <Input id="transport" label="Transport & Delivery" type="number" unit="RWF"
                        value={transportCost || ''} placeholder="0"
                        onChange={e => setTransportCost(Number(e.target.value))} />
                      <Input id="hardware" label="Hardware & Fixings" type="number" unit="RWF"
                        value={hardwareCost || ''} placeholder="0"
                        onChange={e => setHardwareCost(Number(e.target.value))} />
                    </div>
                  </CardContent>
                </Card>

                {/* Pricing chain */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pricing</CardTitle>
                    <p className="text-xs text-muted mt-1">Set your margin before generating the quotation.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-foreground">Contingency</label>
                        <div className="flex gap-2 items-center">
                          <input type="number" min={0} max={50} value={contingencyPercent}
                            onChange={e => setContingencyPercent(Number(e.target.value))}
                            className="w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
                          <span className="text-sm text-muted">% risk buffer</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-foreground">Business Margin</label>
                        <div className="flex gap-2 items-center">
                          <input type="number" min={0} max={100} value={marginPercent}
                            onChange={e => setMarginPercent(Number(e.target.value))}
                            className="w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
                          <span className="text-sm text-muted">% overhead + profit</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-surface-muted rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between text-muted">
                        <span>Your direct cost</span>
                        <span className="font-medium">{formatCurrency(directTotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted text-xs">
                        <span className="pl-3">+ Contingency ({contingencyPercent}%)</span>
                        <span>+{formatCurrency(contingencyCost)}</span>
                      </div>
                      <div className="flex justify-between text-foreground font-medium border-t border-border pt-2">
                        <span>Adjusted cost</span>
                        <span>{formatCurrency(adjustedCost)}</span>
                      </div>
                      <div className="flex justify-between text-muted text-xs">
                        <span className="pl-3">+ Business margin ({marginPercent}%)</span>
                        <span>+{formatCurrency(marginCost)}</span>
                      </div>
                      <div className="flex justify-between border-t-2 border-foreground pt-2 mt-1">
                        <span className="text-base font-bold text-foreground">QUOTED PRICE</span>
                        <span className="text-2xl font-bold text-foreground">{formatCurrency(quotedPrice)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {!isDemo && (
                        <Button className="flex-1 min-h-11 sm:min-h-0" onClick={handleSave} disabled={saving}>
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
                <CardContent className="py-12 text-center text-muted">
                  Complete the site survey first.
                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => setActiveTab('survey')}>← Go to Survey</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* QUOTATION TAB */}
        {activeTab === 'quotation' && estimation && (
          <QuotationTab
            project={projectMeta}
            projectType="staircase"
            areas={[{
              name: 'Staircase',
              survey,
              estimation,
              cncCuttingCost,
            }]}
            pricing={{
              consumablesCost, consumablesPercent,
              surfaceTreatmentCost, surfaceTreatmentType, surfaceTreatmentRate,
              transportCost, hardwareCost,
              designCuttingCost: cncCuttingCost, installationCost,
              directTotal, contingencyPercent, contingencyCost,
              adjustedCost, marginPercent, marginCost, quotedPrice,
            }}
            estimationId={existingEstimation?.id ?? null}
            existingQuotation={existingQuotation}
            isDemo={isDemo}
          />
        )}
      </main>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted">{label}</span>
      <span className={bold ? 'font-semibold text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  )
}

function Row2({ label, value, inv, bold }: { label: string; value: string; inv?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={inv ? 'text-muted' : 'text-muted'}>{label}</span>
      <span className={inv ? 'text-white font-medium' : bold ? 'font-semibold text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  )
}

function CNCCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-lg border border-blue-100 p-3 text-center">
      <p className="text-xs text-blue-600 mb-1">{label}</p>
      <p className="text-base font-bold text-blue-900">{value}</p>
    </div>
  )
}
