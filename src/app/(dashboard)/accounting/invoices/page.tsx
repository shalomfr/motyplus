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
import { Plus, ExternalLink, Download, Loader2, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"

interface InvoiceRow {
  id: string
  docNumber: string | null
  docType: string
  amount: number
  docUrl: string | null
  createdAt: string
  customer: { id: number; fullName: string }
}

interface CustomerOption {
  id: number
  fullName: string
}

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
}

const docTypeLabel: Record<string, string> = {
  receipt: "קבלה",
  invoice: "חשבונית מס",
  invoice_receipt: "חשבונית מס-קבלה",
  credit_note: "חשבונית זיכוי",
  quote: "הצעת מחיר",
}

export default function InvoicesPage() {
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [saving, setSaving] = useState(false)
  const [customerId, setCustomerId] = useState("")
  const [docType, setDocType] = useState("tax_invoice")
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/accounting/invoices")
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const openDialog = async () => {
    setDialogOpen(true)
    if (customers.length === 0) {
      try {
        const res = await fetch("/api/customers?limit=100")
        if (res.ok) {
          const data = await res.json()
          setCustomers(
            (data.customers || []).map((c: { id: number; fullName: string }) => ({
              id: c.id,
              fullName: c.fullName,
            }))
          )
        }
      } catch {
        // ignore
      }
    }
  }

  const addItem = () => {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }])
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  const handleSubmit = async () => {
    if (!customerId) {
      toast({ title: "יש לבחור לקוח", variant: "destructive" })
      return
    }
    if (items.some((item) => !item.description || item.unitPrice <= 0)) {
      toast({ title: "יש למלא את כל פרטי הפריטים", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/accounting/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(customerId),
          docType,
          items,
        }),
      })
      if (!res.ok) throw new Error("שגיאה ביצירת מסמך")
      toast({ title: "המסמך נוצר בהצלחה" })
      setDialogOpen(false)
      setCustomerId("")
      setDocType("invoice")
      setItems([{ description: "", quantity: 1, unitPrice: 0 }])
      fetchInvoices()
    } catch {
      toast({ title: "שגיאה ביצירת המסמך", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">חשבוניות והצעות מחיר</h1>
        <Button onClick={openDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          צור מסמך
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">אין מסמכים</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">מספר</TableHead>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead className="text-right">לקוח</TableHead>
              <TableHead className="text-right">סכום</TableHead>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">קישור</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.docNumber || "-"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {docTypeLabel[inv.docType] || inv.docType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/customers/${inv.customer.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {inv.customer.fullName}
                  </Link>
                </TableCell>
                <TableCell>{formatCurrency(inv.amount)}</TableCell>
                <TableCell>{formatDate(inv.createdAt)}</TableCell>
                <TableCell>
                  {inv.docUrl ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={inv.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                        title="צפייה"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <a
                        href={inv.docUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline"
                        title="הורדה"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create Document Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>יצירת מסמך חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>לקוח</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
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
              <Label>סוג מסמך</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tax_invoice">חשבונית מס</SelectItem>
                  <SelectItem value="invoice_receipt">חשבונית מס-קבלה</SelectItem>
                  <SelectItem value="quote">הצעת מחיר</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label>פריטים</Label>
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      placeholder="תיאור"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      placeholder="כמות"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, "quantity", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      placeholder="מחיר"
                      value={item.unitPrice || ""}
                      onChange={(e) =>
                        updateItem(index, "unitPrice", Number(e.target.value))
                      }
                    />
                  </div>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 ml-1" />
                הוסף פריט
              </Button>
            </div>

            {totalAmount > 0 && (
              <div className="text-lg font-semibold">
                סה&quot;כ: {formatCurrency(totalAmount)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              צור מסמך
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
