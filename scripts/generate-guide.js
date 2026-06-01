const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  ExternalHyperlink,
} = require('docx')
const fs = require('fs')
const path = require('path')

// ── Colours ────────────────────────────────────────────────────────────────
const BLACK   = '111827'
const DARK    = '1f2937'
const MID     = '374151'
const MUTED   = '6b7280'
const LIGHT   = 'f9fafb'
const ACCENT  = '111827'   // dark header accent
const ACCENT2 = 'f3f4f6'   // light tint for shaded rows
const GOLD    = 'D4A017'   // cover accent line (decorative)
const BORDER  = 'e5e7eb'

// ── Helpers ────────────────────────────────────────────────────────────────
const thin = { style: BorderStyle.SINGLE, size: 1, color: BORDER }
const borders = { top: thin, bottom: thin, left: thin, right: thin }
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'ffffff' }
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }

function t(text, opts = {}) {
  return new TextRun({ text, font: 'Arial', size: opts.size ?? 20, bold: opts.bold, color: opts.color ?? BLACK, ...opts })
}

function para(children, opts = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({
    children,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 80 },
    alignment: opts.align,
    ...opts,
  })
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: 'Arial', size: 28, bold: true, color: BLACK })],
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 4 } },
  })
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: 'Arial', size: 22, bold: true, color: DARK })],
    spacing: { before: 200, after: 80 },
  })
}

function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Arial', size: 20, bold: true, color: MID })],
    spacing: { before: 140, after: 60 },
  })
}

function bullet(text, sub) {
  const children = [t('• ', { bold: true, color: MID }), t(text, { bold: false })]
  if (sub) children.push(t(' — ' + sub, { color: MUTED, size: 18 }))
  return new Paragraph({
    children,
    spacing: { before: 0, after: 60 },
    indent: { left: 360 },
  })
}

function note(text) {
  return new Paragraph({
    children: [t('ℹ  ', { bold: true, color: MUTED }), t(text, { color: MID, size: 18, italics: true })],
    spacing: { before: 60, after: 60 },
    indent: { left: 360 },
  })
}

function rule() {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER, space: 1 } },
    spacing: { before: 120, after: 120 },
  })
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] })
}

function cell(text, opts = {}) {
  const isHeader = opts.header
  return new TableCell({
    borders,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: isHeader
      ? { fill: ACCENT, type: ShadingType.CLEAR }
      : opts.shade
      ? { fill: ACCENT2, type: ShadingType.CLEAR }
      : undefined,
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      children: [t(text, {
        bold: isHeader || opts.bold,
        color: isHeader ? 'ffffff' : opts.color ?? BLACK,
        size: opts.size ?? 18,
      })],
      spacing: { before: 0, after: 0 },
    })],
  })
}

function tableRow(cells, shade) {
  return new TableRow({ children: cells.map((c, i) => {
    if (Array.isArray(c)) return cell(c[0], { ...c[1], shade })
    return cell(c, { shade })
  })})
}

function headerRow(labels, widths) {
  return new TableRow({
    children: labels.map((l, i) => cell(l, { header: true, width: widths?.[i] })),
    tableHeader: true,
  })
}

// ── Content width (A4, 1" margins each side) ──────────────────────────────
// A4 = 11906 DXA wide; 1440 × 2 margins = 9026 content
const CW = 9026

