import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#111827', backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#111827' },
  companyTagline: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  invoiceTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  invoiceRef: { fontSize: 8, color: '#6b7280', textAlign: 'right', marginTop: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 16 },
  section: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  sectionBlock: { flex: 1 },
  label: { fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  value: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' },
  valueSub: { fontSize: 8, color: '#6b7280', marginTop: 1 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 6, marginBottom: 4 },
  tableHeaderText: { fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  tableRowMain: { flex: 1 },
  tableRowLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  tableRowSub: { fontSize: 8, color: '#9ca3af', marginTop: 2 },
  tableRowAmount: { width: 110, textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' },
  totalRow: { flexDirection: 'row', paddingTop: 12, borderTopWidth: 2, borderTopColor: '#111827', marginTop: 4 },
  totalLabel: { flex: 1, fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#111827' },
  totalAmount: { width: 110, textAlign: 'right', fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827' },
  balanceBox: {
    marginTop: 16, backgroundColor: '#111827', padding: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  balanceLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  balanceAmount: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  footerRow: { flexDirection: 'row', marginBottom: 4 },
  footerLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', width: 110 },
  footerValue: { fontSize: 8, color: '#6b7280', flex: 1 },
  watermark: {
    position: 'absolute', bottom: 30, left: 48, right: 48,
    borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 8,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  watermarkText: { fontSize: 7, color: '#9ca3af' },
})

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(Math.round(n)) + ' RWF'
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const categories: { label: string; desc: string; amount: number }[] = data.client_categories ?? []

  const pdf = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>Brilliant Metal Works</Text>
            <Text style={styles.companyTagline}>Custom Metal Design & Fabrication</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceRef}>{data.invoice_number}</Text>
            <Text style={styles.invoiceRef}>Issue date: {data.issue_date}</Text>
            <Text style={styles.invoiceRef}>Due date: {data.due_date}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Client + Project */}
        <View style={styles.section}>
          <View style={styles.sectionBlock}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={styles.value}>{data.client_name}</Text>
            {data.client_phone ? <Text style={styles.valueSub}>{data.client_phone}</Text> : null}
          </View>
          <View style={styles.sectionBlock}>
            <Text style={styles.label}>Project</Text>
            <Text style={styles.value}>{data.project_title}</Text>
            <Text style={styles.valueSub}>{data.project_location}</Text>
          </View>
          <View style={styles.sectionBlock}>
            <Text style={styles.label}>Reference</Text>
            <Text style={styles.value}>{data.project_code}</Text>
            <Text style={styles.valueSub}>Quote ref: {data.quote_number}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Description</Text>
          <Text style={[styles.tableHeaderText, { width: 110, textAlign: 'right' }]}>Amount</Text>
        </View>

        {categories.map((cat, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={styles.tableRowMain}>
              <Text style={styles.tableRowLabel}>{cat.label}</Text>
              {cat.desc ? <Text style={styles.tableRowSub}>{cat.desc}</Text> : null}
            </View>
            <Text style={styles.tableRowAmount}>{formatRWF(cat.amount)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalAmount}>{formatRWF(data.quoted_price)}</Text>
        </View>

        {/* Balance due box */}
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>BALANCE DUE</Text>
          <Text style={styles.balanceAmount}>{formatRWF(data.quoted_price)}</Text>
        </View>

        <View style={styles.divider} />

        {/* Payment details */}
        <View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Payment Terms:</Text>
            <Text style={styles.footerValue}>{data.payment_terms}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Due Date:</Text>
            <Text style={styles.footerValue}>{data.due_date}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Scope:</Text>
            <Text style={styles.footerValue}>{data.scope_text ?? 'Supply, fabricate and install railing as per agreed design'}</Text>
          </View>
          {data.scope_notes ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Notes:</Text>
              <Text style={styles.footerValue}>{data.scope_notes}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.watermark}>
          <Text style={styles.watermarkText}>Brilliant Metal Works — Custom Metal Design & Fabrication</Text>
          <Text style={styles.watermarkText}>{data.invoice_number}</Text>
        </View>
      </Page>
    </Document>
  )

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${data.project_code}_invoice.pdf"`,
    },
  })
}
