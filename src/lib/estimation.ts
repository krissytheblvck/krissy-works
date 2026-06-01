import type { BalconySurvey, ResolvedPrices, SectionOption } from '@/types'
import { DEFAULT_RESOLVED_PRICES } from '@/lib/default-prices'

const WASTE_PROFILE  = 1.05  // 5% profile off-cut waste
const CATCH_OVERLAP  = 20    // mm sheet overlaps into catch each side
const MAX_SECTION_W  = 2000  // mm — structural max post spacing

export interface MaterialLineItem {
  label: string
  sub: string
  qty: number
  unit: string
  unit_price: number
  total: number
}

export interface BalconyEstimationResult {
  // Section geometry
  num_sections: number
  section_width_mm: number
  opening_width_mm: number
  opening_height_mm: number
  cut_width_mm: number
  cut_height_mm: number
  panels_per_sheet: number
  // Quantities
  post_count: number
  post_total_length_m: number
  bottom_rail_length_m: number
  top_rail_length_m: number
  catch_total_length_m: number
  infill_area_m2: number
  weld_length_m: number
  base_plates: number
  anchor_points: number
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
  // Section comparison
  section_options: SectionOption[]
  chosen_section: SectionOption
  fabrication_per_day: number
}

// Parse profile string e.g. '40x20' → width=40, height=20
function pw(profile: string): number { return Number(profile.split('x')[0]) || 40 }
function ph(profile: string): number { return Number(profile.split('x')[1]) || 40 }

function barsNeeded(totalLengthM: number, barLengthMm: number): number {
  return Math.ceil((totalLengthM / (barLengthMm / 1000)) * WASTE_PROFILE)
}

// How many cut pieces (cw×ch) fit on one supplier sheet (sw×sh)?
// Tries both normal and 90° rotated orientation.
function panelsPerSheet(cw: number, ch: number, sw: number, sh: number): number {
  const normal   = Math.floor(sw / cw) * Math.floor(sh / ch)
  const rotated  = Math.floor(sw / ch) * Math.floor(sh / cw)
  return Math.max(normal, rotated, 0)
}

