"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Send, Loader2, CheckCircle2, AlertCircle, CreditCard, Link2, Copy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface QuoteCustomer {
  id: number
  fullName: string
  email: string
  organ: string
  setType: string
  currentVersion: string | null
  includesUpdates: boolean
}

interface CustomerLinkState {
  status: "pending" | "creating" | "ready" | "sending" | "sent" | "error"
  url?: string
  amount?: number
  error?: string
}

interface StepQuotesProps {
  updateId: string
  quoteCustomers: QuoteCustomer[]
}

export function StepQuotes({ updateId, quoteCustomers }: StepQuotesProps) {
  const { toast } = useToast()
  const [linkStates, setLinkStates] = useState<Map<number, CustomerLinkState>>(new Map())
  const [creatingAll, setCreatingAll] = useState(false)
  const [sendingAll, setSendingAll] = useState(false)
  const [sendProgress, setSendProgress] = useState(0)

  const getState = (id: number): CustomerLinkState =>
    linkStates.get(id) || { status: "pending" }

  const updateState = (id: number, state: Partial<CustomerLinkState>) => {
    setLinkStates((prev) => {
      const next = new Map(prev)
      next.set(id, { ...getState(id), ...state } as CustomerLinkState)
      return next
    })
  }

  const createLinkForCustomer = async (customerId: number) => {
    updateState(customerId, { status: "creating" })
    try {
      const res = await fetch(`/api/customers/${customerId}/payment-link`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "שגיאה")
      }
      const data = await res.json()
      updateState(customerId, { status: "ready", url: data.url, amount: data.amount })
    } catch (err) {
      updateState(customerId, { status: "error", error: err instanceof Error ? err.message : "שגיאה" })
    }
  }

  const createAllLinks = async () => {
    setCreatingAll(true)
    for (const customer of quoteCustomers) {
      const current = getState(customer.id)
      if (current.status === "ready" || current.status === "sent") continue
      await createLinkForCustomer(customer.id)
    }
    setCreatingAll(false)
    toast({ title: "לינקי תשלום נוצרו" })
  }

  const sendAllQuotes = async () => {
    const readyCustomers = quoteCustomers.filter((c) => getState(c.id).status === "ready")
    if (readyCustomers.length === 0) {
      toast({ title: "אין לקוחות מוכנים לשליחה", variant: "destructive" })
      return
    }

    setSendingAll(true)
    setSendProgress(0)
    let sent = 0

    for (const customer of readyCustomers) {
      updateState(customer.id, { status: "sending" })
      try {
        const res = await fetch(`/api/updates/${updateId}/wizard/send-quotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customers: [{
              id: customer.id,
              paymentLink: getState(customer.id).url,
            }],
          }),
        })
        if (res.ok) {
          updateState(customer.id, { status: "sent" })
          sent++
        } else {
          updateState(customer.id, { status: "error", error: "שליחה נכשלה" })
        }
      } catch {
        updateState(customer.id, { status: "error", error: "שגיאת רשת" })
      }
      setSendProgress(Math.round(((sent + 1) / readyCustomers.length) * 100))
    }

    setSendingAll(false)
    toast({ title: `נשלחו ${sent} הצעות מחיר` })
  }

  const readyCount = quoteCustomers.filter((c) => getState(c.id).status === "ready").length
  const sentCount = quoteCustomers.filter((c) => getState(c.id).status === "sent").length
  const totalCount = quoteCustomers.length

  if (totalCount === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>כל הלקוחות מעודכנים — אין הצעות מחיר לשלוח</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">הצעות מחיר — לקוחות לא מעודכנים</h3>
        <p className="text-sm text-muted-foreground mt-1">
          צור לינקי תשלום אישיים ושלח הצעות מחיר ללקוחות שצריכים עדכון או השלמת סט
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary">{totalCount} לקוחות</Badge>
        {readyCount > 0 && (
          <Badge className="bg-green-100 text-green-700 border-green-200">{readyCount} מוכנים</Badge>
        )}
        {sentCount > 0 && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">{sentCount} נשלחו</Badge>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={createAllLinks} disabled={creatingAll || sendingAll} className="gap-2">
          {creatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          צור לינקי תשלום לכולם
        </Button>
        <Button
          onClick={sendAllQuotes}
          disabled={sendingAll || readyCount === 0}
          variant="default"
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
          {sendingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          שלח הצעות מחיר ({readyCount})
        </Button>
      </div>

      {sendingAll && (
        <Progress value={sendProgress} className="h-2 [&>div]:bg-green-500" />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">רשימת לקוחות</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">מזהה</TableHead>
                <TableHead>שם</TableHead>
                <TableHead>אורגן</TableHead>
                <TableHead>סט</TableHead>
                <TableHead className="w-[80px]">גרסה</TableHead>
                <TableHead className="w-[100px]">סכום</TableHead>
                <TableHead className="w-[120px]">סטטוס</TableHead>
                <TableHead className="w-[80px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quoteCustomers.map((customer) => {
                const state = getState(customer.id)
                return (
                  <TableRow key={customer.id}>
                    <TableCell className="font-mono text-xs">{customer.id}</TableCell>
                    <TableCell className="font-medium text-sm">{customer.fullName}</TableCell>
                    <TableCell className="text-sm">{customer.organ}</TableCell>
                    <TableCell className="text-sm">{customer.setType}</TableCell>
                    <TableCell className="text-xs">{customer.currentVersion || "—"}</TableCell>
                    <TableCell>
                      {state.amount != null ? (
                        <span className="font-semibold text-sm text-orange-700">
                          ₪{state.amount.toLocaleString("he-IL")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={state.status} error={state.error} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {state.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="צור לינק"
                            onClick={() => createLinkForCustomer(customer.id)}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {state.url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="העתק לינק"
                            onClick={() => {
                              navigator.clipboard.writeText(state.url!)
                              toast({ title: "לינק הועתק" })
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status, error }: { status: string; error?: string }) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="text-[10px] bg-gray-50">ממתין</Badge>
    case "creating":
      return <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700"><Loader2 className="h-3 w-3 animate-spin ml-1" />יוצר לינק</Badge>
    case "ready":
      return <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700"><CheckCircle2 className="h-3 w-3 ml-1" />מוכן</Badge>
    case "sending":
      return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700"><Loader2 className="h-3 w-3 animate-spin ml-1" />שולח</Badge>
    case "sent":
      return <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-800"><CheckCircle2 className="h-3 w-3 ml-1" />נשלח</Badge>
    case "error":
      return (
        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700" title={error}>
          <AlertCircle className="h-3 w-3 ml-1" />שגיאה
        </Badge>
      )
    default:
      return null
  }
}
