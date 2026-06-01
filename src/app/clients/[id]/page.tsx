'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, FolderOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, PROJECT_TYPE_LABELS } from '@/types'
import { getClient, updateClient } from '@/app/actions/clients'

type Client = Awaited<ReturnType<typeof getClient>>

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')

  useEffect(() => {
    getClient(id).then((c) => {
      setClient(c)
      setName(c.name)
      setPhone(c.phone)
      setEmail(c.email ?? '')
      setCompany(c.company ?? '')
      setLoading(false)
    }).catch(() => {
      setError('Client not found')
      setLoading(false)
    })
  }, [id])

  async function handleSave() {
    if (!name.trim() || !phone.trim()) return
    setSaving(true)
    setError('')
    try {
      await updateClient(id, { name, phone, email: email || undefined, company: company || undefined })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  if (error && !client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  const projects = client?.projects ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalValue = projects.reduce((sum: number, p: any) => {
    const est = p.estimations?.[0]
    return sum + (est?.quoted_price || est?.total_cost || 0)
  }, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/clients">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={16} /> Clients
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{client?.name}</h1>
            <p className="text-sm text-gray-500">
              {projects.length} project{projects.length !== 1 ? 's' : ''} · {formatCurrency(totalValue)} total
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Edit client */}
        <Card>
          <CardHeader><CardTitle>Client Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="name" label="Name *" value={name}
              onChange={(e) => setName(e.target.value)} />
            <Input id="phone" label="Phone *" value={phone}
              onChange={(e) => setPhone(e.target.value)} />
            <Input id="email" label="Email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} />
            <Input id="company" label="Company" value={company}
              onChange={(e) => setCompany(e.target.value)} />
            <div className="sm:col-span-2 flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving || !name.trim() || !phone.trim()}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen size={16} /> Projects
              </CardTitle>
              <Link href="/projects/new">
                <Button size="sm" variant="secondary">New Project</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {projects.length === 0 ? (
              <p className="text-sm text-gray-400 px-6 py-8 text-center">No projects yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {projects.map((p: any) => {
                    const est = p.estimations?.[0]
                    const value = est?.quoted_price || est?.total_cost || 0
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3">
                          <Link href={`/projects/${p.id}`} className="group">
                            <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{p.project_code}</p>
                            <p className="text-xs text-gray-400">{p.title}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {PROJECT_TYPE_LABELS[p.type as keyof typeof PROJECT_TYPE_LABELS] ?? p.type}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={STATUS_COLORS[p.status as keyof typeof STATUS_COLORS] ?? 'bg-gray-100 text-gray-600'}>
                            {STATUS_LABELS[p.status as keyof typeof STATUS_LABELS] ?? p.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-gray-900">
                          {value ? formatCurrency(value) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-6 py-3 text-right font-bold text-gray-900">{formatCurrency(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
