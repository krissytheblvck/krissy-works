import type { StaircaseSurvey, ResolvedPrices } from '@/types'
import { DEFAULT_RESOLVED_PRICES } from '@/lib/default-prices'
import type { MaterialLineItem } from '@/lib/estimation'

const WASTE_PROFILE  = 1.05  // 5% profile off-cut waste
const CATCH_OVERLAP  = 20    // mm sheet overlaps into catch each side
const MAX_SECTION_HW = 2000  // mm — structural max horizontal post spacing

function pw(profile: string): number { return Number(profile.split('x')[0]) || 40 }
function ph(profile: string): number { return Number(profile.split('x')[1]) || 40 }

function barsNeeded(totalLengthM: number, barLengthMm: number): number {
  return Math.ceil((totalLengthM / (barLengthMm / 1000)) * WASTE_PROFILE)
}

// How many cut bounding-rects (cw×ch) fit on one supplier sheet (sw×sh)?
function panelsPerSheet(cw: number, ch: number, sw: number, sh: number): number {
  const normal  = Math.floor(sw / cw) * Math.floor(sh / ch)
  const rotated = Math.floor(sw / ch) * Math.floor(sh / cw)
  return Math.max(normal, rotated, 0)
}

export interface StaircaseSectionOption {
  num_sections: number
  section_slope_mm: number        // stringer_length / num_sections
  section_horiz_mm: number        // horizontal span between posts
  opening_slope_edge_mm: number   // section_slope - post_width
  opening_height_mm: number       // handrail_height - top_rail_h - bottom_rail_h
  cut_slope_edge_mm: number       // opening_slope_edge + 2×catch_overlap
  cut_height_mm: number           // opening_height + 2×catch_overlap
  cut_bounding_W_mm: number       // cut_slope_edge × cos(slope) — bounding rect width
  cut_bounding_H_mm: number       // cut_height + cut_slope_edge × sin(slope) — bounding rect height
  supplier_sheet: { width_mm: number; height_mm: number; price: number; name: string; thickness_mm: number }
  panels_per_sheet: number
  total_sheets: number
  waste_percent: number
  structural: boolean             // horizontal span <= 2000mm
  total_cost: number
}

export interface PanelCNCData {
  panel_number: number
  slope_edge_mm: number
  height_mm: number
  angle_deg: number
  bounding_width_mm: number
  bounding_height_mm: number
  area_m2: number
}

export interface StaircaseEstimationResult {
  // Geometry
  stringer_length_m: number
  slope_angle_deg: number
  num_steps: number
  step_rise_mm: number
  step_going_mm: number
  post_count: number
  num_panels: number
  num_sections: number
  // Section optimizer
  section_options: StaircaseSectionOption[]
  chosen_section: StaircaseSectionOption
  // Opening / cut dims
  opening_slope_edge_mm: number
  opening_height_mm: number
  cut_slope_edge_mm: number
  cut_height_mm: number
  panels_per_sheet: number
  catch_total_length_m: number
  // Rail lengths
  top_rail_length_m: number
  bottom_rail_length_m: number
  post_total_length_m: number
  // CNC panel shape (all panels identical on straight stair)
  panel_slope_edge_mm: number      // = cut_slope_edge_mm (the actual cut dimension)
  panel_height_mm: number          // = cut_height_mm
  panel_angle_deg: number          // interior angle at bottom corner
  panel_bounding_width_mm: number  // = cut_bounding_W_mm
  panel_bounding_height_mm: number // = cut_bounding_H_mm
  panels_cnc: PanelCNCData[]
  // Areas
  infill_area_m2: number
  // Labor
  labor_days: number
  // Line items
  line_items: MaterialLineItem[]
  // Costs
  frame_cost: number
  infill_cost: number
  cutting_cost: number         // always 0 — CNC rate is set per-job in Variable Costs
  total_sheets: number         // sheets needed (for the CNC rate input in UI)
  glass_hardware_cost: number  // spigots + channel + top rail (non-framed glass only)
  labor_cost: number
  subtotal: number
  fabrication_per_day: number
}

