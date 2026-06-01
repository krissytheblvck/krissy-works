'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function getClients() {
  const db = createServerClient()

  const { data, error } = await db
    .from('clients')
    .select(`
      *,
      projects(id, project_code, type, status, title, location, created_at, updated_at,
        estimations(quoted_price, total_cost)
      )
    `)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function getClient(id: string) {
  const db = createServerClient()

  const { data, error } = await db
    .from('clients')
    .select(`
      *,
      projects(*, estimations(quoted_price, total_cost))
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateClient(id: string, data: {
  name: string
  phone: string
  email?: string
  company?: string
}) {
  const db = createServerClient()

  const { error } = await db
    .from('clients')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
}

export async function searchClients(query: string) {
  const db = createServerClient()

  const { data, error } = await db
    .from('clients')
    .select('id, name, phone, email, company')
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .order('name')
    .limit(10)

  if (error) return []
  return data
}