// ══════════════════════════════════════════════════════════════════════════
//  DOCUMENT
// ══════════════════════════════════════════════════════════════════════════

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 20, color: BLACK } },
    },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run:  { size: 28, bold: true, font: 'Arial', color: BLACK },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run:  { size: 22, bold: true, font: 'Arial', color: DARK },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
    ],
  },

  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 520, hanging: 260 } } } }] },
    ],
  },

  sections: [

    // ════════════════════════════════════════════════════════════════════
    //  PAGE 1 — COVER
    // ════════════════════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        // Top accent block (simulated with a thick top border paragraph)
        new Paragraph({
          children: [],
          border: { top: { style: BorderStyle.SINGLE, size: 36, color: ACCENT, space: 0 } },
          spacing: { before: 0, after: 0 },
        }),

        // Spacer
        new Paragraph({ children: [], spacing: { before: 1800, after: 0 } }),

        // Company name
        new Paragraph({
          children: [t('BRILLIANT METAL WORKS', { size: 52, bold: true, color: BLACK })],
          spacing: { before: 0, after: 120 },
        }),

        // Tagline
        new Paragraph({
          children: [t('Custom Metal Design & Fabrication', { size: 24, color: MUTED })],
          spacing: { before: 0, after: 600 },
        }),

        // Divider
        new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLACK, space: 1 } },
          spacing: { before: 0, after: 600 },
        }),

        // Guide title
        new Paragraph({
          children: [t('Project Management &', { size: 44, bold: true, color: DARK })],
          spacing: { before: 0, after: 60 },
        }),
        new Paragraph({
          children: [t('Estimation System', { size: 44, bold: true, color: DARK })],
          spacing: { before: 0, after: 60 },
        }),
        new Paragraph({
          children: [t('USER GUIDE', { size: 28, color: MUTED, bold: false })],
          spacing: { before: 0, after: 800 },
        }),

        // Feature tags
        new Paragraph({
          children: [
            t('  Live Estimation  ', { size: 18, color: 'ffffff', bold: true, shading: { type: ShadingType.CLEAR, fill: BLACK } }),
            t('   '),
            t('  Section Optimizer  ', { size: 18, color: 'ffffff', bold: true, shading: { type: ShadingType.CLEAR, fill: DARK } }),
            t('   '),
            t('  Margin Control  ', { size: 18, color: 'ffffff', bold: true, shading: { type: ShadingType.CLEAR, fill: MID } }),
            t('   '),
            t('  Rhino/GH Export  ', { size: 18, color: 'ffffff', bold: true, shading: { type: ShadingType.CLEAR, fill: MID } }),
          ],
          spacing: { before: 0, after: 1400 },
        }),

        // Version / date block
        new Paragraph({
          children: [t('Version 1.0   •   May 2026   •   Kigali, Rwanda', { size: 18, color: MUTED })],
          border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER, space: 8 } },
          spacing: { before: 0, after: 0 },
        }),
      ],
    },

    // ════════════════════════════════════════════════════════════════════
    //  PAGES 2–8 — CONTENT (single section, headers/footers active)
    // ════════════════════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1800, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                t('Brilliant Metal Works', { bold: true, size: 16, color: BLACK }),
                t('   —   Project Management & Estimation System', { size: 16, color: MUTED }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER, space: 4 } },
              spacing: { before: 0, after: 0 },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                t('User Guide   •   Confidential', { size: 16, color: MUTED }),
                t('                                                                              ', { size: 16 }),
                t('Page ', { size: 16, color: MUTED }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: MUTED }),
                t(' of ', { size: 16, color: MUTED }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: MUTED }),
              ],
              border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER, space: 4 } },
              spacing: { before: 0, after: 0 },
            }),
          ],
        }),
      },

      children: [

        // ── 1. SYSTEM OVERVIEW ──────────────────────────────────────────
        h1('1.  System Overview'),

        para([
          t('This system is your central tool for managing every railing and metalwork project — from the first client enquiry through to final installation. It removes guesswork from estimating, protects your margins, and produces professional client quotations in seconds.'),
        ], { after: 160 }),

        h2('What the system does'),

        bullet('Calculates material quantities', 'steel profiles, infill sheets, catch frames — automatically from dimensions'),
        bullet('Optimises panel sections', 'finds the cheapest combination of sheet size and number of sections'),
        bullet('Controls your pricing', 'adds consumables, surface treatment, transport and a configurable margin'),
        bullet('Generates client quotations', 'clean PDF with high-level categories — no internal cost breakdown shown'),
        bullet('Exports to Rhino/Grasshopper', 'one click sends exact geometry data to your CAD model'),

        para('', { before: 100 }),
        h2('The three-tab workflow'),

        // Workflow table
        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [Math.round(CW/3), Math.round(CW/3), CW - 2*Math.round(CW/3)],
          rows: [
            headerRow(['STEP 1   Site Survey', 'STEP 2   Estimation', 'STEP 3   Quotation']),
            new TableRow({
              children: [
                new TableCell({ borders, margins: { top: 100, bottom: 100, left: 140, right: 140 }, children: [
                  para([t('Enter dimensions, select profiles and infill type. The system calculates everything live as you type.', { size: 18, color: MID })], { after: 0 }),
                ]}),
                new TableCell({ borders, margins: { top: 100, bottom: 100, left: 140, right: 140 }, children: [
                  para([t('Review the detailed material and labour breakdown. Add variable costs and set your margin. See the full pricing chain.', { size: 18, color: MID })], { after: 0 }),
                ]}),
                new TableCell({ borders, margins: { top: 100, bottom: 100, left: 140, right: 140 }, children: [
                  para([t('Preview the client document, download the PDF. The client sees professional categories — not your internal costs.', { size: 18, color: MID })], { after: 0 }),
                ]}),
              ],
            }),
          ],
        }),

        para('', { before: 140 }),
        h2('Project status flow'),

        para([
          t('Every project moves through eight stages. Each stage is one click — you control when to advance.'),
        ], { after: 100 }),

        // Status flow table
        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [1600, 1600, 1600, 1600, 1200, 1200, 1400, 826],
          rows: [
            new TableRow({
              children: ['Inquiry', 'Site Survey', 'Design', 'Quote Sent', 'Approved', 'Fabrication', 'Installation', 'Completed']
                .map((s, i) => new TableCell({
                  borders,
                  shading: { fill: i === 7 ? '166534' : ACCENT, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 100, right: 100 },
                  children: [new Paragraph({ children: [t(s, { size: 16, bold: true, color: 'ffffff' })], spacing: { before: 0, after: 0 }, alignment: AlignmentType.CENTER })],
                })),
            }),
          ],
        }),

        note('You can also jump directly to any status by clicking it in the stepper bar at the top of a project page.'),

        pageBreak(),

        // ── 2. DASHBOARD & PROJECTS ─────────────────────────────────────
        h1('2.  Dashboard & Project Management'),

        h2('Creating a new project'),

        para([t('From the dashboard, click '), t('+ New Project', { bold: true }), t('. Fill in:')]),
        bullet('Project code', 'assigned automatically (e.g. BAL-001 for balconies, STA-001 for staircases)'),
        bullet('Client name and phone number'),
        bullet('Location of the site'),
        bullet('Project type', 'Balcony or Staircase'),

        h2('Dashboard — search and filter'),

        para([t('The dashboard shows all projects in a single table. Two tools help you find what you need quickly:')]),
        bullet('Search bar', 'type any part of the project code, client name, title or location'),
        bullet('Status filters', 'click any status badge to show only projects at that stage'),
        para([t('The project count updates live as you filter.', { color: MUTED, size: 18 })], { after: 100 }),

        h2('Project types'),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [2200, 6826],
          rows: [
            headerRow(['Type', 'What it covers'], [2200, 6826]),
            tableRow([['Balcony', { bold: true }], 'Horizontal railings — any length, wall or floor mounted, one or multiple sections'], false),
            tableRow([['Staircase', { bold: true }], 'Inclined railings along a stringer — rise, run, one or both sides, parallelogram panels'], true),
          ],
        }),

        pageBreak(),

        // ── 3. SITE SURVEY — BALCONY ────────────────────────────────────
        h1('3.  Site Survey — Balcony'),

        h2('Dimensions'),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [2400, 2000, 4626],
          rows: [
            headerRow(['Field', 'Unit', 'What to measure'], [2400, 2000, 4626]),
            tableRow([['Total Length', { bold: true }], 'mm', 'Full run of the railing from end post to end post'], false),
            tableRow([['Total Height', { bold: true }], 'mm', 'Top of rail to floor/slab — typically 900–1100mm residential'], true),
          ],
        }),

        para('', { before: 80 }),
        h2('Section Layout Optimizer'),

        para([
          t('This is the most important feature of the survey tab. Instead of guessing how many sections to use, the system '),
          t('calculates every possible option', { bold: true }),
          t(' (from 2 sections up to ~20) and ranks them by total material cost.'),
        ], { after: 100 }),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [1400, 1600, 1800, 1500, 1200, 1526],
          rows: [
            headerRow(['Sections', 'Section W', 'Cut Size', 'Sheet', 'Sheets', 'Total Cost']),
            new TableRow({ children: [
              cell('3', { shade: true }), cell('1940mm', { shade: true }), cell('1960×1020mm', { shade: true }),
              cell('2000×1000', { shade: true }), cell('3', { shade: true }), cell('RWF 42,000', { shade: true }),
            ]}),
            new TableRow({ children: [
              cell('4', {}), cell('1440mm', {}), cell('1460×1020mm', {}),
              cell('2000×1000  ×2', { color: '2563eb' }), cell('2', {}), cell('RWF 38,500', { bold: true }),
            ]}),
            new TableRow({ children: [
              cell('5', { shade: true }), cell('1140mm', { shade: true }), cell('1160×1020mm', { shade: true }),
              cell('2440×1220', { shade: true }), cell('5', { shade: true }), cell('RWF 51,000', { shade: true }),
            ]}),
          ],
        }),

        para('', { before: 80 }),
        para([
          t('Click any row to select that layout. The row turns black to confirm your choice. ', { size: 18 }),
          t('The BEST badge', { bold: true, size: 18 }),
          t(' marks the cheapest option. A blue "×N" means multiple panels nest on one sheet — those options are often the most economical.', { size: 18 }),
        ], { after: 80 }),

        note('Changing any dimension, profile or infill type automatically recalculates all options. You must re-select a layout after any change.'),

        h2('Steel Profiles'),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [2000, 2000, 5026],
          rows: [
            headerRow(['Profile', 'Size', 'Typical use'], [2000, 2000, 5026]),
            tableRow([['20×20 SHS', { bold: true }], '20 × 20mm', 'Inner catch frame (standard)'], false),
            tableRow([['40×20 RHS', { bold: true }], '40 × 20mm', 'Bottom rail — slim horizontal'], true),
            tableRow([['40×40 SHS', { bold: true }], '40 × 40mm', 'Posts and top rail — most common'], false),
            tableRow([['60×40 RHS', { bold: true }], '60 × 40mm', 'Heavy-duty posts or top rail'], true),
          ],
        }),

        para('', { before: 80 }),
        h2('Infill Types'),

        bullet('Laser-Cut Sheet', 'plain steel sheet — section optimizer active, catch frame required'),
        bullet('Glass Panels', 'toughened glass — manual post spacing, no catch frame'),
        bullet('Flat Bars', 'horizontal bar infill — manual post spacing, bar spacing input'),

        h2('Mounting & Site'),

        bullet('Wall-mounted', 'specify wall type (concrete, brick, block) — affects hardware cost recommendations'),
        bullet('Floor-mounted', 'base plate welded to floor slab'),
        bullet('Access Difficulty', 'Easy / Medium / Difficult — inform this from your site visit, affects labour estimate'),

        pageBreak(),

        // ── 4. SITE SURVEY — STAIRCASE ──────────────────────────────────
        h1('4.  Site Survey — Staircase'),

        h2('Staircase dimensions'),

        para([
          t('For a staircase railing, you are '),
          t('not building the stairs', { bold: true }),
          t(' — you are building the railing along them. Measure the structural envelope of the stair flight.'),
        ], { after: 100 }),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [2000, 1600, 5426],
          rows: [
            headerRow(['Field', 'Unit', 'What to measure'], [2000, 1600, 5426]),
            tableRow([['Total Rise', { bold: true }], 'mm', 'Vertical height from ground to top landing — e.g. 2800mm'], false),
            tableRow([['Total Run', { bold: true }], 'mm', 'Horizontal distance from first step to last — e.g. 3500mm'], true),
            tableRow([['Width', { bold: true }], 'mm', 'Usable stair width — e.g. 1200mm'], false),
            tableRow([['Handrail Height', { bold: true }], 'mm', 'Height of top rail above stringer line — typically 1000mm'], true),
            tableRow([['Number of Flights', { bold: true }], '', '1 = straight stair,  2 = with intermediate landing'], false),
            tableRow([['Rail Sides', { bold: true }], '', 'One side only, or both sides of the stair'], true),
          ],
        }),

        para('', { before: 100 }),
        note('The system calculates stringer length automatically: √(rise² + run²). You do not need to measure along the slope.'),

        h2('Section optimizer — inclined panels'),

        para([
          t('Staircase panels are '),
          t('parallelograms', { bold: true }),
          t(', not rectangles — they follow the slope of the stringer. The optimizer works along the stringer length and calculates:'),
        ], { after: 80 }),

        bullet('Section slope spacing', 'distance between posts measured along the slope'),
        bullet('Horizontal span', 'the structural span between posts — flagged if it exceeds 2000mm'),
        bullet('Cut slope edge × cut height', 'exact parallelogram dimensions for the laser/CNC cutter'),
        bullet('Bounding rectangle', 'the sheet area needed to cut one panel — used for sheet nesting'),

        note('The bounding height is larger than the panel height because of the slope offset. The optimizer accounts for this automatically.'),

        h2('CNC Panel dimensions'),

        para([t('After choosing a section layout, the Estimation tab shows a blue card with the exact cutting dimensions for all panels. All panels in one flight are identical — rotate alternate panels 180° when nesting to save material.')]),

        pageBreak(),

        // ── 5. ESTIMATION & PRICING ──────────────────────────────────────
        h1('5.  Estimation & Pricing'),

        h2('Material & Labour Breakdown'),

        para([
          t('The top table on the Estimation tab shows every cost line with quantity, unit and unit price — this is your '),
          t('internal view', { bold: true }),
          t('. The client never sees this table.'),
        ], { after: 80 }),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [3200, 5826],
          rows: [
            headerRow(['Line item', 'What it covers'], [3200, 5826]),
            tableRow([['Steel Frame', { bold: true }], 'Posts, top rail, bottom rail, catch frame — priced per kg'], false),
            tableRow([['Infill Sheets / Glass / Bars', { bold: true }], 'Panel material — priced per sheet or per m²'], true),
            tableRow([['CNC Cutting', { bold: true }], 'Laser or plasma cut — priced per metre of cut length'], false),
            tableRow([['Labour', { bold: true }], 'Fabrication and welding days — priced per day'], true),
          ],
        }),

        para('', { before: 100 }),
        h2('Variable Costs'),

        para([t('Below the breakdown, the Variable Costs card covers the hidden costs that often cause underquoting:')], { after: 80 }),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [2600, 1800, 4626],
          rows: [
            headerRow(['Cost', 'Default', 'How it works']),
            tableRow([['Design + Laser Cutting', { bold: true }], 'Manual', 'Enter the actual cost from your cutting supplier'], false),
            tableRow([['Installation', { bold: true }], 'Manual', 'Labour cost for on-site fitting — varies by job'], true),
            tableRow([['Welding Consumables', { bold: true }], '7% of frame', 'Auto-calculated — adjust the % slider if your usage differs'], false),
            tableRow([['Surface Treatment', { bold: true }], 'None', 'Select Powder Coat or Paint — enter rate per m²; cost auto-calculates from infill area'], true),
            tableRow([['Transport & Delivery', { bold: true }], 'Manual', 'Flat fee — enters your fuel and vehicle cost'], false),
            tableRow([['Hardware & Fixings', { bold: true }], 'Manual', 'Anchors, bolts, rawl plugs — flat fee per job'], true),
          ],
        }),

        para('', { before: 140 }),
        h2('The Pricing Chain'),

        para([
          t('This is the core of the margin system. Every number flows in one direction — there are no hidden overrides.'),
        ], { after: 100 }),

        // Pricing chain visual
        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [CW],
          rows: [
            new TableRow({ children: [new TableCell({
              borders: { top: thin, bottom: thin, left: { style: BorderStyle.SINGLE, size: 8, color: BLACK }, right: thin },
              shading: { fill: LIGHT, type: ShadingType.CLEAR },
              margins: { top: 140, bottom: 140, left: 200, right: 200 },
              children: [
                new Paragraph({ children: [t('Materials + Labour subtotal', { size: 18, color: MID }), t('   (from the breakdown table)', { size: 16, color: MUTED, italics: true })], spacing: { before: 0, after: 40 } }),
                new Paragraph({ children: [t('+ Welding consumables  + Surface treatment  + Transport  + Hardware  + Design + Installation', { size: 18, color: MID })], spacing: { before: 0, after: 40 } }),
                new Paragraph({ children: [t('= Your direct cost', { size: 20, bold: true, color: BLACK })], spacing: { before: 40, after: 60 }, border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER, space: 4 } } }),
                new Paragraph({ children: [t('+ Contingency (default 10%)', { size: 18, color: MID }), t('   covers material price risk and rework', { size: 16, color: MUTED, italics: true })], spacing: { before: 0, after: 40 } }),
                new Paragraph({ children: [t('= Adjusted cost', { size: 20, bold: true, color: BLACK })], spacing: { before: 40, after: 60 }, border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER, space: 4 } } }),
                new Paragraph({ children: [t('+ Business margin (default 30%)', { size: 18, color: MID }), t('   overhead, equipment, profit', { size: 16, color: MUTED, italics: true })], spacing: { before: 0, after: 40 } }),
                new Paragraph({ children: [t('= QUOTED PRICE  ←  this is what the client pays', { size: 22, bold: true, color: BLACK })], spacing: { before: 40, after: 0 }, border: { top: { style: BorderStyle.DOUBLE, size: 4, color: BLACK, space: 4 } } }),
              ],
            })]})
          ],
        }),

        para('', { before: 100 }),
        note('Both the contingency % and business margin % are editable inputs — you can adjust them per job. The defaults (10% + 30%) are set to protect you from the most common causes of underquoting.'),

        h2('Why 30% margin is not "too high"'),

        para([t('A 30% business margin on top of direct + contingency costs covers:')], { after: 60 }),
        bullet('Workshop rent, electricity, equipment maintenance'),
        bullet('Owner and management time not billed as direct labour'),
        bullet('Guarantee and warranty call-backs'),
        bullet('Slow periods when direct costs still run'),
        para([t('If your margin feels high, check whether these costs are already included in your labour rate. If they are not, 30% is the minimum safe level.', { color: MID, size: 18 })], { before: 60 }),

        pageBreak(),

        // ── 6. QUOTATION GENERATION ──────────────────────────────────────
        h1('6.  Quotation Generation'),

        h2('What the client sees vs what you see'),

        para([
          t('The system keeps two views completely separate. Your internal cost data never appears in the client document.'),
        ], { after: 100 }),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [Math.round(CW/2), CW - Math.round(CW/2)],
          rows: [
            headerRow(['Your internal Estimation tab', 'Client PDF & preview']),
            new TableRow({ children: [
              new TableCell({ borders, shading: { fill: LIGHT, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 140, right: 140 }, children: [
                bullet('Each item with qty, unit, unit price', ''),
                bullet('Frame cost, infill cost, labour cost', ''),
                bullet('Consumables % and computed amount', ''),
                bullet('Surface treatment rate per m²', ''),
                bullet('Full pricing chain (direct → margin)', ''),
              ]}),
              new TableCell({ borders, margins: { top: 100, bottom: 100, left: 140, right: 140 }, children: [
                bullet('Steel Frame & Fabrication', ''),
                bullet('Infill Panels', ''),
                bullet('Surface Treatment (if used)', ''),
                bullet('Transport & Delivery (if used)', ''),
                bullet('Installation (if used)', ''),
                new Paragraph({ children: [t('Each line shows only the proportional quoted amount — no rates.', { size: 16, color: MUTED, italics: true })], spacing: { before: 60, after: 0 } }),
              ]}),
            ]}),
          ],
        }),

        para('', { before: 100 }),
        h2('Quotation settings'),

        bullet('Timeline (weeks)', 'how long from deposit to delivery — appears on the PDF'),
        bullet('Payment Terms', 'default: 50% deposit on approval, 50% on completion — editable'),
        bullet('Scope Notes', 'any additional notes you want the client to see'),

        h2('Downloading the PDF'),

        para([
          t('Click '),
          t('Download PDF', { bold: true }),
          t(' in the Quotation tab. The PDF is generated instantly and named after the project code — e.g. '),
          t('BAL-001_quotation.pdf', { bold: true, size: 18, font: 'Courier New' }),
          t('.'),
        ]),
        para([t('The PDF is ready to send directly to the client. It shows your company name, project reference, valid-until date, all line items with amounts, payment terms and scope.')]),

        note('Save the quotation first (Save Quotation button) before downloading if you want the settings stored in the database.'),

        h2('Proportional amounts — how they work'),

        para([
          t('Each client line item amount is calculated as: '),
          t('(raw cost ÷ your direct total) × quoted price', { bold: true }),
          t('. This means the total of all client line items always equals the quoted price exactly. Rounding is absorbed in the last line item.'),
        ]),

        pageBreak(),

        // ── 7. RHINO / GRASSHOPPER INTEGRATION ──────────────────────────
        h1('7.  Rhino / Grasshopper Integration'),

        h2('Exporting the geometry data'),

        para([
          t('Once the site survey is complete, click '),
          t('Export to Rhino (.json)', { bold: true }),
          t(' in the sidebar or header. A JSON file is downloaded named after the project code.'),
        ]),
        para([
          t('This file contains all the dimensional data the Grasshopper scripts need — nothing has to be retyped in Rhino.'),
        ], { after: 100 }),

        h2('JSON file contents'),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [2600, 6426],
          rows: [
            headerRow(['Section', 'What it contains']),
            tableRow([['geometry', { bold: true }], 'Total dimensions, stringer length, slope angle, step count and rise/going'], false),
            tableRow([['handrail', { bold: true }], 'Post count, number of panels, height, rail sides, catch profile'], true),
            tableRow([['profiles', { bold: true }], 'Post, top rail, bottom rail profile strings (e.g. "40x40")'], false),
            tableRow([['infill', { bold: true }], 'Infill type, sheet thickness, sheet size chosen by optimizer'], true),
            tableRow([['panel_cnc', { bold: true }], 'Cut slope edge, height, bounding rectangle, interior angle, total panels'], false),
          ],
        }),

        para('', { before: 100 }),
        h2('Grasshopper scripts — two components'),

        para([
          t('There are two Python scripts for each project type (balcony and staircase). Paste each into a separate '),
          t('GHPython', { bold: true }),
          t(' component in Grasshopper, then wire them together.'),
        ], { after: 80 }),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [2800, 6226],
          rows: [
            headerRow(['Script', 'What it does']),
            tableRow([['balcony_reader.py  /  staircase_reader.py', { bold: true }], 'Reads the JSON file. Connect the json_path input to a Panel containing the file path. Outputs all parameters as individual wires.'], false),
            tableRow([['balcony_geometry.py  /  staircase_geometry.py', { bold: true }], 'Receives parameters from the reader. Outputs geometry objects: stringer line, step treads, posts, rails, infill surfaces, catch frame lines, CNC flat panels.'], true),
          ],
        }),

        para('', { before: 100 }),
        h2('Grasshopper outputs — what you see in Rhino'),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [2400, 6626],
          rows: [
            headerRow(['Output', 'Description']),
            tableRow([['stringer_line', { bold: true }], 'The main diagonal line from floor to top landing'], false),
            tableRow([['step_lines', { bold: true }], 'All tread and riser lines for visual reference'], true),
            tableRow([['post_lines', { bold: true }], 'Vertical handrail post lines at each section boundary'], false),
            tableRow([['top_rail_line  /  bottom_rail_line', { bold: true }], 'Polylines along the top and bottom of the handrail'], true),
            tableRow([['infill_surfaces', { bold: true }], 'The inclined panel surfaces between posts (3D, in-place)'], false),
            tableRow([['catch_frame_lines', { bold: true }], 'The 4 inner catch frame bars per panel — inset from posts and rails'], true),
            tableRow([['cnc_panels', { bold: true }], 'Flat parallelogram surfaces laid out for CNC — all identical'], false),
            tableRow([['cnc_bounding_rects', { bold: true }], 'Bounding rectangles showing the sheet cut area per panel'], true),
            tableRow([['report', { bold: true }], 'Text output with full material schedule, cut dimensions and sheet fit check'], false),
          ],
        }),

        para('', { before: 100 }),
        note('Use the reload toggle (Button component) in Grasshopper to force a re-read of the JSON file whenever you update the survey data in the system and export a new file.'),

        h2('Workflow in practice'),

        para([
          t('1.', { bold: true }), t('  Complete the site survey in the system.'),
        ], { after: 40 }),
        para([
          t('2.', { bold: true }), t('  Click Export to Rhino — save the JSON into your project folder.'),
        ], { after: 40 }),
        para([
          t('3.', { bold: true }), t('  Open Grasshopper — connect the reader script to the JSON path.'),
        ], { after: 40 }),
        para([
          t('4.', { bold: true }), t('  Wire reader outputs to the geometry script inputs.'),
        ], { after: 40 }),
        para([
          t('5.', { bold: true }), t('  The full 3D railing appears in Rhino. Adjust the origin point to place it correctly in your model.'),
        ], { after: 40 }),
        para([
          t('6.', { bold: true }), t('  Use the report text output to confirm all dimensions match your quotation.'),
        ], { after: 40 }),
        para([
          t('7.', { bold: true }), t('  Send cnc_panels to the laser cutter nesting software.'),
        ], { after: 120 }),

        rule(),

        // Quick reference
        h2('Quick reference — default values'),

        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [3200, 1800, 4026],
          rows: [
            headerRow(['Setting', 'Default', 'When to change']),
            tableRow([['Welding consumables', { bold: true }], '7%', 'Increase for complex weld patterns or premium wire'], false),
            tableRow([['Powder coat rate', { bold: true }], '8,000 RWF/m²', 'Get a current quote from your coating supplier'], true),
            tableRow([['Paint rate', { bold: true }], '5,000 RWF/m²', 'Adjust for primer + topcoat combinations'], false),
            tableRow([['Contingency', { bold: true }], '10%', 'Raise to 15% for complex or uncertain jobs'], true),
            tableRow([['Business margin', { bold: true }], '30%', 'Review quarterly against your actual overhead costs'], false),
            tableRow([['Quotation validity', { bold: true }], '30 days', 'Shorten if steel prices are volatile'], true),
            tableRow([['Payment terms', { bold: true }], '50% / 50%', 'Standard for Rwanda market — adjust per client'], false),
          ],
        }),

        para('', { before: 120 }),
        rule(),

        new Paragraph({
          children: [t('Brilliant Metal Works — Project Management & Estimation System   •   User Guide v1.0   •   May 2026', { size: 16, color: MUTED })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 0 },
        }),
      ],
    },
  ],
})

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, '..', 'Brilliant_MW_System_Guide.docx')
  fs.writeFileSync(out, buf)
  console.log('Written:', out)
}).catch(e => { console.error(e); process.exit(1) })