export function calculateStaircaseSectionOptions(
  totalRiseMm: number,
  totalRunMm: number,
  handrailHeightMm: number,
  postProfile: string,
  topRailProfile: string,
  bottomRailProfile: string,
  catchProfile: string,
  sheetThickness: number,
  prices: ResolvedPrices,
  sides: number
): StaircaseSectionOption[] {
  const stringer_mm   = Math.sqrt(totalRiseMm ** 2 + totalRunMm ** 2)
  const slope_rad     = Math.atan2(totalRiseMm, totalRunMm)
  const cosA          = Math.cos(slope_rad)
  const sinA          = Math.sin(slope_rad)

  const postW         = pw(postProfile)
  const topRailH      = ph(topRailProfile)
  const bottomRailH   = ph(bottomRailProfile)
  const opening_H     = handrailHeightMm - topRailH - bottomRailH
  const cut_H         = opening_H + 2 * CATCH_OVERLAP

  const allSheets     = (prices.allSheets ?? []).filter(s => s.thickness_mm === sheetThickness)
  if (allSheets.length === 0 || opening_H <= 0) return []

  const postData   = prices.profiles[postProfile]        ?? { price: 18000, bar_length_mm: 6000 }
  const trData     = prices.profiles[topRailProfile]     ?? { price: 18000, bar_length_mm: 6000 }
  const brData     = prices.profiles[bottomRailProfile]  ?? { price: 14000, bar_length_mm: 6000 }
  const catchData  = prices.profiles[catchProfile]       ?? { price: 10000, bar_length_mm: 6000 }
  const cutData    = prices.cutting[sheetThickness]      ?? { price: 60000 }
  const stringerM  = stringer_mm / 1000
  const handrailM  = handrailHeightMm / 1000

  const options: StaircaseSectionOption[] = []

  for (let n = 1; n <= 12; n++) {
    const section_slope_mm   = stringer_mm / n
    const section_horiz_mm   = section_slope_mm * cosA
    const opening_slope_edge = section_slope_mm - postW
    if (opening_slope_edge <= 100) continue

    const cut_slope_edge     = opening_slope_edge + 2 * CATCH_OVERLAP
    const cut_bW             = Math.round(cut_slope_edge * cosA)
    const cut_bH             = Math.round(cut_H + cut_slope_edge * sinA)
    const structural         = section_horiz_mm <= MAX_SECTION_HW

    const fitting = allSheets
      .filter(s => panelsPerSheet(cut_bW, cut_bH, s.width_mm, s.height_mm) >= 1)
      .sort((a, b) => a.price - b.price)
    if (fitting.length === 0) continue

    const sheet          = fitting[0]
    const pps            = panelsPerSheet(cut_bW, cut_bH, sheet.width_mm, sheet.height_mm)
    const totalPanels    = n * sides
    const totalSheets    = Math.ceil(totalPanels / pps)
    const sheetArea      = sheet.width_mm * sheet.height_mm
    const usedArea       = cut_bW * cut_bH * pps
    const wastePercent   = Math.round((sheetArea - usedArea) / sheetArea * 100)

    // ── Full cost estimate for this option ────────────────────────────────
    const post_count     = n + 1
    const postLenM       = post_count * handrailM * sides
    const railLenM       = stringerM * sides
    const catchLenM      = n * sides * 2 * ((opening_slope_edge / 1000) + (opening_H / 1000))

    const postBars       = barsNeeded(postLenM, postData.bar_length_mm)
    const trBars         = barsNeeded(railLenM, trData.bar_length_mm)
    const brBars         = barsNeeded(railLenM, brData.bar_length_mm)
    const catchBars      = barsNeeded(catchLenM, catchData.bar_length_mm)

    const frameCost      = postBars  * postData.price
                         + trBars    * trData.price
                         + brBars    * brData.price
                         + catchBars * catchData.price
    const sheetCost      = totalSheets * sheet.price
    const cuttingCost    = totalSheets * cutData.price
    const laborDays      = Math.max(Math.ceil((post_count * 0.6 + n * 1.2) * (sides === 2 ? 1.4 : 1)), 1)
    const laborCost      = laborDays * prices.fabrication_per_day
    const totalCost      = frameCost + sheetCost + cuttingCost + laborCost

    options.push({
      num_sections:          n,
      section_slope_mm:      Math.round(section_slope_mm),
      section_horiz_mm:      Math.round(section_horiz_mm),
      opening_slope_edge_mm: Math.round(opening_slope_edge),
      opening_height_mm:     Math.round(opening_H),
      cut_slope_edge_mm:     Math.round(cut_slope_edge),
      cut_height_mm:         Math.round(cut_H),
      cut_bounding_W_mm:     cut_bW,
      cut_bounding_H_mm:     cut_bH,
      supplier_sheet:        { ...sheet },
      panels_per_sheet:      pps,
      total_sheets:          totalSheets,
      waste_percent:         wastePercent,
      structural,
      total_cost:            Math.round(totalCost),
    })
  }

  // Sort by total cost
  return options.sort((a, b) => a.total_cost - b.total_cost)
}