export function calculateSectionOptions(
  totalLengthMm: number,
  totalHeightMm: number,
  postProfile: string,
  topRailProfile: string,
  bottomRailProfile: string,
  catchProfile: string,
  sheetThickness: number,
  prices: ResolvedPrices,
  sides: number,
  panelHeightMm?: number  // inset layout: panel height < full opening height
): SectionOption[] {
  const postW      = pw(postProfile)
  const topRailH   = ph(topRailProfile)   // narrower face vertical
  const bottomRailH= ph(bottomRailProfile)

  const openingH        = totalHeightMm - topRailH - bottomRailH
  const effectivePanelH = panelHeightMm ?? openingH  // inset uses panel height, not full opening
  const cutH            = effectivePanelH + 2 * CATCH_OVERLAP

  const allSheets  = (prices.allSheets ?? []).filter(s => s.thickness_mm === sheetThickness)
  if (allSheets.length === 0) return []

  const postData   = prices.profiles[postProfile]   ?? { price: 18000, bar_length_mm: 6000 }
  const catchData  = prices.profiles[catchProfile]  ?? { price: 10000, bar_length_mm: 6000 }
  const trData     = prices.profiles[topRailProfile]    ?? { price: 18000, bar_length_mm: 6000 }
  const brData     = prices.profiles[bottomRailProfile] ?? { price: 14000, bar_length_mm: 6000 }
  const cutData    = prices.cutting[sheetThickness] ?? { price: 60000 }
  const lengthM    = totalLengthMm / 1000
  const heightM    = totalHeightMm / 1000
  const openingHM  = effectivePanelH / 1000  // catch frame and infill use panel height

  const options: SectionOption[] = []

  for (let n = 1; n <= 12; n++) {
    const sectionW  = totalLengthMm / n
    const openingW  = sectionW - postW
    if (openingW <= 100) continue          // opening too narrow — skip

    const cutW      = openingW + 2 * CATCH_OVERLAP
    const structural= sectionW <= MAX_SECTION_W

    // Find cheapest supplier sheet where at least 1 panel fits
    const fitting = allSheets
      .filter(s => panelsPerSheet(cutW, cutH, s.width_mm, s.height_mm) >= 1)
      .sort((a, b) => a.price - b.price)
    if (fitting.length === 0) continue

    const sheet         = fitting[0]
    const pps           = panelsPerSheet(cutW, cutH, sheet.width_mm, sheet.height_mm)
    const totalPanels   = n * sides
    const totalSheets   = Math.ceil(totalPanels / pps)

    const wasteW        = Math.round(sheet.width_mm  - cutW)
    const wasteH        = Math.round(sheet.height_mm - cutH)
    const sheetArea     = sheet.width_mm * sheet.height_mm
    const usedArea      = cutW * cutH * pps
    const wastePercent  = Math.round((sheetArea - usedArea) / sheetArea * 100)

    // ── Full cost for this option ─────────────────────────────────────────
    const postCount     = n + 1
    const postLenM      = postCount * heightM
    const catchLenM     = n * 2 * ((openingW / 1000) + openingHM)
    const railLenM      = lengthM

    const postBars      = barsNeeded(postLenM, postData.bar_length_mm)
    const trBars        = barsNeeded(railLenM, trData.bar_length_mm)
    const brBars        = barsNeeded(railLenM, brData.bar_length_mm)
    const catchBars     = barsNeeded(catchLenM, catchData.bar_length_mm)

    const frameCost     = postBars  * postData.price
                        + trBars    * trData.price
                        + brBars    * brData.price
                        + catchBars * catchData.price

    const sheetCost     = totalSheets * sheet.price
    const cuttingCost   = totalSheets * cutData.price
    const accessMult    = 1.0
    const laborDays     = Math.max(Math.ceil((postCount * 0.5 + n * 0.8) * accessMult), 1)
    const laborCost     = laborDays * prices.fabrication_per_day
    const totalCost     = frameCost + sheetCost + cuttingCost + laborCost

    options.push({
      num_sections:      n,
      section_width_mm:  Math.round(sectionW),
      opening_width_mm:  Math.round(openingW),
      opening_height_mm: Math.round(effectivePanelH),
      cut_width_mm:      Math.round(cutW),
      cut_height_mm:     Math.round(cutH),
      supplier_sheet:    { ...sheet },
      waste_width_mm:    wasteW,
      waste_height_mm:   wasteH,
      waste_percent:     wastePercent,
      total_sheets:      totalSheets,
      sheet_cost:        sheetCost,
      panels_per_sheet:  pps,
      structural,
      total_cost:        Math.round(totalCost),
    })
  }

  return options
}

const DEFAULT_GLASS_HW = { spigot_price: 25000, top_rail_per_m: 8000, channel_per_m: 12000 }

