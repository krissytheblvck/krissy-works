import Link from 'next/link'
import { Users, FolderOpen, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { getClients } from '@/app/actions/clients'
import { STATUS_COLORS, STATUS_LABELS } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        <p className="text-sm text-muted mt-1">{clients.length} client{clients.length !== 1 ? 's' : ''} total</p>
      </div>
        {clients.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No clients yet. Create a project to add your first client.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clients.map((client) => {
              const projects = client.projects ?? []
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const totalValue = projects.reduce((sum: number, p: any) => {
                const est = p.estimations?.[0]
                return sum + (est?.quoted_price || est?.total_cost || 0)
              }, 0)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const activeProjects = projects.filter(
                (p: any) => !['completed', 'cancelled'].includes(p.status)
              )

              return (
                <Link key={client.id} href={`/clients/${client.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="py-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{client.name}</p>
                          {client.company && (
                            <p className="text-xs text-muted truncate">{client.company}</p>
                          )}
                          <p className="text-xs text-muted mt-0.5">{client.phone}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-foreground">{formatCurrency(totalValue)}</p>
                          <p className="text-xs text-muted">total value</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <FolderOpen size={12} />
                          {projects.length} project{projects.length !== 1 ? 's' : ''}
                        </span>
                        {activeProjects.length > 0 && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <TrendingUp size={12} />
                            {activeProjects.length} active
                          </span>
                        )}
                      </div>

                      {projects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {projects.slice(0, 4).map((p: any) => (
                            <Badge
                              key={p.id}
                              className={`text-xs ${STATUS_COLORS[p.status as keyof typeof STATUS_COLORS] ?? 'bg-surface-muted text-muted'}`}
                            >
                              {p.project_code}
                            </Badge>
                          ))}
                          {projects.length > 4 && (
                            <span className="text-xs text-muted self-center">+{projects.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
    </main>
  )
}
