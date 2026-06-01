export type ProjectStatus =
  | 'inquiry'
  | 'site_survey'
  | 'concept_design'
  | 'quotation_sent'
  | 'approved'
  | 'fabrication'
  | 'installation'
  | 'completed'

export type ProjectType =
  | 'balcony'
  | 'staircase'
  | 'railing'
  | 'gate'
  | 'facade'
  | 'ceiling'
  | 'lighting'
  | 'custom'

export type InfillType = 'plain_sheet' | 'glass' | 'flat_bars'
export type PanelLayout = 'full_height' | 'inset'
export type GlassSystemType = 'framed_post' | 'spigot' | 'channel_base' | 'embedded'
export type MountingType = 'wall' | 'floor'
export type WallType = 'concrete' | 'brick' | 'block' | 'other'
export type SteelProfile = '20x20' | '40x20' | '40x40' | '60x40'

export interface Client {
  id: string
  name: string
  phone: string
  email?: string
  company?: string
  created_at: string
}

export interface Project {
  id: string
  project_code: string
  client_id: string
  client?: Client
  type: ProjectType
  status: ProjectStatus
  title: string
  location: string
  notes?: string
  created_at: string
  updated_at: string
}

// One row in the section options comparison table
export interface SectionOption {
  num_sections: number
  section_width_mm: number   // total_length / num_sections
  opening_width_mm: number   // section_width - post_width
  opening_height_mm: number  // total_height - top_rail_h - bottom_rail_h
  cut_width_mm: number       // opening_width + 2×catch_overlap (what CNC cuts)
  cut_height_mm: number      // opening_height + 2×catch_overlap
  supplier_sheet: { width_mm: number; height_mm: number; price: number; name: string; thickness_mm: number }
  waste_width_mm: number
  waste_height_mm: number
  waste_percent: number      // % of supplier sheet that is waste
  total_sheets: number       // ceil(total_panels / panels_per_sheet)
  sheet_cost: number         // total_sheets × supplier_sheet.price
  panels_per_sheet: number   // how many panel cuts fit on one supplier sheet
  structural: boolean        // false if section_width > structural max (2000mm)
  total_cost: number         // full estimated cost for this option
}

export interface BalconySurvey {
  id: string
  project_id: string
  // Geometry
  total_length: number
  total_height: number
  num_sections?: number      // how many panel sections (drives post count & spacing)
  post_spacing?: number      // kept for backward compat — derived as total_length/num_sections
  // Inner catch frame
  catch_profile?: string     // default '20x20'
  // Profiles
  post_profile: SteelProfile
  bottom_rail_profile: SteelProfile
  top_rail_profile: SteelProfile
  // Infill
  infill_type: InfillType
  sheet_thickness?: number
  sheet_width_mm?: number    // supplier sheet width (set by section optimizer)
  sheet_height_mm?: number   // supplier sheet height (set by section optimizer)
  panel_layout?: PanelLayout      // 'full_height' (default) or 'inset'
  panel_height_mm?: number        // inset only: height of the panel itself
  panel_gap_top_mm?: number       // inset only: gap between panel top and top rail
  panel_gap_bottom_mm?: number    // inset only: derived = opening - panel - gap_top
  glass_thickness?: number
  glass_system_type?: GlassSystemType
  bar_profile?: SteelProfile
  bar_spacing?: number
  // Mounting
  mounting_type: MountingType
  wall_type?: WallType
  // Site conditions
  access_difficulty: 'easy' | 'medium' | 'hard'
  site_notes?: string
  photos?: string[]
  created_at: string
}

export interface Estimation {
  id: string
  project_id: string
  survey_id: string
  // Material quantities
  post_count: number
  post_total_length_m: number
  bottom_rail_length_m: number
  top_rail_length_m: number
  infill_area_m2: number
  infill_weight_kg: number
  weld_length_m: number
  base_plates?: number
  anchor_points?: number
  // Costs
  steel_cost: number
  infill_cost: number
  labor_days: number
  labor_cost: number
  design_cutting_cost: number
  installation_cost: number
  total_cost: number
  // Meta
  steel_price_per_kg: number
  labor_rate_per_day: number
  created_at: string
}