function calculateGlassOnlyBalcony(
  survey: BalconySurvey,
  prices: ResolvedPrices,
  glassSys: 'spigot' | 'channel_base' | 'embedded'
): BalconyEstimationResult {
  const lengthM      = survey.total_length / 1000
  const t            = survey.glass_thickness ?? 10
  const panelWidthMm = survey.post_spacing ?? 1000
  const num_panels   = Math.ceil(survey.total_length / panelWidthMm)

  // Channel/embedded: glass is taller by the embedment depth (glass goes into the channel)
  const embedMm      = glassSys === 'embedded' ? 100 : glassSys === 'channel_base' ? 60 : 0
  const glassHeightMm= survey.total_height + embedMm
  const glass_area   = Math.round(num_panels * (panelWidthMm / 1000) * (glassHeightMm / 1000) * 100) / 100

  const glassData    = prices.glass[t] ?? { price: 85000, name: `${t}mm Glass` }
  const infill_cost  = Math.round(glass_area * glassData.price)

  const hw           = prices.glass_hardware ?? DEFAULT_GLASS_HW
  let glass_hardware_cost = 0
  const line_items: MaterialLineItem[] = []

  // Glass panels
  line_items.push({
    label: `Glass Panels — ${t}mm toughened`,
    sub: `${num_panels} panels × ${panelWidthMm}×${glassHeightMm}mm = ${glass_area}m²`,
    qty: glass_area, unit: 'm²', unit_price: glassData.price, total: infill_cost,
  })

  // Spigots (spigot system only)
  if (glassSys === 'spigot') {
    const spigot_count = num_panels + 1
    const cost = spigot_count * hw.spigot_price
    glass_hardware_cost += cost
    line_items.push({
      label: 'Floor-Mount Spigots (Stainless Steel)',
      sub: `${num_panels} panels → ${spigot_count} spigots`,
      qty: spigot_count, unit: 'pc', unit_price: hw.spigot_price, total: cost,
    })
  }

  // Bottom U-channel (channel_base only)
  if (glassSys === 'channel_base') {
    const cost = Math.round(lengthM * hw.channel_per_m)
    glass_hardware_cost += cost
    line_items.push({
      label: 'Aluminium Bottom Channel (U-profile)',
      sub: `${lengthM.toFixed(2)}m`,
      qty: Number(lengthM.toFixed(2)), unit: 'm', unit_price: hw.channel_per_m, total: cost,
    })
  }

  // Top rail — all systems
  const tr_cost = Math.round(lengthM * hw.top_rail_per_m)
  glass_hardware_cost += tr_cost
  line_items.push({
    label: 'Aluminium Top Rail / Handrail',
    sub: `${lengthM.toFixed(2)}m`,
    qty: Number(lengthM.toFixed(2)), unit: 'm', unit_price: hw.top_rail_per_m, total: tr_cost,
  })

  // Labor (installation, no welding)
  const accessMult  = survey.access_difficulty === 'hard' ? 1.5 : survey.access_difficulty === 'medium' ? 1.2 : 1.0
  const mPerDay     = glassSys === 'embedded' ? 3 : glassSys === 'spigot' ? 4 : 5
  const labor_days  = Math.max(Math.ceil((lengthM / mPerDay) * accessMult), 1)
  const labor_cost  = labor_days * prices.fabrication_per_day
  line_items.push({
    label: 'Installation Labor',
    sub: `${labor_days} day(s) × ${prices.fabrication_per_day.toLocaleString()} RWF/day`,
    qty: labor_days, unit: 'day', unit_price: prices.fabrication_per_day, total: labor_cost,
  })

  const subtotal = infill_cost + glass_hardware_cost + labor_cost
  const dummySheet = { width_mm: 0, height_mm: 0, price: 0, name: 'N/A', thickness_mm: t }

  return {
    num_sections: num_panels,
    section_width_mm: panelWidthMm,
    opening_width_mm: panelWidthMm,
    opening_height_mm: survey.total_height,
    cut_width_mm: panelWidthMm,
    cut_height_mm: survey.total_height,
    panels_per_sheet: 1,
    post_count: 0,
    post_total_length_m: 0,
    bottom_rail_length_m: 0,
    top_rail_length_m: Number(lengthM.toFixed(2)),
    catch_total_length_m: 0,
    infill_area_m2: glass_area,
    weld_length_m: 0,
    base_plates: 0,
    anchor_points: 0,
    labor_days,
    line_items,
    frame_cost: 0,
    infill_cost: Math.round(infill_cost),
    cutting_cost: 0,
    total_sheets: 0,
    glass_hardware_cost: Math.round(glass_hardware_cost),
    labor_cost: Math.round(labor_cost),
    subtotal: Math.round(subtotal),
    section_options: [],
    chosen_section: {
      num_sections: num_panels,
      section_width_mm: panelWidthMm,
      opening_width_mm: panelWidthMm,
      opening_height_mm: survey.total_height,
      cut_width_mm: panelWidthMm,
      cut_height_mm: survey.total_height,
      supplier_sheet: dummySheet,
      waste_width_mm: 0, waste_height_mm: 0, waste_percent: 0,
      total_sheets: 0, sheet_cost: 0, panels_per_sheet: 1,
      structural: true, total_cost: Math.round(subtotal),
    },
    fabrication_per_day: prices.fabrication_per_day,
  }
}

