'use server'

import { createServerClient } from '@/lib/supabase-server'
import type { StaircaseSurvey } from '@/types'
import { calculateStaircaseEstimation } from '@/lib/staircase-estimation'
import { getResolvedPrices } from '@/app/actions/prices'
import { revalidatePath } from 'next/cache'

export async function saveStaircaseSurveyAndEstimation(
  projectId: string,
  survey: Omit<StaircaseSurvey, 'id' | 'project_id' | 'created_at'>,
  designCuttingCost: number,
  installationCost: number,
  pricing: {
    consumablesPercent: number
    surfaceTreatmentType: string
    surfaceTreatmentRate: number
    transportCost: number
    hardwareCost: number
    contingencyPercent: number
    marginPercent: number
    quotedPrice: number
  }
) {
  const db = createServerClient()

  // Save survey
  const { data: savedSurvey, error: surveyError } = await db
    .from('staircase_surveys')
    .upsert({ ...survey, project_id: projectId }, { onConflict: 'project_id' })
    .select()
    .single()

  if (surveyError) throw new Error(surveyError.message)

  // Calculate estimation
  const prices = await getResolvedPrices()
  const calc = calculateStaircaseEstimation(survey as StaircaseSurvey, prices)

  const total_cost = calc.subtotal + designCuttingCost + installationCost

  // Save estimation (reuse same estimations table)
  const { data: estimation, error: estError } = await db
    .from('estimations')
    .upsert(
      {
        project_id: projectId,
        survey_id: savedSurvey.id,
        post_count: calc.post_count,
        post_total_length_m: calc.post_total_length_m,
        bottom_rail_length_m: calc.bottom_rail_length_m,
        top_rail_length_m: calc.top_rail_length_m,
        infill_area_m2: calc.infill_area_m2,
        infill_weight_kg: 0,
        weld_length_m: 0,
        base_plates: 0,
        anchor_points: 0,
        steel_cost: calc.frame_cost,
        infill_cost: calc.infill_cost + calc.cutting_cost,
        labor_days: calc.labor_days,
        labor_cost: calc.labor_cost,
        design_cutting_cost: designCuttingCost,
        installation_cost: installationCost,
        consumables_percent: pricing.consumablesPercent,
        surface_treatment_type: pricing.surfaceTreatmentType,
        surface_treatment_rate: pricing.surfaceTreatmentRate,
        transport_cost: pricing.transportCost,
        hardware_cost: pricing.hardwareCost,
        contingency_percent: pricing.contingencyPercent,
        margin_percent: pricing.marginPercent,
        quoted_price: pricing.quotedPrice,
        total_cost,
        steel_price_per_kg: 0,
        labor_rate_per_day: prices.fabrication_per_day,
      },
      { onConflict: 'project_id' }
    )
    .select()
    .single()

  if (estError) throw new Error(estError.message)

  // Move to concept_design
  await db.from('projects').update({ status: 'concept_design' }).eq('id', projectId)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')

  return { survey: savedSurvey, estimation }
}
