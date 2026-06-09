'use client'

import { useState } from 'react'
import { Download, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { saveQuotation } from '@/app/actions/projects'
import { getAreaLineLabel, getDefaultScopeText } from '@/lib/quotation-scope'
import type { ProjectType } from '@/types'
import { FeedbackBanner } from '@/components/ui/feedback-banner'

interface PricingBreakdown {
  consumablesCost: number
  consumablesPercent: number
  surfaceTreatmentCost: number
  surfaceTreatmentType: string
  surfaceTreatmentRate: number
  transportCost: number
  hardwareCost: number
  designCuttingCost: number
  installationCost: number
  directTotal: number
  contingencyPercent: number
  contingencyCost: number
  adjustedCost: number
  marginPercent: number
  marginCost: number
  quotedPrice: number
}

interface AreaForQuot {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  survey: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  estimation: any | null
  cncCuttingCost: number
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any
  projectType: ProjectType
  areas: AreaForQuot[]
  pricing: PricingBreakdown
  estimationId: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingQuotation: any
  isDemo: boolean
  elementId?: string
}

function buildClientCategories(areas: AreaForQuot[], pricing: PricingBreakdown, projectType: ProjectType) {
  const cats: { label: string; desc: string; raw: number }[] = []

  const readyAreas = areas.filter(a => a.estimation)

  if (readyAreas.length === 1) {
    // Single area — detailed breakdown
    const { survey, estimation, cncCuttingCost } = readyAreas[0]
    const isGlassOnly = survey.infill_type === 'glass' &&
      survey.glass_system_type && survey.glass_system_type !== 'framed_post'

    const frameCost = isGlassOnly
      ? (estimation.labor_cost ?? 0)
      : (estimation.frame_cost ?? 0) + (estimation.labor_cost ?? 0) + pricing.consumablesCost
    const infillCost = (estimation.infill_cost ?? 0) + (estimation.cutting_cost ?? 0) +
      (estimation.glass_hardware_cost ?? 0)

    const glassSysLabel: Record<string, string> = {
      spigot: 'Spigot (frameless)', channel_base: 'Channel base', embedded: 'Embedded in slab',
    }
    const infillDesc = survey.infill_type === 'plain_sheet'
      ? `${survey.sheet_thickness ?? 2}mm plain steel sheet panels`
      : survey.infill_type === 'glass' && isGlassOnly
      ? `${survey.glass_thickness ?? 10}mm toughened glass — ${glassSysLabel[survey.glass_system_type] ?? ''} system`
      : survey.infill_type === 'glass'
      ? `${survey.glass_thickness ?? 10}mm toughened glass panels`
      : 'Flat bar infill'

    cats.push(
      {
        label: isGlassOnly ? 'Installation Labor' : 'Steel Frame & Fabrication',
        desc:  isGlassOnly ? 'On-site installation, setting and sealing' : `Posts, rails, catch frame, welding — ${survey.post_profile ?? '40x40'}`,
        raw:   frameCost,
      },
      ...(infillCost > 0 ? [{ label: 'Infill Panels', desc: infillDesc, raw: infillCost }] : []),
      ...(cncCuttingCost > 0 ? [{ label: 'CNC / Laser Cutting', desc: 'Laser cutting of infill panels', raw: cncCuttingCost }] : []),
    )
  } else {
    // Multiple areas — one line per area (frame + infill + cnc only; install is project-level)
    for (const area of readyAreas) {
      const { estimation, cncCuttingCost } = area
      const areaRaw = (estimation.frame_cost ?? 0) + (estimation.labor_cost ?? 0) +
        (estimation.infill_cost ?? 0) + (estimation.cutting_cost ?? 0) +
        (estimation.glass_hardware_cost ?? 0) + cncCuttingCost
      cats.push({
        label: getAreaLineLabel(projectType, area.name),
        desc:  `${area.survey.total_length ?? 0}mm × ${area.survey.total_height ?? 0}mm`,
        raw:   areaRaw,
      })
    }
    if (pricing.consumablesCost > 0) {
      cats.push({ label: 'Welding Consumables', desc: 'Welding rods, wire, gas', raw: pricing.consumablesCost })
    }
  }

  // Shared project-level costs (installation is always project-level)
  if (pricing.installationCost > 0) {
    cats.push({ label: 'Installation', desc: 'On-site fitting and commissioning', raw: pricing.installationCost })
  }
  if (pricing.surfaceTreatmentCost > 0) {
    cats.push({
      label: 'Surface Treatment',
      desc: pricing.surfaceTreatmentType === 'powder_coat' ? 'Powder coat finish' : 'Paint & primer finish',
      raw: pricing.surfaceTreatmentCost,
    })
  }
  if (pricing.transportCost > 0) {
    cats.push({ label: 'Transport & Delivery', desc: 'Delivery to site', raw: pricing.transportCost })
  }
  if (pricing.hardwareCost > 0) {
    cats.push({ label: 'Hardware & Fixings', desc: 'Anchors, bolts, fixings', raw: pricing.hardwareCost })
  }

  // Compute proportional quoted amounts, last absorbs rounding
  const multiplier = pricing.directTotal > 0 ? pricing.quotedPrice / pricing.directTotal : 1
  const amounts = cats.map(c => Math.round(c.raw * multiplier))
  if (amounts.length > 0) {
    const sumRest = amounts.slice(0, -1).reduce((a, b) => a + b, 0)
    amounts[amounts.length - 1] = pricing.quotedPrice - sumRest
  }

  return cats.map((c, i) => ({ ...c, amount: amounts[i] }))
}

export function QuotationTab({ project, projectType, areas, pricing, estimationId, existingQuotation, isDemo, elementId }: Props) {
  const [timelineWeeks, setTimelineWeeks] = useState<number>(existingQuotation?.timeline_weeks ?? 3)
  const [paymentTerms, setPaymentTerms] = useState(existingQuotation?.payment_terms ?? '50% deposit on approval, 50% on completion')
  const [scopeNotes, setScopeNotes] = useState(existingQuotation?.scope_of_work ?? '')
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadingInvoice, setDownloadingInvoice] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; variant: 'error' | 'success' } | null>(null)
  const [quoteNumber] = useState(existingQuotation?.quote_number ?? `QUO-${new Date().getFullYear()}-DRAFT`)

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 30)
  const validUntilStr = validUntil.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const clientCategories = buildClientCategories(areas, pricing, projectType)

  const scopeText = getDefaultScopeText(projectType)

  async function handleSave() {
    if (isDemo) return
    setSaving(true)
    setFeedback(null)
    try {
      await saveQuotation(project.id, elementId ?? project.id, estimationId ?? 'demo', {
        scope_of_work: scopeNotes,
        payment_terms: paymentTerms,
        timeline_weeks: timelineWeeks,
        valid_days: 30,
      })
      setFeedback({ text: 'Quotation saved.', variant: 'success' })
    } catch (e) {
      console.error(e)
      setFeedback({ text: 'Failed to save quotation. Check your connection and try again.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDownloadPDF() {
    setDownloading(true)
    setFeedback(null)
    try {
      const payload = {
        project_code: project.project_code,
        project_title: project.title,
        project_location: project.location,
        client_name: project.client?.name,
        client_phone: project.client?.phone,
        quote_number: quoteNumber,
        date: today,
        valid_until: validUntilStr,
        timeline_weeks: timelineWeeks,
        payment_terms: paymentTerms,
        scope_notes: scopeNotes,
        scope_text: scopeText,
        client_categories: clientCategories,
        quoted_price: pricing.quotedPrice,
      }

      const res = await fetch('/api/quotation-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('PDF generation failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.project_code}_quotation.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      setFeedback({ text: 'Quotation PDF download failed. Please try again.', variant: 'error' })
    } finally {
      setDownloading(false)
    }
  }

  async function handleDownloadInvoice() {
    setDownloadingInvoice(true)
    setFeedback(null)
    try {
      const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 14)
      const dueDateStr = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      const invoiceNumber = quoteNumber.replace('QUO-', 'INV-')

      const payload = {
        project_code: project.project_code,
        project_title: project.title,
        project_location: project.location,
        client_name: project.client?.name,
        client_phone: project.client?.phone,
        invoice_number: invoiceNumber,
        quote_number: quoteNumber,
        issue_date: issueDate,
        due_date: dueDateStr,
        payment_terms: paymentTerms,
        scope_notes: scopeNotes,
        scope_text: scopeText,
        client_categories: clientCategories,
        quoted_price: pricing.quotedPrice,
      }

      const res = await fetch('/api/invoice-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Invoice generation failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.project_code}_invoice.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      setFeedback({ text: 'Invoice PDF download failed. Please try again.', variant: 'error' })
    } finally {
      setDownloadingInvoice(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 w-full">
      <FeedbackBanner
        message={feedback?.text ?? null}
        variant={feedback?.variant ?? 'error'}
        onDismiss={() => setFeedback(null)}
      />
      {/* Settings */}
      <Card>
        <CardHeader><CardTitle>Quotation Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input id="timeline" label="Timeline (weeks)" type="number"
            value={timelineWeeks} onChange={(e) => setTimelineWeeks(Number(e.target.value))} />
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Payment Terms</label>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Additional Scope Notes</label>
            <textarea rows={2} placeholder="Any extra notes for the client..."
              value={scopeNotes} onChange={(e) => setScopeNotes(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quotation Preview</CardTitle>
            <Badge className="bg-yellow-100 text-yellow-700">Draft</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border border-border rounded-lg p-6 space-y-5 bg-surface text-sm card-surface">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Brilliant Metal Works</h2>
                <p className="text-xs text-muted">Custom Metal Design & Fabrication</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground text-base">QUOTATION</p>
                <p className="text-xs text-muted">{quoteNumber}</p>
                <p className="text-xs text-muted">Date: {today}</p>
              </div>
            </div>

            <hr className="border-border" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Bill To</p>
                <p className="font-medium text-foreground">{project.client?.name}</p>
                {project.client?.phone && <p className="text-xs text-muted">{project.client.phone}</p>}
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Project</p>
                <p className="font-medium text-foreground">{project.title}</p>
                <p className="text-xs text-muted">{project.location}</p>
              </div>
            </div>

            <hr className="border-border" />

            {/* Client-facing line items — no internal cost detail */}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted border-b border-border">
                  <th className="text-left pb-2 font-medium">Description</th>
                  <th className="text-right pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clientCategories.map((cat, i) => (
                  <tr key={i}>
                    <td className="py-2.5">
                      <p className="font-medium text-foreground">{cat.label}</p>
                      <p className="text-xs text-muted">{cat.desc}</p>
                    </td>
                    <td className="py-2.5 text-right font-medium">{formatCurrency(cat.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="pt-3 font-bold text-foreground text-base">TOTAL</td>
                  <td className="pt-3 text-right font-bold text-xl text-foreground">{formatCurrency(pricing.quotedPrice)}</td>
                </tr>
              </tfoot>
            </table>

            <hr className="border-border" />

            <div className="space-y-1 text-xs text-muted">
              <p><span className="font-semibold text-foreground">Payment Terms:</span> {paymentTerms}</p>
              <p><span className="font-semibold text-foreground">Estimated Timeline:</span> {timelineWeeks} weeks from deposit</p>
              <p><span className="font-semibold text-foreground">Valid Until:</span> {validUntilStr}</p>
              <p><span className="font-semibold text-foreground">Scope:</span> {scopeText}</p>
              {scopeNotes && <p>{scopeNotes}</p>}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            {!isDemo && (
              <Button variant="secondary" onClick={handleSave} disabled={saving} className="flex-1">
                <Save size={14} /> {saving ? 'Saving...' : 'Save Quotation'}
              </Button>
            )}
            <Button onClick={handleDownloadPDF} disabled={downloading} className="flex-1">
              <Download size={14} />
              {downloading ? 'Generating...' : 'Download Quote'}
            </Button>
            <Button variant="secondary" onClick={handleDownloadInvoice} disabled={downloadingInvoice} className="flex-1">
              <Download size={14} />
              {downloadingInvoice ? 'Generating...' : 'Download Invoice'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