export function calculateBalconyEstimation(
  survey: BalconySurvey,
  prices: ResolvedPrices = DEFAULT_RESOLVED_PRICES
): BalconyEstimationResult {
  // Non-framed glass systems (spigot / channel_base / embedded) bypass the steel-frame engine
  if (survey.infill_type === 'glass' && survey.glass_system_type && survey.glass_system_type !== 'framed_post') {
    return calculateGlassOnlyBalcony(survey, prices, survey.glass_system_type)
  }

  const lengthMm    = survey.total_length
  const heightMm    = survey.total_height
  const sides       = 1  // balcony is one face
  const thickness   = survey.sheet_thickness ?? 2
  const catchPro    = survey.catch_profile ?? '20x20'

  const isInset      = survey.panel_layout === 'inset' && !!survey.panel_height_mm
  const panelHeightMm = isInset ? survey.panel_height_mm! : undefined

  const section_options = calculateSectionOptions(
    lengthMm, heightMm,
    survey.post_profile, survey.top_rail_profile, survey.bottom_rail_profile,
    catchPro, thickness, prices, sides,
    panelHeightMm
  )

  // Pick cheapest structurally-valid option, or cheapest overall if none valid
  const validOptions  = section_options.filter(o => o.structural)
  const ranked        = (validOptions.length ? validOptions : section_options)
                        .slice().sort((a, b) => a.total_cost - b.total_cost)

  const chosen_n      = survey.num_sections ?? ranked[0]?.num_sections ?? 3
  const chosen        = section_options.find(o => o.num_sections === chosen_n) ?? ranked[0]

  if (!chosen) throw new Error('No valid section option — check sheet sizes in prices.')

  const {
    section_width_mm, opening_width_mm, opening_height_mm,
    cut_width_mm, cut_height_mm, supplier_sheet, total_sheets, panels_per_sheet: pps,
  } = chosen

  // ── Quantities ─────────────────────────────────────────────────────────────
  const post_count           = chosen_n + 1
  const lengthM              = lengthMm / 1000
  const heightM              = heightMm / 1000
  const openingWM            = opening_width_mm  / 1000
  const openingHM            = opening_height_mm / 1000

  const post_total_length_m  = Math.round(post_count * heightM * 100) / 100
  const bottom_rail_length_m = Math.round(lengthM * 100) / 100
  const top_rail_length_m    = Math.round(lengthM * 100) / 100
  const catch_total_length_m = Math.round(chosen_n * 2 * (openingWM + openingHM) * 100) / 100
  const infill_area_m2       = Math.round(chosen_n * openingWM * openingHM * 100) / 100
  const weld_length_m        = Math.round((post_count * 4 * 0.04 + chosen_n * 0.3) * 10) / 10
  const base_plates          = survey.mounting_type === 'floor' ? post_count : 0
  const anchor_points        = survey.mounting_type === 'wall'  ? post_count * 2 : 0

  // ── Line items ─────────────────────────────────────────────────────────────
  const line_items: MaterialLineItem[] = []

  // Posts
  const postData  = prices.profiles[survey.post_profile] ?? { price: 18000, bar_length_mm: 6000, name: survey.post_profile }
  const postBars  = barsNeeded(post_total_length_m, postData.bar_length_mm)
  line_items.push({
    label: `Posts — ${survey.post_profile}`,
    sub: `${post_count} posts × ${heightMm}mm = ${post_total_length_m}m → ${postBars} bars of ${postData.bar_length_mm/1000}m`,
    qty: postBars, unit: 'bar', unit_price: postData.price, total: postBars * postData.price,
  })

  // Bottom rail
  const brData   = prices.profiles[survey.bottom_rail_profile] ?? { price: 14000, bar_length_mm: 6000, name: survey.bottom_rail_profile }
  const brBars   = barsNeeded(bottom_rail_length_m, brData.bar_length_mm)
  line_items.push({
    label: `Bottom Rail — ${survey.bottom_rail_profile}`,
    sub: `${bottom_rail_length_m}m → ${brBars} bar(s)`,
    qty: brBars, unit: 'bar', unit_price: brData.price, total: brBars * brData.price,
  })

  // Top rail
  const trData   = prices.profiles[survey.top_rail_profile] ?? { price: 18000, bar_length_mm: 6000, name: survey.top_rail_profile }
  const trBars   = barsNeeded(top_rail_length_m, trData.bar_length_mm)
  line_items.push({
    label: `Top Rail — ${survey.top_rail_profile}`,
    sub: `${top_rail_length_m}m → ${trBars} bar(s)`,
    qty: trBars, unit: 'bar', unit_price: trData.price, total: trBars * trData.price,
  })

  // Catch profile (inner frame, all 4 sides of every panel)
  const catchData = prices.profiles[catchPro] ?? { price: 10000, bar_length_mm: 6000, name: catchPro }
  const catchBars = barsNeeded(catch_total_length_m, catchData.bar_length_mm)
  line_items.push({
    label: `Inner Catch Frame — ${catchPro}`,
    sub: `${chosen_n} panels × 4 sides = ${catch_total_length_m}m → ${catchBars} bars`,
    qty: catchBars, unit: 'bar', unit_price: catchData.price, total: catchBars * catchData.price,
  })

  const frame_cost = line_items.reduce((s, i) => s + i.total, 0)

  // ── Infill ─────────────────────────────────────────────────────────────────
  let infill_cost  = 0

  if (survey.infill_type === 'plain_sheet') {
    const sheetPrice  = supplier_sheet.price
    infill_cost       = total_sheets * sheetPrice
    const nestNote    = pps > 1 ? `, ${pps} panels/sheet (nested)` : ''
    const insetNote   = isInset
      ? ` — inset ${survey.panel_height_mm}mm panel, ${survey.panel_gap_top_mm ?? 0}mm top gap`
      : ''
    line_items.push({
      label: `CNC Steel Sheet — ${thickness}mm${insetNote}`,
      sub: `${chosen_n} panels cut to ${cut_width_mm}×${cut_height_mm}mm from ${supplier_sheet.width_mm}×${supplier_sheet.height_mm}mm sheets${nestNote} | ${chosen.waste_percent}% waste`,
      qty: total_sheets, unit: 'sheet', unit_price: sheetPrice, total: infill_cost,
    })

    // CNC cutting cost is NOT added here — it's an editable per-job field in Variable Costs

  } else if (survey.infill_type === 'glass') {
    const t         = survey.glass_thickness ?? 10
    const glassData = prices.glass[t] ?? { price: 85000 }
    infill_cost     = Math.round(infill_area_m2 * glassData.price)
    line_items.push({
      label: `Glass — ${t}mm`,
      sub: `${chosen_n} panels × ${opening_width_mm}×${opening_height_mm}mm = ${infill_area_m2}m²`,
      qty: infill_area_m2, unit: 'm²', unit_price: glassData.price, total: infill_cost,
    })

  } else if (survey.infill_type === 'flat_bars') {
    const barProfile = survey.bar_profile ?? '40x20'
    const spacing_m  = (survey.bar_spacing ?? 100) / 1000
    const barsPerPanel = Math.floor(openingHM / spacing_m) + 1
    const totalBarLenM = barsPerPanel * chosen_n * openingWM
    const fbData     = prices.profiles[barProfile] ?? { price: 14000, bar_length_mm: 6000 }
    const fbBars     = barsNeeded(totalBarLenM, fbData.bar_length_mm)
    infill_cost      = fbBars * fbData.price
    line_items.push({
      label: `Flat Bars — ${barProfile}`,
      sub: `${barsPerPanel} bars/panel × ${chosen_n} panels = ${fbBars} bars of ${fbData.bar_length_mm/1000}m`,
      qty: fbBars, unit: 'bar', unit_price: fbData.price, total: infill_cost,
    })
  }

  // ── Labor ───────────────────────────────────────────────────────────────────
  const accessMult  = survey.access_difficulty === 'hard' ? 1.5
    : survey.access_difficulty === 'medium' ? 1.2 : 1.0
  const labor_days  = Math.max(Math.ceil((post_count * 0.5 + chosen_n * 0.8) * accessMult), 1)
  const labor_cost  = labor_days * prices.fabrication_per_day
  line_items.push({
    label: 'Fabrication Labor',
    sub: `${labor_days} day(s) × ${prices.fabrication_per_day.toLocaleString()} RWF/day`,
    qty: labor_days, unit: 'day', unit_price: prices.fabrication_per_day, total: labor_cost,
  })

  const cutting_cost = 0  // CNC is per-job variable cost, not fixed in estimation
  const subtotal = frame_cost + infill_cost + labor_cost

  return {
    num_sections: chosen_n,
    section_width_mm,
    opening_width_mm,
    opening_height_mm,
    cut_width_mm,
    cut_height_mm,
    panels_per_sheet: pps,
    post_count,
    post_total_length_m,
    bottom_rail_length_m,
    top_rail_length_m,
    catch_total_length_m,
    infill_area_m2,
    weld_length_m,
    base_plates,
    anchor_points,
    labor_days,
    line_items,
    frame_cost:          Math.round(frame_cost),
    infill_cost:         Math.round(infill_cost),
    cutting_cost:        0,
    total_sheets:        survey.infill_type === 'plain_sheet' ? chosen.total_sheets : 0,
    glass_hardware_cost: 0,
    labor_cost:          Math.round(labor_cost),
    subtotal:     Math.round(subtotal),
    section_options,
    chosen_section: chosen,
    fabrication_per_day: prices.fabrication_per_day,
  }
}

