'use server'

import { createServerClient } from '@/lib/supabase-server'
import type { BalconySurvey, ProjectType } from '@/types'
import { calculateBalconyEstimation } from '@/lib/estimation'
import { getResolvedPrices } from '@/app/actions/prices'
import { revalidatePath } from 'next/cache'

export async function createProject(data: {
  client_name: string
  client_phone: string
  client_email?: string
  client_company?: string
  client_id?: string
  type: ProjectType
  title: string
  location: string
  notes?: string
}) {
  const db = createServerClient()

  // 1. Create or reuse client
  let clientId: string

  if (data.client_id) {
    clientId = data.client_id
  } else {
    const { data: client, error: clientError } = await db
      .from('clients')
      .insert({
        name: data.client_name,
        phone: data.client_phone,
        email: data.client_email || null,
        company: data.client_company || null,
      })
      .select()
      .single()

    if (clientError) throw new Error(clientError.message)
    clientId = client.id
  }

  // 2. Generate project code
  const prefix = data.type.slice(0, 3).toUpperCase()
  const { count } = await db
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('type', data.type)

  const num = String((count ?? 0) + 1).padStart(3, '0')
  const project_code = `${prefix}-${num}`

  // 3. Create project
  const { data: project, error: projectError } = await db
    .from('projects')
    .insert({
      project_code,
      client_id: clientId,
      type: data.type,
      title: data.title,
      location: data.location,
      notes: data.notes || null,
      status: 'inquiry',
    })
    .select()
    .single()

  if (projectError) throw new Error(projectError.message)

  revalidatePath('/dashboard')
  return project
}

export async function getProjects() {
  const db = createServerClient()

  const { data, error } = await db
    .from('projects')
    .select(`
      *,
      client:clients(name, phone, email, company),
      estimations(total_cost, quoted_price)
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function getProject(id: string) {
  const db = createServerClient()

  const { data, error } = await db
    .from('projects')
    .select(`
      *,
      client:clients(*),
      balcony_surveys(*),
      staircase_surveys(*),
      estimations(*),
      quotations(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateProjectStatus(id: string, status: string) {
  const db = createServerClient()

  const { error } = await db
    .from('projects')
    .update({ status })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${id}`)
  revalidatePath('/dashboard')
}

export async function saveAreaSurvey(
  projectId: string,
  surveyId: string | null,
  areaName: string,
  survey: Omit<BalconySurvey, 'id' | 'project_id' | 'created_at'>,
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
): Promise<{ surveyId: string; estimationId: string }> {
  const db = createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let savedSurvey: any

  if (surveyId) {
    const { data, error } = await db
      .from('balcony_surveys')
      .update({ ...survey, name: areaName, project_id: projectId })
      .eq('id', surveyId)
      .eq('project_id', projectId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    savedSurvey = data
  } else {
    const { data, error } = await db
      .from('balcony_surveys')
      .insert({ ...survey, name: areaName, project_id: projectId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    savedSurvey = data
  }

  const prices = await getResolvedPrices()
  const calc = calculateBalconyEstimation(survey as BalconySurvey, prices)
  const total_cost = calc.subtotal + designCuttingCost + installationCost

  const estPayload = {
    project_id: projectId,
    survey_id: savedSurvey.id,
    post_count: calc.post_count,
    post_total_length_m: calc.post_total_length_m,
    bottom_rail_length_m: calc.bottom_rail_length_m,
    top_rail_length_m: calc.top_rail_length_m,
    infill_area_m2: calc.infill_area_m2,
    infill_weight_kg: 0,
    weld_length_m: calc.weld_length_m,
    base_plates: calc.base_plates,
    anchor_points: calc.anchor_points,
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
  }

  const { data: existingEst } = await db
    .from('estimations')
    .select('id')
    .eq('survey_id', savedSurvey.id)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let estimation: any
  if (existingEst) {
    const { data, error } = await db
      .from('estimations')
      .update(estPayload)
      .eq('id', existingEst.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    estimation = data
  } else {
    const { data, error } = await db
      .from('estimations')
      .insert(estPayload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    estimation = data
  }

  await db.from('projects').update({ status: 'concept_design' }).eq('id', projectId)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')

  return { surveyId: savedSurvey.id, estimationId: estimation.id }
}

export async function deleteAreaSurvey(surveyId: string, projectId: string) {
  const db = createServerClient()
  await db.from('estimations').delete().eq('survey_id', surveyId).eq('project_id', projectId)
  const { error } = await db
    .from('balcony_surveys')
    .delete()
    .eq('id', surveyId)
    .eq('project_id', projectId)
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
}

export async function saveQuotation(
  projectId: string,
  estimationId: string,
  data: {
    scope_of_work: string
    payment_terms: string
    timeline_weeks: number
    valid_days: number
  }
) {
  const db = createServerClient()

  const { count } = await db
    .from('quotations')
    .select('*', { count: 'exact', head: true })

  const quoteNumber = `QUO-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + data.valid_days)

  const { data: quotation, error } = await db
    .from('quotations')
    .upsert(
      {
        project_id: projectId,
        estimation_id: estimationId,
        quote_number: quoteNumber,
        valid_until: validUntil.toISOString().split('T')[0],
        scope_of_work: data.scope_of_work,
        payment_terms: data.payment_terms,
        timeline_weeks: data.timeline_weeks,
        status: 'draft',
      },
      { onConflict: 'project_id' }
    )
    .select()
    .single()

  if (error) throw new Error(error.message)

  await db
    .from('projects')
    .update({ status: 'quotation_sent' })
    .eq('id', projectId)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')

  return quotation
}
