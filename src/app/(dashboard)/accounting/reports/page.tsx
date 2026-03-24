"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DollarSign, Hash, TrendingUp, Download, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

interface ReportRow {
  label: string
  total: number
  count: number
}

interface ReportData {
  rows: ReportRow[]
  summary: { total: number; count: number; average: number }
}

const reportTypes = [
  { value: "monthly", label: "חודשי" },
  { value: "quarterly", label: "רבעוני" },
  { value: "yearly", label: "שנתי" },
  { value: "by_method", label: "לפי אמצעי תשלום" },
  { value: "debts", label: "חובות" },
]

const years = ["2024", "2025", "2026", "2027"]

export default function ReportsPage() {
  const { toast } = useToast()
  const [reportType, setReportType] = useState("monthly")
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/accounting/reports?type=${reportType}&year=${year}`
      )
      if (res.ok) {
        const data = await res.json()
        setReport(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [reportType, year])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(
        `/api/accounting/reports?type=${reportType}&year=${year}&format=excel`
      )
      if (!res.ok) throw new Error("שגיאה בייצוא")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `report-${reportType}-${year}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: "הקובץ הורד בהצלחה" })
    } catch {
      toast({ title: "שגיאה בייצוא לאקסל", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const summary = report?.summary
  const rows = report?.rows || []

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">דוחות כספיים</h1>
        <Button onClick={handleExport} disabled={exporting} variant="outline" className="gap-2">
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          ייצוא לאקסל
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="סוג דוח" />
          </SelectTrigger>
          <SelectContent>
            {reportTypes.map((rt) => (
              <SelectItem key={rt.value} value={rt.value}>
                {rt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="שנה" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">סה&quot;כ הכנסות</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.total)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">כמות תשלומים</CardTitle>
              <Hash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ממוצע</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.average)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">אין נתונים לתקופה זו</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תקופה</TableHead>
              <TableHead className="text-right">סכום</TableHead>
              <TableHead className="text-right">כמות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell>{row.label}</TableCell>
                <TableCell>{formatCurrency(row.total)}</TableCell>
                <TableCell>{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
