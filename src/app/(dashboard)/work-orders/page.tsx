"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"
import {
  Loader2,
  Search,
  CheckCircle,
  Package,
  Clock,
  Users,
  AlertCircle,
  ExternalLink,
  Send,
  UserPlus,
} from "lucide-react"
import { NewOrderWizardDialog } from "@/components/customers/new-order-wizard-dialog"
import { SendOrderWizardDialog } from "@/components/customers/send-order-wizard-dialog"

interface WorkOrderCustomer {
  id: number
  fullName: string
  email: string
  phone: string
  status: string
  orderSentAt: string | null
  createdAt: string
  purchaseDate: string
  amountPaid: number
  organName: string
  setTypeName: string
  hasPaid: boolean
}

type FilterType = "all" | "pending_approval" | "order_not_sent"

export default function WorkOrdersPage() {
  const { toast } = useToast()
  const [customers, setCustomers] = useState<WorkOrderCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ total: 0, pendingApproval: 0, orderNotSent: 0 })
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [approvingId, setApprovingId] = useState<number | null>(null)

  // Wizard dialogs
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [sendOrderOpen, setSendOrderOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<WorkOrderCustomer | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/work-orders")
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
        setCounts(data.counts || { total: 0, pendingApproval: 0, orderNotSent: 0 })
      }
    } catch {
      toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleApprove = async (customerId: number) => {
    setApprovingId(customerId)
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      })
      if (!res.ok) throw new Error("שגיאה באישור")
      toast({ title: "הלקוח אושר בהצלחה", variant: "success" as "default" })
      fetchData()
    } catch {
      toast({ title: "שגיאה באישור הלקוח", variant: "destructive" })
    } finally {
      setApprovingId(null)
    }
  }

  const handleSendOrder = (customer: WorkOrderCustomer) => {
    setSelectedCustomer(customer)
    setSendOrderOpen(true)
  }

  // Filtered list
  const filtered = customers.filter((c) => {
    // Search filter
    if (search) {
      const q = search.toLowerCase()
      if (
        !c.fullName.toLowerCase().includes(q) &&
        !c.email.toLowerCase().includes(q) &&
        !String(c.id).includes(q)
      ) {
        return false
      }
    }
    // Status filter
    if (filter === "pending_approval" && c.status !== "PENDING_APPROVAL") return false
    if (filter === "order_not_sent" && c.orderSentAt !== null) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
            רשימת עבודה — הזמנות
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            ניהול לקוחות חדשים: אישור, הכנה ושליחת הזמנות
          </p>
        </div>
        <Button onClick={() => setNewOrderOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          הזמנת לקוח חדש
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer transition-all ${filter === "all" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setFilter("all")}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.total}</p>
              <p className="text-xs text-muted-foreground">סה&quot;כ ברשימה</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${filter === "pending_approval" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setFilter("pending_approval")}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-yellow-100 text-yellow-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.pendingApproval}</p>
              <p className="text-xs text-muted-foreground">ממתינים לאישור</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${filter === "order_not_sent" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setFilter("order_not_sent")}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.orderNotSent}</p>
              <p className="text-xs text-muted-foreground">הזמנה לא נשלחה</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">לקוחות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם, מייל או מזהה..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל ({counts.total})</SelectItem>
                <SelectItem value="pending_approval">ממתינים לאישור ({counts.pendingApproval})</SelectItem>
                <SelectItem value="order_not_sent">הזמנה לא נשלחה ({counts.orderNotSent})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{search ? "לא נמצאו תוצאות" : "אין לקוחות ברשימת העבודה"}</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">מזהה</TableHead>
                    <TableHead>שם</TableHead>
                    <TableHead>אורגן</TableHead>
                    <TableHead>סט</TableHead>
                    <TableHead>מייל</TableHead>
                    <TableHead className="text-center">סטטוס</TableHead>
                    <TableHead className="text-center">הזמנה נשלחה</TableHead>
                    <TableHead className="text-center">שילם</TableHead>
                    <TableHead>תאריך יצירה</TableHead>
                    <TableHead className="text-center">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id}</TableCell>
                      <TableCell>
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-medium text-blue-700 hover:underline flex items-center gap-1"
                        >
                          {c.fullName}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{c.organName}</TableCell>
                      <TableCell className="text-sm">{c.setTypeName}</TableCell>
                      <TableCell className="text-xs" dir="ltr">{c.email}</TableCell>
                      <TableCell className="text-center">
                        {c.status === "PENDING_APPROVAL" ? (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            ממתין לאישור
                          </Badge>
                        ) : c.status === "ACTIVE" ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            פעיל
                          </Badge>
                        ) : (
                          <Badge variant="outline">{c.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.orderSentAt ? (
                          <div className="flex items-center justify-center gap-1 text-green-600">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span className="text-xs">{formatDate(c.orderSentAt)}</span>
                          </div>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                            לא נשלחה
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.hasPaid ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {c.status === "PENDING_APPROVAL" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                              onClick={() => handleApprove(c.id)}
                              disabled={approvingId === c.id}
                            >
                              {approvingId === c.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3 ml-1" />
                              )}
                              אשר
                            </Button>
                          )}
                          {!c.orderSentAt && c.hasPaid && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                              onClick={() => handleSendOrder(c)}
                            >
                              <Send className="h-3 w-3 ml-1" />
                              שלח הזמנה
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wizards */}
      <NewOrderWizardDialog
        open={newOrderOpen}
        onOpenChange={setNewOrderOpen}
        onSuccess={fetchData}
      />

      {selectedCustomer && (
        <SendOrderWizardDialog
          open={sendOrderOpen}
          onOpenChange={setSendOrderOpen}
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.fullName}
          customerEmail={selectedCustomer.email}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}