const DEFAULT_GLASS_HW_S = { spigot_price: 25000, top_rail_per_m: 8000, channel_per_m: 12000 }

function calculateGlassOnlyStaircase(
  survey: StaircaseSurvey,
  prices: ResolvedPrices,
  glassSys: 'spigot' | 'channel_base' | 'embedded'
): StaircaseEstimationResult {
  const riseM        = survey.total_rise / 1000
  const runM         = survey.total_run  / 1000
  const stringer_m   = Math.sqrt(riseM ** 2 + runM ** 2)
  const slope_rad    = Math.atan2(riseM, runM)
  const slope_deg    = Math.round(slope_rad * (180 / Math.PI) * 10) / 10
  const sides        = survey.rail_sides === 'both' ? 2 : 1
  const t            = survey.glass_thickness ?? 10
  const panelWidthMm = survey.post_spacing ?? 1000   // along slope
  const num_panels   = Math.ceil(stringer_m / (panelWidthMm / 1000)) * sides

  // Glass height: add embedment for channel/embedded systems
  const embedMm      = glassSys === 'embedded' ? 100 : glassSys === 'channel_base' ? 60 : 0
  const glassHeightMm= survey.handrail_height + embedMm
  // Panel area on stairs = slope_width × height (parallelogram, not rectangle)
  const cosA         = Math.cos(slope_rad)
  const panelArea    = (panelWidthMm / 1000) * (glassHeightMm / 1000) * cosA
  const glass_area   = Math.round(num_panels * panelArea * 100) / 100

  const glassData    = prices.glass[t] ?? { price: 85000, name: `${t}mm Glass` }
  const infill_cost  = Math.round(glass_area * glassData.price)

  const hw           = prices.glass_hardware ?? DEFAULT_GLASS_HW_S
  let glass_hardware_cost = 0
  const line_items: MaterialLineItem[] = []

  line_items.push({
    label: `Glass Panels — ${t}mm toughened`,
    sub: `${num_panels} panels × ${panelWidthMm}×${glassHeightMm}mm (along slope) = ${glass_area}m²`,
    qty: glass_area, unit: 'm²', unit_price: glassData.price, total: infill_cost,
  })

  if (glassSys === 'spigot') {
    const spigot_count = (Math.ceil(stringer_m / (panelWidthMm / 1000)) + 1) * sides
    const cost = spigot_count * hw.spigot_price
    glass_hardware_cost += cost
    line_items.push({
      label: 'Floor-Mount Spigots (Stainless Steel)',
      sub: `${spigot_count} spigots${sides === 2 ? ' (both sides)' : ''}`,
      qty: spigot_count, unit: 'pc', unit_price: hw.spigot_price, total: cost,
    })
  }

  if (glassSys === 'channel_base') {
    const channelLen = Math.round(stringer_m * sides * 100) / 100
    const cost = Math.round(channelLen * hw.channel_per_m)
    glass_hardware_cost += cost
    line_items.push({
      label: 'Aluminium Bottom Channel (U-profile)',
      sub: `${channelLen.toFixed(2)}m`,
      qty: channelLen, unit: 'm', unit_price: hw.channel_per_m, total: cost,
    })
  }

  const railLen  = Math.round(stringer_m * sides * 100) / 100
  const tr_cost  = Math.round(railLen * hw.top_rail_per_m)
  glass_hardware_cost += tr_cost
  line_items.push({
    label: 'Aluminium Top Rail / Handrail',
    sub: `${railLen.toFixed(2)}m`,
    qty: railLen, unit: 'm', unit_price: hw.top_rail_per_m, total: tr_cost,
  })

  const accessMult = survey.access_difficulty === 'hard' ? 1.5 : survey.access_difficulty === 'medium' ? 1.2 : 1.0
  const mPerDay    = glassSys === 'embedded' ? 3 : glassSys === 'spigot' ? 4 : 5
  const labor_days = Math.max(Math.ceil((stringer_m * sides / mPerDay) * accessMult), 1)
  const labor_cost = labor_days * prices.fabrication_per_day
  line_items.push({
    label: 'Installation Labor',
    sub: `${labor_days} day(s) × ${prices.fabrication_per_day.toLocaleString()} RWF/day`,
    qty: labor_days, unit: 'day', unit_price: prices.fabrication_per_day, total: labor_cost,
  })

  const subtotal   = infill_cost + glass_hardware_cost + labor_cost
  const num_steps  = Math.max(Math.round(survey.total_rise / 175), 1)
  const dummySheet = { width_mm: 0, height_mm: 0, price: 0, name: 'N/A', thickness_mm: t }
  const dummySection: StaircaseSectionOption = {
    num_sections: num_panels / sides,
    section_slope_mm: panelWidthMm,
    section_horiz_mm: Math.round(panelWidthMm * cosA),
    opening_slope_edge_mm: panelWidthMm,
    opening_height_mm: survey.handrail_height,
    cut_slope_edge_mm: panelWidthMm,
    cut_height_mm: survey.handrail_height,
    cut_bounding_W_mm: Math.round(panelWidthMm * cosA),
    cut_bounding_H_mm: survey.handrail_height,
    supplier_sheet: dummySheet,
    panels_per_sheet: 1, total_sheets: 0, waste_percent: 0,
    structural: true, total_cost: Math.round(subtotal),
  }

  return {
    stringer_length_m:   Math.round(stringer_m * 100) / 100,
    slope_angle_deg:     slope_deg,
    num_steps,
    step_rise_mm:        Math.round(survey.total_rise / num_steps),
    step_going_mm:       Math.round(survey.total_run  / num_steps),
    post_count:          0,
    num_panels,
    num_sections:        num_panels / sides,
    section_options:     [],
    chosen_section:      dummySection,
    opening_slope_edge_mm: panelWidthMm,
    opening_height_mm:   survey.handrail_height,
    cut_slope_edge_mm:   panelWidthMm,
    cut_height_mm:       survey.handrail_height,
    panels_per_sheet:    1,
    catch_total_length_m: 0,
    top_rail_length_m:   railLen,
    bottom_rail_length_m: 0,
    post_total_length_m: 0,
    panel_slope_edge_mm: panelWidthMm,
    panel_height_mm:     survey.handrail_height,
    panel_angle_deg:     Math.round((90 - slope_deg) * 10) / 10,
    panel_bounding_width_mm:  Math.round(panelWidthMm * cosA),
    panel_bounding_height_mm: survey.handrail_height,
    panels_cnc:          [],
    infill_area_m2:      glass_area,
    labor_days,
    line_items,
    frame_cost:          0,
    infill_cost:         Math.round(infill_cost),
    cutting_cost:        0,
    total_sheets:        0,
    glass_hardware_cost: Math.round(glass_hardware_cost),
    labor_cost:          Math.round(labor_cost),
    subtotal:            Math.round(subtotal),
    fabrication_per_day: prices.fabrication_per_day,
  }
}

