"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import {
  Mail,
  Send,
  Ban,
  Snowflake,
  AlertTriangle,
  Copy,
  FileText,
  Monitor,
  Link2,
  Receipt,
  Loader2,
  CheckCircle,
  XCircle,
  Download,
  Clock,
  ExternalLink,
} from "lucide-react"

interface CustomerUpdate {
  id: string
  version: string
  sentAt: string | null
  downloadedAt: string | null
}

interface ActivityLogEntry {
  id: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  userName: string | null
}

interface LinkedCustomer {
  id: number
  fullName: string
  organName: string
}

interface CustomerActionsProps {
  customerId: number
  customerEmail: string
  customerName: string
  status: "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION"
  sampleType: "CPI" | "CPF"
  amountPaid: number
  balance: number | null
  linkedCustomer: LinkedCustomer | null
  updates: CustomerUpdate[]
  activityLog: ActivityLogEntry[]
  onStatusChange: () => void
}

export function CustomerActions({
  customerId,
  customerEmail,
  customerName,
  status,
  sampleType,
  amountPaid,
  balance,
  linkedCustomer,
  updates,
  activityLog,
  onStatusChange,
}: CustomerActionsProps) {
  const { toast } = useToast()
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const handleAction = async (
    action: string,
    endpoint: string,
    method: string = "POST",
    body?: Record<string, unknown>
  ) => {
    setLoadingAction(action)
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "שגיאה בביצוע הפעולה")
      }
      toast({
        title: "הפעולה בוצעה בהצלחה",
        variant: "success" as "default",
      })
      onStatusChange()
    } catch (error) {
      toast({
        title: "שגיאה",
        description:
          error instanceof Error ? error.message : "שגיאה בביצוע הפעולה",
        variant: "destructive",
      })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleSendUpdateEmail = () => {
    handleAction(
      "sendUpdate",
      `/api/customers/${customerId}/send-update-email`,
      "POST"
    )
  }

  const handleSendCustomEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({
        title: "שגיאה",
        description: "יש למלא נושא ותוכן המייל",
        variant: "destructive",
      })
      return
    }
    setIsSendingEmail(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: emailSubject,
          body: emailBody,
        }),
      })
      if (!res.ok) throw new Error("שגיאה בשליחת המייל")
      toast({
        title: "המייל נשלח בהצלחה",
        variant: "success" as "default",
      })
      setIsEmailDialogOpen(false)
      setEmailSubject("")
      setEmailBody("")
      onStatusChange()
    } catch (error) {
      toast({
        title: "שגיאה",
        description:
          error instanceof Error ? error.message : "שגיאה בשליחת המייל",
        variant: "destructive",
      })
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleToggleBlock = () => {
    const newStatus = status === "BLOCKED" ? "ACTIVE" : "BLOCKED"
    handleAction("toggleBlock", `/api/customers/${customerId}`, "PATCH", {
      status: newStatus,
    })
  }

  const handleToggleException = () => {
    const newStatus = status === "EXCEPTION" ? "ACTIVE" : "EXCEPTION"
    handleAction("toggleException", `/api/customers/${customerId}`, "PATCH", {
      status: newStatus,
    })
  }

  const handleFreeze = () => {
    handleAction("freeze", `/api/customers/${customerId}`, "PATCH", {
      status: "FROZEN",
    })
  }

  const handleToggleSampleType = () => {
    const newType = sampleType === "CPI" ? "CPF" : "CPI"
    handleAction("sampleType", `/api/customers/${customerId}`, "PATCH", {
      sampleType: newType,
    })
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(customerId.toString())
    toast({
      title: "מזהה הועתק ללוח",
      variant: "success" as "default",
    })
  }

  const handleSendDetailsForm = () => {
    handleAction(
      "detailsForm",
      `/api/customers/${customerId}/send-details-form`,
      "POST"
    )
  }

  const handleSendQuote = () => {
    handleAction(
      "priceQuote",
      `/api/customers/${customerId}/send-price-quote`,
      "POST"
    )
  }

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">פעולות מהירות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleSendUpdateEmail}
            disabled={loadingAction === "sendUpdate"}
          >
            {loadingAction === "sendUpdate" ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 ml-2" />
            )}
            שליחת מייל עדכון
          </Button>

          <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <Send className="h-4 w-4 ml-2" />
                שליחת מייל חופשי
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>שליחת מייל חופשי</DialogTitle>
                <DialogDescription>
                  שליחת מייל ל-{customerName} ({customerEmail})
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="emailSubject">נושא</Label>
                  <Input
                    id="emailSubject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="נושא המייל"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailBody">תוכן</Label>
                  <Textarea
                    id="emailBody"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="תוכן המייל..."
                    rows={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEmailDialogOpen(false)}
                >
                  ביטול
                </Button>
                <Button
                  onClick={handleSendCustomEmail}
                  disabled={isSendingEmail}
                >
                  {isSendingEmail ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 ml-2" />
                  )}
                  שלח מייל
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            className={cn(
              "w-full justify-start",
              status === "BLOCKED" && "border-red-300 text-red-700"
            )}
            onClick={handleToggleBlock}
            disabled={loadingAction === "toggleBlock"}
          >
            {loadingAction === "toggleBlock" ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Ban className="h-4 w-4 ml-2" />
            )}
            {status === "BLOCKED" ? "שחרור חסימה" : "חסימה"}
          </Button>

          <Button
            variant="outline"
            className={cn(
              "w-full justify-start",
              status === "EXCEPTION" && "border-amber-300 text-amber-700"
            )}
            onClick={handleToggleException}
            disabled={loadingAction === "toggleException"}
          >
            {loadingAction === "toggleException" ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4 ml-2" />
            )}
            {status === "EXCEPTION" ? "ביטול חריג" : "סימון חריג"}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleFreeze}
            disabled={
              loadingAction === "freeze" || status === "FROZEN"
            }
          >
            {loadingAction === "freeze" ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Snowflake className="h-4 w-4 ml-2" />
            )}
            הקפאה
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleToggleSampleType}
            disabled={loadingAction === "sampleType"}
          >
            {loadingAction === "sampleType" ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Monitor className="h-4 w-4 ml-2" />
            )}
            דגימות למחשב: {sampleType}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleCopyId}
          >
            <Copy className="h-4 w-4 ml-2" />
            העתקת מזהה ({customerId})
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleSendDetailsForm}
            disabled={loadingAction === "detailsForm"}
          >
            {loadingAction === "detailsForm" ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 ml-2" />
            )}
            שליחת טופס עדכון פרטים
          </Button>
        </CardContent>
      </Card>

      {/* Financial Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">מידע כספי</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">סכום ששולם</span>
            <span className="font-semibold">
              {formatCurrency(amountPaid)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">יתרה</span>
            <span
              className={cn(
                "font-semibold",
                balance !== null && balance > 0 && "text-red-600",
                balance !== null && balance <= 0 && "text-green-600"
              )}
            >
              {balance !== null ? formatCurrency(balance) : "-"}
            </span>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start mt-2"
            onClick={handleSendQuote}
            disabled={loadingAction === "priceQuote"}
          >
            {loadingAction === "priceQuote" ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4 ml-2" />
            )}
            שליחת הצעת מחיר
          </Button>
        </CardContent>
      </Card>

      {/* Linked Customer */}
      {linkedCustomer && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">כרטיס מקושר</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{linkedCustomer.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {linkedCustomer.organName}
                </p>
              </div>
              <Link href={`/customers/${linkedCustomer.id}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4 ml-1" />
                  צפייה
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Update History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">היסטוריית עדכונים</CardTitle>
          <CardDescription>
            {updates.length} עדכונים
          </CardDescription>
        </CardHeader>
        <CardContent>
          {updates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              אין עדכונים
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>גרסה</TableHead>
                    <TableHead>נשלח</TableHead>
                    <TableHead>הורד</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {updates.map((update) => (
                    <TableRow key={update.id}>
                      <TableCell className="font-medium">
                        {update.version}
                      </TableCell>
                      <TableCell>
                        {update.sentAt ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            <span className="text-xs">
                              {formatDate(update.sentAt)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className="text-xs">ממתין</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {update.downloadedAt ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <Download className="h-3 w-3" />
                            <span className="text-xs">
                              {formatDate(update.downloadedAt)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="h-3 w-3" />
                            <span className="text-xs">לא</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">יומן פעילות</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              אין פעילות
            </p>
          ) : (
            <div className="space-y-3">
              {activityLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 text-sm border-b border-muted pb-3 last:border-0 last:pb-0"
                >
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{entry.action}</p>
                    {entry.userName && (
                      <p className="text-xs text-muted-foreground">
                        ע"י {entry.userName}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
