'use server'

import { createServerClient } from '@/lib/supabase-server'
import type { MaterialPrice, ResolvedPrices } from '@/types'
import { revalidatePath } from 'next/cache'
import { DEFAULT_RESOLVED_PRICES } from '@/lib/default-prices'

export async function getPrices(): Promise<MaterialPrice[]> {
  const db = createServerClient()
  const { data, error } = await db
    .from('material_prices')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('thickness_mm', { nullsFirst: true })
    .order('name')

  if (error) throw new Error(error.message)
  return data
}

export async function upsertPrice(price: Partial<MaterialPrice> & { id?: string }) {
  const db = createServerClient()

  if (price.id) {
    const { error } = await db
      .from('material_prices')
      .update({ ...price, updated_at: new Date().toISOString() })
      .eq('id', price.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db
      .from('material_prices')
      .insert({ ...price, is_active: true })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/settings/prices')
}

export async function deletePrice(id: string) {
  const db = createServerClient()
  const { error } = await db
    .from('material_prices')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/prices')
}

export async function getResolvedPrices(): Promise<ResolvedPrices> {
  let prices: MaterialPrice[] = []
  try {
    prices = await getPrices()
  } catch {
    // Return defaults if DB not connected
    return DEFAULT_RESOLVED_PRICES
  }

  const resolved: ResolvedPrices = {
    sheets: {},
    allSheets: [],
    profiles: {},
    cutting: {},
    glass: {},
    fabrication_per_day: 15000,
    installation_per_day: 15000,
  }

  for (const p of prices) {
    if (p.category === 'sheet' && p.thickness_mm && p.width_mm && p.height_mm) {
      // Collect every sheet size
      resolved.allSheets!.push({
        thickness_mm: p.thickness_mm,
        width_mm: p.width_mm,
        height_mm: p.height_mm,
        price: p.price,
        name: p.name,
      })
      // sheets[thickness] = cheapest (most conservative default)
      if (!resolved.sheets[p.thickness_mm] || p.price < resolved.sheets[p.thickness_mm].price) {
        resolved.sheets[p.thickness_mm] = {
          price: p.price,
          width_mm: p.width_mm,
          height_mm: p.height_mm,
          name: p.name,
        }
      }
    }
    if (p.category === 'profile' && p.profile) {
      resolved.profiles[p.profile] = {
        price: p.price,
        bar_length_mm: p.bar_length_mm ?? 6000,
        name: p.name,
      }
    }
    if (p.category === 'cutting' && p.thickness_mm) {
      resolved.cutting[p.thickness_mm] = { price: p.price, name: p.name }
    }
    if (p.category === 'glass' && p.thickness_mm) {
      resolved.glass[p.thickness_mm] = { price: p.price, name: p.name }
    }
    if (p.category === 'labor') {
      if (p.name.toLowerCase().includes('install')) {
        resolved.installation_per_day = p.price
      } else {
        resolved.fabrication_per_day = p.price
      }
    }
  }

  return resolved
}