export interface Quotation {
  id: string
  project_id: string
  estimation_id: string
  quote_number: string
  valid_until: string
  scope_of_work: string
  payment_terms: string
  timeline_weeks: number
  status: 'draft' | 'sent' | 'approved' | 'rejected'
  created_at: string
}

// Steel profile weights in kg/m (2mm wall thickness)
export const PROFILE_WEIGHTS: Record<SteelProfile, number> = {
  '20x20': 1.12,
  '40x20': 1.83,
  '40x40': 2.37,
  '60x40': 3.06,
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  inquiry: 'Inquiry',
  site_survey: 'Site Survey',
  concept_design: 'Concept Design',
  quotation_sent: 'Quotation Sent',
  approved: 'Approved',
  fabrication: 'Fabrication',
  installation: 'Installation',
  completed: 'Completed',
}

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  inquiry: 'bg-stone-200/80 text-stone-800 dark:bg-stone-700 dark:text-stone-200',
  site_survey: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  concept_design: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  quotation_sent: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  fabrication: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  installation: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  balcony: 'Balcony',
  staircase: 'Staircase',
  railing: 'Railing',
  gate: 'Gate',
  facade: 'Facade',
  ceiling: 'Ceiling',
  lighting: 'Lighting Object',
  custom: 'Custom Element',
}

export interface StaircaseSurvey {
  id: string
  project_id: string
  // Geometry
  total_rise: number        // mm — vertical floor to floor
  total_run: number         // mm — horizontal distance
  width: number             // mm — staircase width
  num_flights: number       // 1 = straight, 2 = with landing
  landing_length?: number   // mm — if 2 flights
  // Handrail
  handrail_height: number   // mm — typically 1000–1100
  post_spacing: number      // mm — along slope (used for glass/flat_bars)
  num_sections?: number     // how many panels (drives post count; for plain_sheet optimizer)
  catch_profile?: string    // inner catch frame profile, default '20x20'
  rail_sides: 'one' | 'both'
  // Profiles
  post_profile: SteelProfile
  top_rail_profile: SteelProfile
  bottom_rail_profile: SteelProfile
  // Infill
  infill_type: InfillType
  sheet_thickness?: number
  sheet_width_mm?: number   // chosen sheet width (e.g. 2440)
  sheet_height_mm?: number  // chosen sheet height (e.g. 1220)
  glass_thickness?: number
  glass_system_type?: GlassSystemType
  bar_profile?: string
  bar_spacing?: number
  // Site
  access_difficulty: 'easy' | 'medium' | 'hard'
  site_notes?: string
  created_at: string
}

export type PriceCategory = 'sheet' | 'profile' | 'cutting' | 'glass' | 'labor'

export interface MaterialPrice {
  id: string
  category: PriceCategory
  name: string
  // Sheet
  thickness_mm?: number
  width_mm?: number
  height_mm?: number
  // Profile
  profile?: string
  wall_thickness_mm?: number
  bar_length_mm?: number
  // Common
  unit: string
  price: number
  is_active: boolean
  updated_at: string
}

// Resolved prices passed into the estimation engine
export interface ResolvedPrices {
  // Sheets: keyed by thickness (default / cheapest per thickness)
  sheets: Record<number, { price: number; width_mm: number; height_mm: number; name: string }>
  // All sheet sizes (for the sheet size picker dropdown)
  allSheets?: Array<{ thickness_mm: number; width_mm: number; height_mm: number; price: number; name: string }>
  // Profiles: keyed by profile code e.g. '40x40'
  profiles: Record<string, { price: number; bar_length_mm: number; name: string }>
  // Cutting: keyed by thickness
  cutting: Record<number, { price: number; name: string }>
  // Glass: keyed by thickness
  glass: Record<number, { price: number; name: string }>
  // Labor
  fabrication_per_day: number
  installation_per_day: number
  // Glass hardware (spigot / channel / top rail)
  glass_hardware?: {
    spigot_price: number
    top_rail_per_m: number
    channel_per_m: number
  }
}