export function calculateStaircaseEstimation(
  survey: StaircaseSurvey,
  prices: ResolvedPrices = DEFAULT_RESOLVED_PRICES
): StaircaseEstimationResult {
  if (survey.infill_type === 'glass' && survey.glass_system_type && survey.glass_system_type !== 'framed_post') {
    return calculateGlassOnlyStaircase(survey, prices, survey.glass_system_type)
  }

  const riseM        = survey.total_rise / 1000
  const runM         = survey.total_run / 1000
  const stringer_m   = Math.sqrt(riseM ** 2 + runM ** 2)
  const slope_rad    = Math.atan2(riseM, runM)
  const slope_deg    = Math.round(Math.atan2(riseM, runM) * (180 / Math.PI) * 10) / 10
  const cosA         = Math.cos(slope_rad)
  const sinA         = Math.sin(slope_rad)
  const sides        = survey.rail_sides === 'both' ? 2 : 1
  const thickness    = survey.sheet_thickness ?? 2
  const catchPro     = survey.catch_profile ?? '20x20'

  // ── Steps ─────────────────────────────────────────────────────────────────────
  const num_steps    = Math.max(Math.round(survey.total_rise / 175), 1)
  const step_rise_mm = Math.round(survey.total_rise / num_steps)
  const step_going_mm= Math.round(survey.total_run  / num_steps)

  // ── Section optimizer (plain_sheet) ──────────────────────────────────────────
  let section_options: StaircaseSectionOption[] = []
  let chosen: StaircaseSectionOption | null = null
  let num_sections: number

  if (survey.infill_type === 'plain_sheet') {
    section_options = calculateStaircaseSectionOptions(
      survey.total_rise, survey.total_run, survey.handrail_height,
      survey.post_profile, survey.top_rail_profile, survey.bottom_rail_profile,
      catchPro, thickness, prices, sides
    )
    const validOptions = section_options.filter(o => o.structural)
    const ranked       = (validOptions.length ? validOptions : section_options)

    const chosen_n     = survey.num_sections ?? ranked[0]?.num_sections ?? 3
    chosen             = section_options.find(o => o.num_sections === chosen_n) ?? ranked[0] ?? null
    num_sections       = chosen?.num_sections ?? chosen_n
  } else {
    // For glass/flat_bars: use post_spacing to derive sections
    const postSpacingM = (survey.post_spacing ?? 1200) / 1000
    num_sections       = Math.max(Math.floor(stringer_m / postSpacingM), 1)
  }

  if (!chosen && survey.infill_type === 'plain_sheet') {
    throw new Error('No valid section option — check sheet sizes in prices.')
  }

  const post_count      = num_sections + 1

  // ── Quantities ────────────────────────────────────────────────────────────────
  const handrailM       = survey.handrail_height / 1000
  const section_slope_m = stringer_m / num_sections
  const section_horiz_m = section_slope_m * cosA

  const postW           = pw(survey.post_profile)
  const topRailH        = ph(survey.top_rail_profile)
  const bottomRailH     = ph(survey.bottom_rail_profile)

  const opening_slope_edge_mm = chosen?.opening_slope_edge_mm
    ?? Math.round(section_slope_m * 1000 - postW)
  const opening_height_mm     = chosen?.opening_height_mm
    ?? Math.round(survey.handrail_height - topRailH - bottomRailH)
  const cut_slope_edge_mm     = chosen?.cut_slope_edge_mm
    ?? (opening_slope_edge_mm + 2 * CATCH_OVERLAP)
  const cut_height_mm         = chosen?.cut_height_mm
    ?? (opening_height_mm + 2 * CATCH_OVERLAP)
  const cut_bounding_W_mm     = chosen?.cut_bounding_W_mm
    ?? Math.round(cut_slope_edge_mm * cosA)
  const cut_bounding_H_mm     = chosen?.cut_bounding_H_mm
    ?? Math.round(cut_height_mm + cut_slope_edge_mm * sinA)
  const pps                   = chosen?.panels_per_sheet ?? 1

  const top_rail_length_m     = Math.round(stringer_m * sides * 100) / 100
  const bottom_rail_length_m  = Math.round(stringer_m * sides * 100) / 100
  const post_total_length_m   = Math.round(post_count * handrailM * sides * 100) / 100
  const catch_total_length_m  = Math.round(
    num_sections * sides * 2 * ((opening_slope_edge_mm / 1000) + (opening_height_mm / 1000)) * 100
  ) / 100

  // Panel area (parallelogram) = slope_edge × height × cos(slope)
  const panel_area_m2 = Math.round((opening_slope_edge_mm / 1000) * (opening_height_mm / 1000) * cosA * 10000) / 10000
  const infill_area_m2= Math.round(panel_area_m2 * num_sections * sides * 100) / 100

  const panel_angle_deg = Math.round((90 - slope_deg) * 10) / 10

  // Generate CNC list (all panels identical on a straight stair)
  const panels_cnc: PanelCNCData[] = Array.from({ length: num_sections * sides }, (_, i) => ({
    panel_number:      i + 1,
    slope_edge_mm:     cut_slope_edge_mm,
    height_mm:         cut_height_mm,
    angle_deg:         panel_angle_deg,
    bounding_width_mm: cut_bounding_W_mm,
    bounding_height_mm:cut_bounding_H_mm,
    area_m2:           panel_area_m2,
  }))

  // ── Line items ────────────────────────────────────────────────────────────────
  const line_items: MaterialLineItem[] = []

  // Posts
  const postData  = prices.profiles[survey.post_profile]       ?? { price: 18000, bar_length_mm: 6000 }
  const postBars  = barsNeeded(post_total_length_m, postData.bar_length_mm)
  line_items.push({
    label: `Posts — ${survey.post_profile}`,
    sub:   `${post_count} posts × ${survey.handrail_height}mm × ${sides === 2 ? '2 sides' : '1 side'} = ${post_total_length_m}m → ${postBars} bars`,
    qty: postBars, unit: 'bar', unit_price: postData.price, total: postBars * postData.price,
  })

  // Top rail
  const trData    = prices.profiles[survey.top_rail_profile]   ?? { price: 18000, bar_length_mm: 6000 }
  const trBars    = barsNeeded(top_rail_length_m, trData.bar_length_mm)
  line_items.push({
    label: `Top Rail — ${survey.top_rail_profile}`,
    sub:   `${top_rail_length_m}m → ${trBars} bar(s)`,
    qty: trBars, unit: 'bar', unit_price: trData.price, total: trBars * trData.price,
  })

  // Bottom rail
  const brData    = prices.profiles[survey.bottom_rail_profile] ?? { price: 14000, bar_length_mm: 6000 }
  const brBars    = barsNeeded(bottom_rail_length_m, brData.bar_length_mm)
  line_items.push({
    label: `Bottom Rail — ${survey.bottom_rail_profile}`,
    sub:   `${bottom_rail_length_m}m → ${brBars} bar(s)`,
    qty: brBars, unit: 'bar', unit_price: brData.price, total: brBars * brData.price,
  })

  // Catch profile (inner frame, all 4 sides of every panel)
  if (survey.infill_type === 'plain_sheet') {
    const catchData = prices.profiles[catchPro] ?? { price: 10000, bar_length_mm: 6000 }
    const catchBars = barsNeeded(catch_total_length_m, catchData.bar_length_mm)
    line_items.push({
      label: `Inner Catch Frame — ${catchPro}`,
      sub:   `${num_sections * sides} panels × 4 sides = ${catch_total_length_m}m → ${catchBars} bars`,
      qty: catchBars, unit: 'bar', unit_price: catchData.price, total: catchBars * catchData.price,
    })
  }

  const frame_cost = line_items.reduce((s, i) => s + i.total, 0)

  // ── Infill ────────────────────────────────────────────────────────────────────
  let infill_cost  = 0

  if (survey.infill_type === 'plain_sheet' && chosen) {
    const total_sheets = chosen.total_sheets
    const sheet        = chosen.supplier_sheet
    infill_cost        = total_sheets * sheet.price
    const nestNote     = pps > 1 ? ` (${pps} panels/sheet — nested)` : ''
    line_items.push({
      label: `Laser-Cut Sheet — ${thickness}mm`,
      sub:   `${num_sections * sides} panels, cut ${cut_slope_edge_mm}×${cut_height_mm}mm (bounding ${cut_bounding_W_mm}×${cut_bounding_H_mm}mm) from ${sheet.width_mm}×${sheet.height_mm}mm${nestNote} | ${chosen.waste_percent}% waste`,
      qty: total_sheets, unit: 'sheet', unit_price: sheet.price, total: infill_cost,
    })
    // CNC cutting cost is NOT added here — it's an editable per-job field in Variable Costs
  } else if (survey.infill_type === 'glass') {
    const t          = survey.glass_thickness ?? 10
    const glassData  = prices.glass[t] ?? { price: 85000 }
    infill_cost      = Math.round(infill_area_m2 * glassData.price)
    line_items.push({
      label: `Glass — ${t}mm`,
      sub:   `${num_sections * sides} panels = ${infill_area_m2}m²`,
      qty: infill_area_m2, unit: 'm²', unit_price: glassData.price, total: infill_cost,
    })
  } else if (survey.infill_type === 'flat_bars') {
    const barSpacingM    = (survey.bar_spacing ?? 100) / 1000
    const bars_per_panel = Math.floor((survey.handrail_height / 1000) / barSpacingM)
    const bar_len_m      = bars_per_panel * num_sections * sides * (opening_slope_edge_mm / 1000)
    const fbData         = prices.profiles[survey.bar_profile ?? '40x20'] ?? { price: 14000, bar_length_mm: 6000 }
    const fb_bars        = barsNeeded(bar_len_m, fbData.bar_length_mm)
    infill_cost          = fb_bars * fbData.price
    line_items.push({
      label: `Flat Bars`,
      sub:   `${bars_per_panel} bars/panel × ${num_sections * sides} panels → ${fb_bars} bars`,
      qty: fb_bars, unit: 'bar', unit_price: fbData.price, total: infill_cost,
    })
  }

  // ── Labor ─────────────────────────────────────────────────────────────────────
  const access_mult = survey.access_difficulty === 'hard' ? 1.5
    : survey.access_difficulty === 'medium' ? 1.2 : 1.0
  const labor_days  = Math.max(Math.ceil((post_count * 0.6 + num_sections * 1.2) * access_mult * (sides === 2 ? 1.4 : 1)), 1)
  const labor_cost  = labor_days * prices.fabrication_per_day
  line_items.push({
    label: 'Fabrication Labor',
    sub:   `${labor_days} day(s) × ${prices.fabrication_per_day.toLocaleString()} RWF/day`,
    qty: labor_days, unit: 'day', unit_price: prices.fabrication_per_day, total: labor_cost,
  })

  const cutting_cost = 0  // CNC is per-job variable cost, not fixed in estimation
  const subtotal = frame_cost + infill_cost + labor_cost

  // Build a dummy chosen_section for glass/flat_bars (no sheet optimizer)
  const chosen_section: StaircaseSectionOption = chosen ?? {
    num_sections,
    section_slope_mm:      Math.round(section_slope_m * 1000),
    section_horiz_mm:      Math.round(section_horiz_m * 1000),
    opening_slope_edge_mm,
    opening_height_mm,
    cut_slope_edge_mm,
    cut_height_mm,
    cut_bounding_W_mm,
    cut_bounding_H_mm,
    supplier_sheet:        { width_mm: 0, height_mm: 0, price: 0, name: 'N/A', thickness_mm: thickness },
    panels_per_sheet:      1,
    total_sheets:          0,
    waste_percent:         0,
    structural:            (section_horiz_m * 1000) <= MAX_SECTION_HW,
    total_cost:            Math.round(subtotal),
  }

  return {
    stringer_length_m:   Math.round(stringer_m * 100) / 100,
    slope_angle_deg:     slope_deg,
    num_steps,
    step_rise_mm,
    step_going_mm,
    post_count,
    num_panels:          num_sections,
    num_sections,
    section_options,
    chosen_section,
    opening_slope_edge_mm,
    opening_height_mm,
    cut_slope_edge_mm,
    cut_height_mm,
    panels_per_sheet:    pps,
    catch_total_length_m,
    top_rail_length_m,
    bottom_rail_length_m,
    post_total_length_m,
    // CNC aliases (same as cut dims — these are what goes to the CNC operator)
    panel_slope_edge_mm:     cut_slope_edge_mm,
    panel_height_mm:         cut_height_mm,
    panel_angle_deg,
    panel_bounding_width_mm: cut_bounding_W_mm,
    panel_bounding_height_mm:cut_bounding_H_mm,
    panels_cnc,
    infill_area_m2,
    labor_days,
    line_items,
    frame_cost:          Math.round(frame_cost),
    infill_cost:         Math.round(infill_cost),
    cutting_cost:        0,
    total_sheets:        chosen?.total_sheets ?? 0,
    glass_hardware_cost: 0,
    labor_cost:          Math.round(labor_cost),
    subtotal:     Math.round(subtotal),
    fabrication_per_day: prices.fabrication_per_day,
  }
}

