'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { panelsPerSheet, pw, ph, CATCH_OVERLAP } from '@/lib/estimation'
import { formatCurrency } from '@/lib/utils'
import type { StaircaseSectionOption } from '@/lib/staircase-estimation'

interface Sheet {
  width_mm: number; height_mm: number; price: number; name: string; thickness_mm: number
}

interface CustomSectionInput {
  custom_sections?: number
  custom_section_width_mm?: number
  custom_cut_width_mm?: number
  custom_cut_height_mm?: number
}

interface Props {
  options: StaircaseSectionOption[]
  stringerLengthMm: number
  totalRunMm: number
  handrailHeightMm: number
  postProfile: string
  topRailProfile: string
  bottomRailProfile: string
  sheetThickness: number
  allSheets: Sheet[]
  initialValues: CustomSectionInput
  onSelect: (numSections: number) => void
  onCustomChange: (vals: CustomSectionInput) => void
}

export function StaircaseCustomSectionOption({
  options, stringerLengthMm, totalRunMm, handrailHeightMm, postProfile,
  topRailProfile, bottomRailProfile, sheetThickness, allSheets,
  initialValues, onSelect, onCustomChange,
}: Props) {
  const [sections, setSections] = useState<number | undefined>(initialValues.custom_sections ?? undefined)
  const [sectionWidthOverride, setSectionWidthOverride] = useState<number | undefined>(
    initialValues.custom_section_width_mm ?? undefined
  )
  const [cutW, setCutW] = useState<number | undefined>(initialValues.custom_cut_width_mm ?? undefined)
  const [cutH, setCutH] = useState<number | undefined>(initialValues.custom_cut_height_mm ?? undefined)

  const postW = pw(postProfile)
  const topRailH = ph(topRailProfile)
  const bottomRailH = ph(bottomRailProfile)
  const sectionHorizMm = sections && totalRunMm ? totalRunMm / sections : 0

  const derivedSectionWidth = sections && stringerLengthMm
    ? Math.round(stringerLengthMm / sections)
    : undefined
  const displaySectionWidth = typeof sectionWidthOverride === 'number'
    ? sectionWidthOverride
    : derivedSectionWidth

  function mergeAndSync(next: Partial<{
    sections: number | undefined
    sectionWidthOverride: number | undefined
    cutW: number | undefined
    cutH: number | undefined
  }>) {
    const s = 'sections' in next ? next.sections! : sections
    const sw = 'sectionWidthOverride' in next ? next.sectionWidthOverride! : sectionWidthOverride
    const cw = 'cutW' in next ? next.cutW! : cutW
    const ch = 'cutH' in next ? next.cutH! : cutH

    const derived = s && stringerLengthMm ? Math.round(stringerLengthMm / s) : undefined
    onCustomChange({
      custom_sections: s,
      custom_section_width_mm: typeof sw === 'number' ? sw : derived,
      custom_cut_width_mm: cw,
      custom_cut_height_mm: ch,
    })
  }

  function handleSections(v: number | undefined) {
    setSections(v)
    if (typeof v === 'number' && stringerLengthMm) {
      setSectionWidthOverride(undefined)
    }
    mergeAndSync({ sections: v, sectionWidthOverride: undefined })
  }

  function handleSectionWidth(v: number | undefined) {
    setSectionWidthOverride(v)
    if (typeof v === 'number' && v > 0 && stringerLengthMm) {
      setSections(Math.round(stringerLengthMm / v))
    }
    mergeAndSync({ sectionWidthOverride: v })
  }

  function handleCutW(v: number | undefined) {
    setCutW(v)
    mergeAndSync({ cutW: v })
  }

  function handleCutH(v: number | undefined) {
    setCutH(v)
    mergeAndSync({ cutH: v })
  }

  const hasSections = typeof sections === 'number' && sections >= 1 && sections <= 12
  const hasCut = typeof cutW === 'number' && typeof cutH === 'number' && cutW > 0 && cutH > 0

  const errors: string[] = []
  const warnings: string[] = []

  if (hasSections && displaySectionWidth && stringerLengthMm) {
    const calc = sections! * displaySectionWidth
    const diff = Math.abs(calc - stringerLengthMm)
    if (diff > 5) {
      warnings.push(`Sections × spacing = ${sections} × ${displaySectionWidth} = ${calc}mm, but stringer length is ${stringerLengthMm}mm`)
    }
  }

  if (hasSections && totalRunMm) {
    if (sectionHorizMm > 2000) {
      warnings.push(`Horizontal span ${Math.round(sectionHorizMm)}mm exceeds 2000mm — check structural adequacy`)
    }
  }

  const openingSlopeEdge = displaySectionWidth ? displaySectionWidth - postW : 0
  const openingHeight = handrailHeightMm - topRailH - bottomRailH
  const minCutW = openingSlopeEdge + 2 * CATCH_OVERLAP
  const minCutH = openingHeight + 2 * CATCH_OVERLAP
  if (hasCut && displaySectionWidth && (cutW! < minCutW || cutH! < minCutH)) {
    errors.push(`Cut size (${cutW}×${cutH}mm) is smaller than opening + overlap (${Math.round(minCutW)}×${Math.round(minCutH)}mm)`)
  }

  const customSheetInfo = useMemo(() => {
    if (!hasSections || !hasCut || !sheetThickness) return null
    const fitting = allSheets
      .filter(s => s.thickness_mm === sheetThickness)
      .map(s => ({ ...s, pps: panelsPerSheet(cutW!, cutH!, s.width_mm, s.height_mm) }))
      .filter(s => s.pps >= 1)
      .sort((a, b) => a.price - b.price)
    if (!fitting.length) return null
    const sheet = fitting[0]
    const totalPanels = sections! * 1
    const totalSheets = Math.ceil(totalPanels / sheet.pps)
    const sheetArea = sheet.width_mm * sheet.height_mm
    const usedArea = cutW! * cutH! * sheet.pps
    const wastePercent = Math.round((sheetArea - usedArea) / sheetArea * 100)
    return { sheet, totalSheets, wastePercent, pps: sheet.pps, totalPanels }
  }, [hasSections, hasCut, sections, cutW, cutH, allSheets, sheetThickness])

  if (hasSections && hasCut && !customSheetInfo) {
    errors.push(`No ${sheetThickness}mm supplier sheet can fit a ${cutW}×${cutH}mm cut piece`)
  }

  const matchResult = useMemo(() => {
    if (!hasSections || !options.length) return null
    const exact = options.find(o => o.num_sections === sections)
    if (exact) return { match: exact, exact: true }
    const sorted = [...options].sort((a, b) =>
      Math.abs(a.num_sections - sections!) - Math.abs(b.num_sections - sections!)
    )
    return { match: sorted[0], exact: false }
  }, [hasSections, sections, options])

  const best = useMemo(() => {
    if (!options.length) return null
    const valid = [...options].filter(o => o.structural).sort((a, b) => a.total_cost - b.total_cost)
    return valid.length ? valid[0] : [...options].sort((a, b) => a.total_cost - b.total_cost)[0]
  }, [options])

  const matchedCost = matchResult?.match.total_cost ?? 0
  const costDiffPercent = best ? Math.round((matchedCost - best.total_cost) / best.total_cost * 100) : 0
  const canSelect = hasSections && errors.length === 0 && !!matchResult

  const hasAnyValue = sections !== undefined || cutW !== undefined || cutH !== undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Try Your Own Layout</CardTitle>
        <p className="text-xs text-muted mt-1">
          Enter your desired sections and cut size to see how it compares.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input id="stair-custom-sections" label="Number of sections" type="number" min={1} max={12}
            value={sections ?? ''} placeholder="e.g. 4"
            onChange={e => handleSections(e.target.value === '' ? undefined : Number(e.target.value))} />
          <Input id="stair-custom-spacing" label="Spacing along slope" type="number" unit="mm"
            value={displaySectionWidth ?? ''} placeholder="auto"
            onChange={e => handleSectionWidth(e.target.value === '' ? undefined : Number(e.target.value))} />
          <Input id="stair-custom-cut-w" label="Cut slope edge" type="number" unit="mm"
            value={cutW ?? ''} placeholder="e.g. 920"
            onChange={e => handleCutW(e.target.value === '' ? undefined : Number(e.target.value))} />
          <Input id="stair-custom-cut-h" label="Cut height" type="number" unit="mm"
            value={cutH ?? ''} placeholder="e.g. 480"
            onChange={e => handleCutH(e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>

        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">{w}</p>
            ))}
          </div>
        )}

        {hasAnyValue && !hasSections && (
          <p className="text-xs text-muted">Enter number of sections (1–12) to see comparison.</p>
        )}

        {hasSections && matchResult && (
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {matchResult.exact ? 'Exact match' : 'Closest option'}: {matchResult.match.num_sections} sections, {matchResult.match.section_slope_mm}mm spacing
              </p>
              <span className="text-xs text-muted">Cut: {cutW ?? '?'}×{cutH ?? '?'}mm</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <span className="text-muted">Cost</span>
              <span>
                {formatCurrency(matchedCost)}
                {best && costDiffPercent !== 0 && (
                  <span className="text-muted ml-1">({costDiffPercent > 0 ? `+${costDiffPercent}%` : `${costDiffPercent}%`} vs BEST)</span>
                )}
                {best && costDiffPercent === 0 && <span className="text-green-600 ml-1">(BEST)</span>}
              </span>

              <span className="text-muted">Waste</span>
              <span>
                {matchResult.match.waste_percent}%
                {best && <span className="text-muted ml-1">(BEST: {best.waste_percent}%)</span>}
              </span>

              <span className="text-muted">Sheets</span>
              <span>
                {matchResult.match.total_sheets} × {matchResult.match.supplier_sheet.width_mm}×{matchResult.match.supplier_sheet.height_mm}mm
                {matchResult.match.panels_per_sheet > 1 && (
                  <span className="text-muted ml-1">({matchResult.match.panels_per_sheet}/sheet)</span>
                )}
              </span>

              <span className="text-muted">Structural</span>
              <span className={matchResult.match.structural ? 'text-green-600' : 'text-red-600'}>
                {matchResult.match.structural ? '✓' : '✗ — horizontal span > 2000mm'}
              </span>
            </div>

            {customSheetInfo && (
              <div className="text-xs text-muted border-t border-border pt-2">
                Sheet for your cut: {customSheetInfo.sheet.width_mm}×{customSheetInfo.sheet.height_mm}mm — {customSheetInfo.totalSheets} sheet(s), {customSheetInfo.pps} panel(s)/sheet, {customSheetInfo.wastePercent}% waste
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                {costDiffPercent <= 15 && matchResult.match.structural && matchResult.match.waste_percent <= 35 && (
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded font-medium">✅ Good option</span>
                )}
                {costDiffPercent > 15 && costDiffPercent <= 30 && matchResult.match.structural && (
                  <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded font-medium">⚠ Acceptable</span>
                )}
                {(costDiffPercent > 30 || !matchResult.match.structural || matchResult.match.waste_percent > 35) && (
                  <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded font-medium">❌ Not optimal</span>
                )}
              </div>
              <Button onClick={() => onSelect(matchResult.match.num_sections)} disabled={!canSelect}>
                Use This Option
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
