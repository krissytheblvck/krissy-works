import { NextResponse } from 'next/server'
import { getPrices } from '@/app/actions/prices'

export async function GET() {
  try {
    const prices = await getPrices()
    return NextResponse.json(prices)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