export function generateGrasshopperParams(
  survey: BalconySurvey,
  projectCode: string,
  prices: ResolvedPrices = DEFAULT_RESOLVED_PRICES
): object {
  const thickness   = survey.sheet_thickness ?? 2
  const defaultSheet= prices.sheets[thickness] ?? { width_mm: 2000, height_mm: 1000, name: null }
  return {
    project_id:   projectCode,
    project_type: 'balcony',
    geometry: {
      length:       survey.total_length,
      height:       survey.total_height,
      num_sections: survey.num_sections,
      post_spacing: survey.post_spacing,
    },
    profiles: {
      post:         survey.post_profile,
      bottom_rail:  survey.bottom_rail_profile,
      top_rail:     survey.top_rail_profile,
      catch:        survey.catch_profile ?? '20x20',
    },
    infill: {
      type:             survey.infill_type,
      // Sheet infill
      sheet_thickness:  thickness,
      sheet_width_mm:   survey.sheet_width_mm ?? defaultSheet.width_mm,
      sheet_height_mm:  survey.sheet_height_mm ?? defaultSheet.height_mm,
      panel_layout:     survey.panel_layout ?? 'full_height',
      panel_height_mm:  survey.panel_layout === 'inset' ? (survey.panel_height_mm ?? null) : null,
      panel_gap_top_mm: survey.panel_layout === 'inset' ? (survey.panel_gap_top_mm ?? 0) : null,
      // Glass infill
      glass_thickness:  survey.glass_thickness,
      glass_system:     survey.glass_system_type ?? (survey.infill_type === 'glass' ? 'framed_post' : null),
      // For non-framed glass: panel_width replaces post_spacing
      panel_width_mm:   survey.infill_type === 'glass' && survey.glass_system_type !== 'framed_post'
        ? (survey.post_spacing ?? 1000) : null,
      // Flat bar infill
      bar_profile:      survey.bar_profile,
      bar_spacing:      survey.bar_spacing,
    },
    mounting: {
      type:      survey.mounting_type,
      wall_type: survey.wall_type,
    },
    generated_at: new Date().toISOString(),
  }
}
