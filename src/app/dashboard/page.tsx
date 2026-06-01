import { FolderOpen, TrendingUp, Clock, CheckCircle, Wrench } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { getProjects } from '@/app/actions/projects'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let projects: Awaited<ReturnType<typeof getProjects>> = []
  let dbConnected = true

  const requireSupabase = process.env.NEXT_PUBLIC_REQUIRE_SUPABASE === 'true'

  try {
    projects = await getProjects()
  } catch {
    dbConnected = false
    if (requireSupabase) {
      return (
        <main className="max-w-7xl mx-auto px-6 py-16 text-center">
          <h1 className="text-xl font-bold text-foreground">Database connection required</h1>
          <p className="mt-2 text-sm text-muted">
            Set <code className="font-mono bg-surface-muted px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="font-mono bg-surface-muted px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{' '}
            <code className="font-mono bg-surface-muted px-1 rounded">.env.local</code>.
            See <code className="font-mono bg-surface-muted px-1 rounded">.env.example</code> and the README.
          </p>
        </main>
      )
    }
    projects = DEMO_PROJECTS as never
  }

  const active = projects.filter((p) => !['completed'].includes(p.status))
  const inFabrication = projects.filter((p) => p.status === 'fabrication')
  const awaitingApproval = projects.filter((p) => p.status === 'quotation_sent')
  const completedThisMonth = projects.filter((p) => {
    if (p.status !== 'completed') return false
    const d = new Date(p.updated_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const totalPipeline = projects.reduce((sum, p) => {
    const est = (p as { estimations?: { total_cost: number; quoted_price?: number }[] }).estimations?.[0]
    return sum + (est?.quoted_price || est?.total_cost || 0)
  }, 0)

  return (
    <>
      {!dbConnected && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 sm:px-6 py-2 text-center text-sm text-amber-700 dark:text-amber-200">
          Demo mode — Supabase is not connected. Copy <code className="font-mono bg-amber-100 px-1 rounded">.env.example</code> to{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code> and run the SQL migrations in the README.
          {' '}Set <code className="font-mono bg-amber-100 px-1 rounded">NEXT_PUBLIC_REQUIRE_SUPABASE=true</code> in production to disable this fallback.
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Project pipeline and overview</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Active Projects', shortLabel: 'Active', value: active.length, icon: FolderOpen, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/50' },
            { label: 'In Fabrication', shortLabel: 'Fabrication', value: inFabrication.length, icon: Wrench, color: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/50' },
            { label: 'Awaiting Approval', shortLabel: 'Awaiting', value: awaitingApproval.length, icon: Clock, color: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/50' },
            { label: 'Completed This Month', shortLabel: 'Done (month)', value: completedThisMonth.length, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 sm:gap-4 py-4 sm:py-5">
                <div className={`p-2 sm:p-2.5 rounded-lg shrink-0 ${stat.color}`}>
                  <stat.icon size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted leading-tight">
                    <span className="sm:hidden">{stat.shortLabel}</span>
                    <span className="hidden sm:inline">{stat.label}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gray-900 text-white border-0">
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-4 sm:py-5">
            <div className="flex items-center gap-3">
              <TrendingUp size={20} className="text-stone-400 shrink-0" />
              <span className="text-sm text-stone-400">Total Pipeline Value</span>
            </div>
            <span className="text-xl sm:text-2xl font-bold">{formatCurrency(totalPipeline)}</span>
          </CardContent>
        </Card>

        {/* Projects table with client-side filter */}
        <DashboardFilters projects={projects as never} />
      </main>
    </>
  )
}

// Demo data shown before Supabase is connected
const DEMO_PROJECTS = [
  { id: '1', project_code: 'BAL-001', client: { name: 'Kigali Heights Ltd' }, type: 'balcony', status: 'site_survey', title: 'Balcony Railing Block A', location: 'Kigali, Kimihurura', created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-10T00:00:00Z', estimations: [{ total_cost: 4800000 }] },
  { id: '2', project_code: 'BAL-002', client: { name: 'Ubumwe Grande Hotel' }, type: 'balcony', status: 'quotation_sent', title: 'Pool Deck Balcony', location: 'Kigali, Nyarutarama', created_at: '2026-05-05T00:00:00Z', updated_at: '2026-05-12T00:00:00Z', estimations: [{ total_cost: 7200000 }] },
  { id: '3', project_code: 'STA-001', client: { name: 'Private Residence' }, type: 'staircase', status: 'fabrication', title: 'Interior Steel Staircase', location: 'Kigali, Gacuriro', created_at: '2026-04-20T00:00:00Z', updated_at: '2026-05-08T00:00:00Z', estimations: [{ total_cost: 12500000 }] },
  { id: '4', project_code: 'GAT-001', client: { name: 'Rwanda Development Board' }, type: 'gate', status: 'approved', title: 'Main Entrance Gate', location: 'Kigali, CBD', created_at: '2026-05-10T00:00:00Z', updated_at: '2026-05-14T00:00:00Z', estimations: [{ total_cost: 5600000 }] },
  { id: '5', project_code: 'FAC-001', client: { name: 'Vision City Mall' }, type: 'facade', status: 'concept_design', title: 'Parametric Facade Panels', location: 'Kigali, Gaculiro', created_at: '2026-05-12T00:00:00Z', updated_at: '2026-05-13T00:00:00Z', estimations: [{ total_cost: 28000000 }] },
]
