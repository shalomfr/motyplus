"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Plus,
  Search,
  Loader2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"

interface PaymentRow {
  id: string
  amount: number
  description: string | null
  paymentMethod: string | null
  status: string
  receiptUrl: string | null
  createdAt: string
  customer: { id: number; fullName: string }
}

interface CustomerOption {
  id: number
  fullName: string
}

const PAGE_SIZE = 20

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

export default function PaymentsPage() {
  const { toast } = useToast()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // New payment dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [promotions, setPromotions] = useState<{ id: string; name: string; couponCode: string; discountPercent: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [newPayment, setNewPayment] = useState({
    customerId: "",
    amount: "",
    description: "",
    paymentMethod: "cash",
    promotionId: "",
  })

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
      })
      if (search) params.set("search", search)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (methodFilter !== "all") params.set("paymentMethod", methodFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`/api/accounting/payments?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || [])
        setTotalCount(data.pagination?.total || 0)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, methodFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, methodFilter, dateFrom, dateTo])

  const openNewPaymentDialog = async () => {
    setDialogOpen(true)
    try {
      const fetches: Promise<void>[] = []
      if (customers.length === 0) {
        fetches.push(
          fetch("/api/customers?limit=100").then(async (res) => {
            if (res.ok) {
              const data = await res.json()
              setCustomers(
                (data.customers || []).map((c: { id: number; fullName: string }) => ({
                  id: c.id,
                  fullName: c.fullName,
                }))
              )
            }
          })
        )
      }
      if (promotions.length === 0) {
        fetches.push(
          fetch("/api/promotions").then(async (res) => {
            if (res.ok) {
              const data = await res.json()
              setPromotions(
                (data.promotions || data || [])
                  .filter((p: { isActive: boolean }) => p.isActive)
                  .map((p: { id: string; name: string; couponCode: string; discountPercent: number }) => ({
                    id: p.id, name: p.name, couponCode: p.couponCode, discountPercent: p.discountPercent,
                  }))
              )
            }
          })
        )
      }
      await Promise.all(fetches)
    } catch {
      // ignore
    }
  }

  const handleSubmit = async () => {
    if (!newPayment.customerId || !newPayment.amount) {
      toast({ title: "יש למלא לקוח וסכום", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/accounting/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(newPayment.customerId),
          amount: Number(newPayment.amount),
          description: newPayment.description,
          paymentMethod: newPayment.paymentMethod,
          promotionId: newPayment.promotionId || undefined,
        }),
      })
      if (!res.ok) throw new Error("שגיאה בשמירה")
      toast({ title: "התשלום נרשם בהצלחה" })
      setDialogOpen(false)
      setNewPayment({ customerId: "", amount: "", description: "", paymentMethod: "cash", promotionId: "" })
      fetchPayments()
    } catch {
      toast({ title: "שגיאה ברישום התשלום", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-xl sm:text-2xl font-bold">ניהול תשלומים</h1>
        <Button onClick={openNewPaymentDialog} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          רישום תשלום
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 items-end">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="PENDING">ממתין</SelectItem>
            <SelectItem value="COMPLETED">הושלם</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="אמצעי תשלום" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="cash">מזומן</SelectItem>
            <SelectItem value="bank_transfer">העברה</SelectItem>
            <SelectItem value="check">צ'ק</SelectItem>
            <SelectItem value="credit_card">אשראי</SelectItem>
            <SelectItem value="MANUAL">ידני</SelectItem>
            <SelectItem value="ICOUNT">iCount</SelectItem>
            <SelectItem value="STRIPE">Stripe</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[calc(50%-4px)] sm:w-[150px]"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[calc(50%-4px)] sm:w-[150px]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : payments.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">לא נמצאו תשלומים</p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1 sm:mx-0">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">תאריך</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">סכום</TableHead>
                <TableHead className="text-right">תיאור</TableHead>
                <TableHead className="text-right">אמצעי תשלום</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">קבלה</TableHead>
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
                  <TableCell>{p.description || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {methodLabel[p.paymentMethod || ""] || p.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[p.status] || ""}>
                      {p.status === "COMPLETED"
                        ? "הושלם"
                        : p.status === "PENDING"
                        ? "ממתין"
                        : p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.receiptUrl ? (
                      <a
                        href={p.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                עמוד {page} מתוך {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* New Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>רישום תשלום חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>לקוח</Label>
              <Select
                value={newPayment.customerId}
                onValueChange={(v) =>
                  setNewPayment((prev) => ({ ...prev, customerId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>סכום</Label>
              <Input
                type="number"
                value={newPayment.amount}
                onChange={(e) =>
                  setNewPayment((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>תיאור</Label>
              <Input
                value={newPayment.description}
                onChange={(e) =>
                  setNewPayment((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="תיאור התשלום"
              />
            </div>
            <div className="space-y-2">
              <Label>אמצעי תשלום</Label>
              <Select
                value={newPayment.paymentMethod}
                onValueChange={(v) =>
                  setNewPayment((prev) => ({ ...prev, paymentMethod: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">מזומן</SelectItem>
                  <SelectItem value="bank_transfer">העברה</SelectItem>
                  <SelectItem value="check">צ'ק</SelectItem>
                  <SelectItem value="credit_card">אשראי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {promotions.length > 0 && (
              <div className="space-y-2">
                <Label>מבצע / קופון (אופציונלי)</Label>
                <Select
                  value={newPayment.promotionId}
                  onValueChange={(v) =>
                    setNewPayment((prev) => ({ ...prev, promotionId: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="ללא מבצע" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא מבצע</SelectItem>
                    {promotions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.couponCode}) — {p.discountPercent}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