export function generateStaircaseGrasshopperParams(
  survey: StaircaseSurvey,
  calc: StaircaseEstimationResult,
  projectCode: string
): object {
  return {
    project_id:    projectCode,
    project_type:  'staircase',
    geometry: {
      total_rise_mm:   survey.total_rise,
      total_run_mm:    survey.total_run,
      width_mm:        survey.width,
      stringer_length_mm: Math.round(calc.stringer_length_m * 1000),
      slope_angle_deg: calc.slope_angle_deg,
      num_steps:       calc.num_steps,
      step_rise_mm:    calc.step_rise_mm,
      step_going_mm:   calc.step_going_mm,
      num_flights:     survey.num_flights,
    },
    handrail: {
      height_mm:   survey.handrail_height,
      post_count:  calc.post_count,
      num_panels:  calc.num_sections,
      sides:       survey.rail_sides,
      catch_profile: survey.catch_profile ?? '20x20',
    },
    profiles: {
      post:        survey.post_profile,
      top_rail:    survey.top_rail_profile,
      bottom_rail: survey.bottom_rail_profile,
    },
    infill: {
      type:               survey.infill_type,
      // Sheet infill
      sheet_thickness_mm: survey.sheet_thickness,
      sheet_width_mm:     calc.chosen_section.supplier_sheet.width_mm || null,
      sheet_height_mm:    calc.chosen_section.supplier_sheet.height_mm || null,
      // Glass infill
      glass_thickness_mm: survey.glass_thickness,
      glass_system:       survey.glass_system_type ?? (survey.infill_type === 'glass' ? 'framed_post' : null),
      panel_width_mm:     survey.infill_type === 'glass' && survey.glass_system_type !== 'framed_post'
        ? (survey.post_spacing ?? 1000) : null,
      // Flat bar infill
      bar_spacing_mm:     survey.bar_spacing,
    },
    panel_cnc: {
      total_panels:             calc.num_sections * (survey.rail_sides === 'both' ? 2 : 1),
      shape:                    'parallelogram',
      opening_slope_edge_mm:    calc.opening_slope_edge_mm,
      opening_height_mm:        calc.opening_height_mm,
      cut_slope_edge_mm:        calc.cut_slope_edge_mm,
      cut_height_mm:            calc.cut_height_mm,
      interior_angle_deg:       calc.panel_angle_deg,
      slope_angle_deg:          calc.slope_angle_deg,
      bounding_rect_width_mm:   calc.panel_bounding_width_mm,
      bounding_rect_height_mm:  calc.panel_bounding_height_mm,
      panels_per_sheet:         calc.panels_per_sheet,
      note: `Cut ${calc.num_sections * (survey.rail_sides === 'both' ? 2 : 1)} identical pieces. Rotate alternate pieces 180° when nesting to minimize waste.`,
    },
    panels_list:   calc.panels_cnc,
    generated_at:  new Date().toISOString(),
  }
}
