"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DollarSign,
  TrendingUp,
  Calendar,
  AlertCircle,
  CreditCard,
  FileText,
  BarChart3,
  Loader2,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface MonthlySummary {
  month: number
  total: number
  count: number
}

interface ReportData {
  rows: MonthlySummary[]
  summary?: { totalRevenue: number; totalPayments: number; average: number }
}

interface PaymentRow {
  id: string
  amount: number
  description: string | null
  paymentMethod: string | null
  status: string
  createdAt: string
  customer: { id: number; fullName: string }
}

export default function AccountingDashboardPage() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [repRes, payRes] = await Promise.all([
          fetch(`/api/accounting/reports?type=monthly&year=${currentYear}`),
          fetch(`/api/accounting/payments?limit=5`),
        ])
        if (repRes.ok) {
          const data = await repRes.json()
          setReport(data)
        }
        if (payRes.ok) {
          const data = await payRes.json()
          setPayments(data.payments || [])
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentYear])

  const thisMonthTotal =
    report?.rows?.find((r) => r.month === currentMonth)?.total || 0
  const lastMonthTotal =
    report?.rows?.find((r) => r.month === currentMonth - 1)?.total || 0
  const yearTotal = report?.summary?.totalRevenue || 0
  const openDebts = 0 // Will be populated from API if available

  const methodLabel: Record<string, string> = {
    cash: "מזומן",
    bank_transfer: "העברה",
    check: "צ'ק",
    credit_card: "אשראי",
    MANUAL: "ידני",
    ICOUNT: "iCount",
    STRIPE: "Stripe",
  }

  const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    FAILED: "bg-red-100 text-red-800",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">חשבונות</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הכנסות החודש</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(thisMonthTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הכנסות חודש קודם</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(lastMonthTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הכנסות השנה</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(yearTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">חובות פתוחים</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(openDebts)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex gap-3">
        <Link href="/accounting/payments">
          <Button variant="outline" className="gap-2">
            <CreditCard className="h-4 w-4" />
            תשלומים
          </Button>
        </Link>
        <Link href="/accounting/invoices">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            חשבוניות
          </Button>
        </Link>
        <Link href="/accounting/reports">
          <Button variant="outline" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            דוחות
          </Button>
        </Link>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>תשלומים אחרונים</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">אין תשלומים</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">לקוח</TableHead>
                  <TableHead className="text-right">סכום</TableHead>
                  <TableHead className="text-right">אמצעי תשלום</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.createdAt)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/customers/${p.customer.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {p.customer.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{formatCurrency(p.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {methodLabel[p.paymentMethod || ""] || p.paymentMethod}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[p.status] || ""}>
                        {p.status === "COMPLETED" ? "הושלם" : p.status === "PENDING" ? "ממתין" : p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
