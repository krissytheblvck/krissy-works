'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, UserCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ProjectType } from '@/types'
import { PROJECT_TYPE_LABELS } from '@/types'
import { createProject } from '@/app/actions/projects'
import { searchClients } from '@/app/actions/clients'

const PROJECT_TYPE_OPTIONS = Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => ({ value, label }))

interface ClientSuggestion {
  id: string
  name: string
  phone: string
  email: string | null
  company: string | null
}

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Client search
  const [clientQuery, setClientQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientSuggestion | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    client_name: '',
    client_phone: '',
    client_email: '',
    client_company: '',
    type: 'balcony' as ProjectType,
    title: '',
    location: '',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleClientSearch = useCallback((query: string) => {
    setClientQuery(query)
    setSelectedClient(null)
    set('client_name', query)

    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (query.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    searchTimeout.current = setTimeout(async () => {
      const results = await searchClients(query)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    }, 200)
  }, [])

  function selectClient(c: ClientSuggestion) {
    setSelectedClient(c)
    setClientQuery(c.name)
    setForm((prev) => ({
      ...prev,
      client_name: c.name,
      client_phone: c.phone,
      client_email: c.email ?? '',
      client_company: c.company ?? '',
    }))
    setSuggestions([])
    setShowSuggestions(false)
  }

  function clearSelectedClient() {
    setSelectedClient(null)
    setClientQuery('')
    setForm((prev) => ({ ...prev, client_name: '', client_phone: '', client_email: '', client_company: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const submitData = selectedClient
        ? { ...form, client_id: selectedClient.id }
        : form

      const project = await createProject(submitData)
      router.push(`/projects/${project.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to save: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">New Project</h1>
        <p className="text-sm text-muted mt-1">Fill in client and project details</p>
      </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Client Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client search / select */}
              <div className="sm:col-span-2 flex flex-col gap-1 relative">
                <label className="text-sm font-medium text-foreground">Search Existing Client</label>
                {selectedClient ? (
                  <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 px-3 py-2">
                    <UserCheck size={16} className="text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800">{selectedClient.name}</p>
                      <p className="text-xs text-green-600">{selectedClient.phone}{selectedClient.company ? ` · ${selectedClient.company}` : ''}</p>
                    </div>
                    <button type="button" onClick={clearSelectedClient}
                      className="text-xs text-green-600 hover:text-green-800 flex-shrink-0">
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        placeholder="Search by name or phone..."
                        value={clientQuery}
                        onChange={(e) => handleClientSearch(e.target.value)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        autoComplete="off"
                      />
                    </div>
                    {showSuggestions && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
                        {suggestions.map((s) => (
                          <button key={s.id} type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-surface-hover transition-colors border-b border-border last:border-0"
                            onMouseDown={() => selectClient(s)}>
                            <p className="text-sm font-medium text-foreground">{s.name}</p>
                            <p className="text-xs text-muted">{s.phone}{s.company ? ` · ${s.company}` : ''}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Manual fields — hidden when existing client selected */}
              {!selectedClient && (
                <>
                  <Input id="client_name" label="Client Name *" placeholder="e.g. Kigali Heights Ltd"
                    value={form.client_name} onChange={(e) => set('client_name', e.target.value)} required />
                  <Input id="client_phone" label="Phone *" placeholder="+250 7XX XXX XXX"
                    value={form.client_phone} onChange={(e) => set('client_phone', e.target.value)} required />
                  <Input id="client_email" label="Email" type="email" placeholder="client@email.com"
                    value={form.client_email} onChange={(e) => set('client_email', e.target.value)} />
                  <Input id="client_company" label="Company" placeholder="Optional"
                    value={form.client_company} onChange={(e) => set('client_company', e.target.value)} />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select id="type" label="Project Type *" options={PROJECT_TYPE_OPTIONS}
                value={form.type} onChange={(e) => set('type', e.target.value)} />
              <Input id="title" label="Project Title *" placeholder="e.g. Balcony Railing Block A"
                value={form.title} onChange={(e) => set('title', e.target.value)} required />
              <Input id="location" label="Site Location *" placeholder="e.g. Kigali, Kimihurura"
                value={form.location} onChange={(e) => set('location', e.target.value)}
                required className="sm:col-span-2" />
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label htmlFor="notes" className="text-sm font-medium text-foreground">Initial Notes</label>
                <textarea id="notes" rows={3} placeholder="Any initial notes..."
                  value={form.notes} onChange={(e) => set('notes', e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none" />
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end">
            <Link href="/dashboard">
              <Button variant="secondary" type="button">Cancel</Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project →'}
            </Button>
          </div>
        </form>
    </main>
  )
}
