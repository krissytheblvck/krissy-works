import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#111827', backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827' },
  docTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  docRef: { fontSize: 8, color: '#6b7280', textAlign: 'right', marginTop: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 12 },
  metaRow: { flexDirection: 'row', gap: 32, marginBottom: 12 },
  metaBlock: { flex: 1 },
  metaLabel: { fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  metaValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' },
  metaSub: { fontSize: 8, color: '#6b7280' },
  tableHeader: {
    flexDirection: 'row', backgroundColor: '#111827',
    paddingVertical: 5, paddingHorizontal: 6, marginBottom: 0,
  },
  thText: { fontSize: 7, color: '#ffffff', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  tableRowAlt: { backgroundColor: '#f9fafb' },
  colQty: { width: 40, textAlign: 'right' },
  colUnit: { width: 40, textAlign: 'center' },
  colDesc: { flex: 1, paddingLeft: 8 },
  colPrice: { width: 90, textAlign: 'right' },
  colTotal: { width: 90, textAlign: 'right' },
  cellMain: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' },
  cellSub: { fontSize: 7, color: '#9ca3af', marginTop: 1 },
  cellNum: { fontSize: 9, color: '#374151' },
  totalRow: {
    flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 6,
    borderTopWidth: 1.5, borderTopColor: '#111827', marginTop: 2,
  },
  totalLabel: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', paddingLeft: 8 },
  totalAmount: { width: 90, textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' },
  notice: {
    marginTop: 16, borderWidth: 0.5, borderColor: '#d1d5db',
    borderRadius: 4, padding: 10, backgroundColor: '#f9fafb',
  },
  noticeText: { fontSize: 8, color: '#6b7280', lineHeight: 1.5 },
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

interface LineItem { label: string; sub: string; qty: number; unit: string; unit_price: number; total: number }

export async function POST(req: NextRequest) {
  const data = await req.json()
  const items: LineItem[] = data.line_items ?? []
  const subtotal: number = data.subtotal ?? items.reduce((s, i) => s + i.total, 0)
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const pdf = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>Brilliant Metal Works</Text>
            <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>Custom Metal Design & Fabrication</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>BILL OF MATERIALS</Text>
            <Text style={styles.docRef}>{data.project_code} — {today}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Project meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Project</Text>
            <Text style={styles.metaValue}>{data.project_title}</Text>
            <Text style={styles.metaSub}>{data.project_location}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Client</Text>
            <Text style={styles.metaValue}>{data.client_name}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Type</Text>
            <Text style={styles.metaValue}>{data.project_type ?? 'Railing'}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.thText, styles.colQty]}>Qty</Text>
          <Text style={[styles.thText, styles.colUnit]}>Unit</Text>
          <Text style={[styles.thText, styles.colDesc]}>Material / Description</Text>
          <Text style={[styles.thText, styles.colPrice]}>Unit Price</Text>
          <Text style={[styles.thText, styles.colTotal]}>Total</Text>
        </View>

        {/* Items */}
        {items.map((item, i) => (
          <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.cellNum, styles.colQty]}>{item.qty}</Text>
            <Text style={[styles.cellNum, styles.colUnit, { textAlign: 'center' }]}>{item.unit}</Text>
            <View style={styles.colDesc}>
              <Text style={styles.cellMain}>{item.label}</Text>
              {item.sub ? <Text style={styles.cellSub}>{item.sub}</Text> : null}
            </View>
            <Text style={[styles.cellNum, styles.colPrice]}>{formatRWF(item.unit_price)}</Text>
            <Text style={[styles.cellNum, styles.colTotal, { fontFamily: 'Helvetica-Bold' }]}>{formatRWF(item.total)}</Text>
          </View>
        ))}

        {/* Subtotal */}
        <View style={styles.totalRow}>
          <Text style={[styles.thText, styles.colQty]}></Text>
          <Text style={[styles.thText, styles.colUnit]}></Text>
          <Text style={styles.totalLabel}>SUBTOTAL (Materials + Labor)</Text>
          <Text style={[styles.thText, styles.colPrice]}></Text>
          <Text style={styles.totalAmount}>{formatRWF(subtotal)}</Text>
        </View>

        {/* Notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            This Bill of Materials represents the internal cost estimate for materials and labour only.
            It does not include overhead, contingency, margin, or any other variable costs.
            For purchasing: order quantities shown plus supplier minimum order increments as needed.
            For workshop use only — do not share with client.
          </Text>
        </View>

        <View style={styles.watermark}>
          <Text style={styles.watermarkText}>Brilliant Metal Works — Internal Document</Text>
          <Text style={styles.watermarkText}>{data.project_code}</Text>
        </View>
      </Page>
    </Document>
  )

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${data.project_code}_BOM.pdf"`,
    },
  })
}
