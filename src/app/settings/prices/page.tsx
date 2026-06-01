import { getPrices } from '@/app/actions/prices'
import { PricesClient } from '@/components/settings/PricesClient'

export const dynamic = 'force-dynamic'

export default async function PricesPage() {
  let prices: Awaited<ReturnType<typeof getPrices>> = []
  try {
    prices = await getPrices()
  } catch {
    prices = []
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Material Price List</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update prices when market rates change — all future estimates use these values automatically
        </p>
      </div>
      <PricesClient initialPrices={prices} />
    </main>
  )
}
