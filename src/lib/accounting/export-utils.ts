import * as XLSX from "xlsx"

// ============================================================
// Types
// ============================================================

interface PaymentRow {
  id: string
  createdAt: string
  customerName: string
  customerEmail: string
  amount: number
  paymentMethod: string | null
  description: string | null
  receiptNumber: string | null
  receiptUrl: string | null
}

// ============================================================
// Constants
// ============================================================

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
]

const PAYMENT_METHOD_HEBREW: Record<string, string> = {
  MANUAL: "ידני",
  ICOUNT: "אשראי (iCount)",
  STRIPE: "אשראי (Stripe)",
  cash: "מזומן",
  bank_transfer: "העברה בנקאית",
  check: "צ'ק",
  credit_card: "אשראי",
}

const VAT_RATE = 0.17

// ============================================================
// Helpers
// ============================================================

export function getReceiptSource(url: string | null): string {
  if (!url) return "מערכת"
  return url.toLowerCase().includes("icount") ? "iCount" : "מערכת"
}

function translatePaymentMethod(method: string | null): string {
  if (!method) return "לא צוין"
  return PAYMENT_METHOD_HEBREW[method] ?? method
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/** Apply RTL view to a worksheet. */
function setRTL(ws: XLSX.WorkSheet): void {
  if (!ws["!sheetViews"]) {
    ;(ws as Record<string, unknown>)["!sheetViews"] = [{ rightToLeft: true }]
  }
}

/** Set column widths on a worksheet. */
function setColWidths(ws: XLSX.WorkSheet, widths: number[]): void {
  ws["!cols"] = widths.map((w) => ({ wch: w }))
}

// ============================================================
// Sheet builders
// ============================================================

function buildSummarySheet(payments: PaymentRow[], year: number): XLSX.WorkSheet {
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)
  const vat = totalRevenue * VAT_RATE
  const net = totalRevenue - vat
  const count = payments.length
  const average = count > 0 ? totalRevenue / count : 0

  const data = [
    ["דוח הנהלת חשבונות", year],
    [],
    ["סה״כ הכנסות", totalRevenue],
    ["מע״מ (17%)", vat],
    ["נטו (לפני מע״מ)", net],
    ["מספר תשלומים", count],
    ["ממוצע לתשלום", average],
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  setRTL(ws)
  setColWidths(ws, [22, 18])

  // Format currency cells (rows 3-5, 7 — 0-indexed row 2-4, 6, column B)
  const currencyCells = ["B3", "B4", "B5", "B7"]
  for (const ref of currencyCells) {
    const cell = ws[ref]
    if (cell) cell.z = '#,##0.00 ₪'
  }

  return ws
}

function buildDetailSheet(payments: PaymentRow[]): XLSX.WorkSheet {
  const headers = [
    "תאריך",
    "לקוח",
    "אימייל",
    "סכום",
    "אמצעי תשלום",
    "תיאור",
    "מספר קבלה",
    "קבלה",
  ]

  const rows = payments.map((p) => {
    const row: (string | number)[] = [
      formatDate(p.createdAt),
      p.customerName,
      p.customerEmail,
      p.amount,
      translatePaymentMethod(p.paymentMethod),
      p.description ?? "",
      p.receiptNumber ?? "",
      p.receiptUrl ?? "",
    ]
    return row
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  setRTL(ws)
  setColWidths(ws, [14, 22, 28, 14, 18, 26, 16, 40])

  // Turn receipt URL cells into hyperlinks (column H, starting row 2)
  payments.forEach((p, i) => {
    if (p.receiptUrl) {
      const cellRef = `H${i + 2}`
      const cell = ws[cellRef]
      if (cell) {
        cell.l = { Target: p.receiptUrl, Tooltip: "פתח קבלה" }
      }
    }
  })

  // Format amount column
  for (let i = 0; i < payments.length; i++) {
    const cell = ws[`D${i + 2}`]
    if (cell) cell.z = '#,##0.00 ₪'
  }

  return ws
}

function buildMonthlySheet(payments: PaymentRow[]): XLSX.WorkSheet {
  // Group by month (0-11)
  const monthly: Map<number, PaymentRow[]> = new Map()
  for (let m = 0; m < 12; m++) monthly.set(m, [])

  for (const p of payments) {
    const month = new Date(p.createdAt).getMonth()
    monthly.get(month)!.push(p)
  }

  const headers = ["חודש", "מספר תשלומים", "סה״כ", "ממוצע"]

  const rows: (string | number)[][] = []
  for (let m = 0; m < 12; m++) {
    const group = monthly.get(m)!
    const total = group.reduce((s, p) => s + p.amount, 0)
    const count = group.length
    const avg = count > 0 ? total / count : 0
    rows.push([HEBREW_MONTHS[m], count, total, avg])
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  setRTL(ws)
  setColWidths(ws, [14, 16, 16, 16])

  // Format currency columns C and D
  for (let i = 0; i < 12; i++) {
    const cellC = ws[`C${i + 2}`]
    const cellD = ws[`D${i + 2}`]
    if (cellC) cellC.z = '#,##0.00 ₪'
    if (cellD) cellD.z = '#,##0.00 ₪'
  }

  return ws
}

function buildPaymentMethodSheet(payments: PaymentRow[]): XLSX.WorkSheet {
  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0)

  // Group by payment method
  const groups: Map<string, PaymentRow[]> = new Map()
  for (const p of payments) {
    const key = p.paymentMethod ?? "UNKNOWN"
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const headers = ["אמצעי תשלום", "מספר תשלומים", "סה״כ", "אחוז"]

  const rows: (string | number)[][] = []
  for (const [method, group] of Array.from(groups.entries())) {
    const total = group.reduce((s, p) => s + p.amount, 0)
    const pct = totalRevenue > 0 ? total / totalRevenue : 0
    rows.push([
      translatePaymentMethod(method === "UNKNOWN" ? null : method),
      group.length,
      total,
      pct,
    ])
  }

  // Sort descending by total
  rows.sort((a, b) => (b[2] as number) - (a[2] as number))

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  setRTL(ws)
  setColWidths(ws, [20, 16, 16, 12])

  // Format currency (C) and percentage (D)
  for (let i = 0; i < rows.length; i++) {
    const cellC = ws[`C${i + 2}`]
    const cellD = ws[`D${i + 2}`]
    if (cellC) cellC.z = '#,##0.00 ₪'
    if (cellD) cellD.z = '0.0%'
  }

  return ws
}

// ============================================================
// Main export
// ============================================================

export async function generateAccountantReport(
  payments: PaymentRow[],
  year: number
): Promise<Buffer> {
  const wb = XLSX.utils.book_new()

  // Set workbook RTL
  if (!wb.Workbook) wb.Workbook = {}
  if (!wb.Workbook.Views) wb.Workbook.Views = []
  wb.Workbook.Views[0] = { RTL: true }

  const summaryWs = buildSummarySheet(payments, year)
  const detailWs = buildDetailSheet(payments)
  const monthlyWs = buildMonthlySheet(payments)
  const methodWs = buildPaymentMethodSheet(payments)

  XLSX.utils.book_append_sheet(wb, summaryWs, "סיכום")
  XLSX.utils.book_append_sheet(wb, detailWs, "פירוט")
  XLSX.utils.book_append_sheet(wb, monthlyWs, "חודשי")
  XLSX.utils.book_append_sheet(wb, methodWs, "לפי אמצעי תשלום")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  return Buffer.from(buf)
}
