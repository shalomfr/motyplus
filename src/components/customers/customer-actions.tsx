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
  MessageCircle,
  PartyPopper,
  Wrench,
  ChevronDown,
  ChevronUp,
  Music,
  Headphones,
  BookOpen,
  Upload,
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
  customerPhone: string
  customerWhatsapp: string | null
  status: "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION"
  sampleType: "CPI" | "CPF"
  amountPaid: number
  balance: number | null
  infoFileUrl: string | null
  additionalInfoFileUrl: string | null
  linkedCustomer: LinkedCustomer | null
  updates: CustomerUpdate[]
  activityLog: ActivityLogEntry[]
  onStatusChange: () => void
}

export function CustomerActions({
  customerId,
  customerEmail,
  customerName,
  customerPhone,
  customerWhatsapp,
  status,
  sampleType,
  amountPaid,
  balance,
  infoFileUrl,
  additionalInfoFileUrl,
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
  const [sendMenuOpen, setSendMenuOpen] = useState(false)

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
    handleAction("toggleBlock", `/api/customers/${customerId}`, "PUT", {
      status: newStatus,
    })
  }

  const handleToggleException = () => {
    const newStatus = status === "EXCEPTION" ? "ACTIVE" : "EXCEPTION"
    handleAction("toggleException", `/api/customers/${customerId}`, "PUT", {
      status: newStatus,
    })
  }

  const handleFreeze = () => {
    handleAction("freeze", `/api/customers/${customerId}`, "PUT", {
      status: "FROZEN",
    })
  }

  const handleToggleSampleType = () => {
    const newType = sampleType === "CPI" ? "CPF" : "CPI"
    handleAction("sampleType", `/api/customers/${customerId}`, "PUT", {
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

  const handleSendWelcomeEmail = () => {
    handleAction(
      "welcomeEmail",
      `/api/customers/${customerId}/send-welcome-email`,
      "POST"
    )
  }

  const handleSendUpdateRequest = () => {
    handleAction(
      "updateRequest",
      `/api/customers/${customerId}/send-update-request`,
      "POST"
    )
  }

  const handleWhatsAppGreeting = async () => {
    const phone = customerWhatsapp || customerPhone
    if (!phone) {
      toast({ title: "שגיאה", description: "אין מספר טלפון ללקוח", variant: "destructive" })
      return
    }
    setLoadingAction("waGreeting")
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          message: `שלום ${customerName}, תודה רבה על הרכישה! 🎹 ברוכים הבאים למשפחת מוטי פלוס!`,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "נשלח!", description: "הודעת ברכה נשלחה בהצלחה בוואטסאפ" })
      } else {
        toast({ title: "שגיאה", description: data.error || "שליחה נכשלה", variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "שגיאה", description: "לא ניתן לשלוח הודעה. ודא שוואטסאפ מחובר בהגדרות", variant: "destructive" })
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* #16: תפריט שליחות — 8 אפשרויות */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base cursor-pointer flex items-center justify-between" onClick={() => setSendMenuOpen(!sendMenuOpen)}>
            <span>תפריט שליחות</span>
            {sendMenuOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
          <CardDescription>8 אפשרויות שליחה ללקוח</CardDescription>
        </CardHeader>
        {sendMenuOpen && (
        <CardContent className="space-y-2">
          {/* 1. מייל ברכה */}
          <Button variant="outline" className="w-full justify-start text-green-700 border-green-200 hover:bg-green-50" onClick={handleSendWelcomeEmail} disabled={loadingAction === "welcomeEmail"}>
            {loadingAction === "welcomeEmail" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <PartyPopper className="h-4 w-4 ml-2" />}
            1. מייל ברכה לאחר רכישה
          </Button>
          {/* 2. מקצבים בלבד */}
          <Button variant="outline" className="w-full justify-start" onClick={handleSendUpdateEmail} disabled={loadingAction === "sendUpdate"}>
            {loadingAction === "sendUpdate" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Music className="h-4 w-4 ml-2" />}
            2. שליחת מקצבים בלבד
          </Button>
          {/* 3. דגימות בלבד */}
          <Button variant="outline" className="w-full justify-start" onClick={() => handleAction("sendSamples", `/api/customers/${customerId}/send-update-email`, "POST", { samplesOnly: true })} disabled={loadingAction === "sendSamples"}>
            {loadingAction === "sendSamples" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Headphones className="h-4 w-4 ml-2" />}
            3. שליחת דגימות בלבד
          </Button>
          {/* 4. מקצבים + דגימות */}
          <Button variant="outline" className="w-full justify-start" onClick={() => handleAction("sendBoth", `/api/customers/${customerId}/send-update-email`, "POST", { includeSamples: true })} disabled={loadingAction === "sendBoth"}>
            {loadingAction === "sendBoth" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Mail className="h-4 w-4 ml-2" />}
            4. שליחת מקצבים ודגימות
          </Button>
          {/* 5. הוראות בלבד */}
          <Button variant="outline" className="w-full justify-start" onClick={() => handleAction("sendInstructions", `/api/customers/${customerId}/send-email`, "POST", { subject: "הוראות שימוש", body: "הוראות שימוש מצורפות" })} disabled={loadingAction === "sendInstructions"}>
            {loadingAction === "sendInstructions" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <BookOpen className="h-4 w-4 ml-2" />}
            5. שליחת הוראות בלבד
          </Button>
          {/* 6. מייל חופשי */}
          <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <Send className="h-4 w-4 ml-2" />
                6. שליחת מייל חופשי
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>שליחת מייל חופשי</DialogTitle>
                <DialogDescription>שליחת מייל ל-{customerName} ({customerEmail})</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="emailSubject">נושא</Label>
                  <Input id="emailSubject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="נושא המייל" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailBody">תוכן</Label>
                  <Textarea id="emailBody" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="תוכן המייל..." rows={6} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>ביטול</Button>
                <Button onClick={handleSendCustomEmail} disabled={isSendingEmail}>
                  {isSendingEmail ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
                  שלח מייל
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* 7. טופס עדכון פרטים */}
          <Button variant="outline" className="w-full justify-start" onClick={handleSendDetailsForm} disabled={loadingAction === "detailsForm"}>
            {loadingAction === "detailsForm" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <FileText className="h-4 w-4 ml-2" />}
            7. שליחת טופס עדכון פרטים
          </Button>
          {/* 8. הצעת מחיר */}
          <Button variant="outline" className="w-full justify-start" onClick={handleSendQuote} disabled={loadingAction === "priceQuote"}>
            {loadingAction === "priceQuote" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Receipt className="h-4 w-4 ml-2" />}
            8. שליחת הצעת מחיר ליתרה
          </Button>
        </CardContent>
        )}
      </Card>

      {/* פעולות מהירות */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">פעולות מהירות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={handleCopyId}>
            <Copy className="h-4 w-4 ml-2" />
            העתקת מזהה ({customerId})
          </Button>

          <Button variant="outline" className="w-full justify-start text-blue-700 border-blue-200 hover:bg-blue-50" onClick={handleSendUpdateRequest} disabled={loadingAction === "updateRequest"}>
            {loadingAction === "updateRequest" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Wrench className="h-4 w-4 ml-2" />}
            הכנת עדכון (שלח לאדמין)
          </Button>

          {/* #18: תפריט WhatsApp מלא */}
          <Button variant="outline" className="w-full justify-start text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleWhatsAppGreeting} disabled={loadingAction === "waGreeting"}>
            {loadingAction === "waGreeting" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <MessageCircle className="h-4 w-4 ml-2" />}
            וואטסאפ ברכה
          </Button>

          <Button variant="outline" className="w-full justify-start text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            onClick={() => {
              const phone = (customerWhatsapp || customerPhone).replace(/\D/g, "")
              const intlPhone = phone.startsWith("0") ? "972" + phone.slice(1) : phone
              window.open(`https://wa.me/${intlPhone}`, "_blank")
            }}
          >
            <ExternalLink className="h-4 w-4 ml-2" />
            פתח צ&apos;אט WhatsApp
          </Button>

          {/* בדיקת דגימות — האם יש ללקוח קובץ דגימות */}
          <Button variant="outline" className="w-full justify-start"
            onClick={async () => {
              setLoadingAction("checkSamples")
              try {
                const res = await fetch(`/api/customers/${customerId}/updates`)
                const data = await res.json()
                const hasSamples = data?.some?.((u: { downloadedAt: string | null }) => u.downloadedAt)
                toast({
                  title: hasSamples ? "יש דגימות ללקוח" : "אין דגימות ללקוח",
                  description: hasSamples ? "הלקוח הוריד דגימות בעבר" : "הלקוח לא הוריד דגימות",
                  variant: hasSamples ? ("success" as "default") : "destructive",
                })
              } catch {
                toast({ title: "שגיאה בבדיקה", variant: "destructive" })
              } finally {
                setLoadingAction(null)
              }
            }}
            disabled={loadingAction === "checkSamples"}
          >
            {loadingAction === "checkSamples" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Headphones className="h-4 w-4 ml-2" />}
            בדיקת דגימות
          </Button>

          {/* שליחת אינפו ללקוח */}
          {infoFileUrl && (
            <Button variant="outline" className="w-full justify-start"
              onClick={() => handleAction("sendInfo", `/api/customers/${customerId}/send-email`, "POST", {
                subject: "קובץ אינפו שלך",
                body: `<p>שלום ${customerName},</p><p>מצורף קישור לקובץ האינפו שלך:</p><p><a href="${infoFileUrl}">לחץ להורדה</a></p>`,
              })}
              disabled={loadingAction === "sendInfo"}
            >
              {loadingAction === "sendInfo" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Mail className="h-4 w-4 ml-2" />}
              שלח אינפו ללקוח במייל
            </Button>
          )}

          {/* #15: קישור להעלאת אינפו */}
          <Button variant="outline" className="w-full justify-start"
            onClick={async () => {
              try {
                const res = await fetch(`/api/customers/${customerId}/upload-link`, { method: "POST" })
                const data = await res.json()
                if (data.link) {
                  navigator.clipboard.writeText(data.link)
                  toast({ title: "הקישור הועתק!", description: data.link })
                } else {
                  toast({ title: "שגיאה", description: data.error || "לא ניתן ליצור קישור", variant: "destructive" })
                }
              } catch {
                toast({ title: "שגיאה", description: "לא ניתן ליצור קישור", variant: "destructive" })
              }
            }}
          >
            <Upload className="h-4 w-4 ml-2" />
            צור קישור להעלאת אינפו
          </Button>

          <Button variant="outline" className={cn("w-full justify-start", status === "BLOCKED" && "border-red-300 text-red-700")} onClick={handleToggleBlock} disabled={loadingAction === "toggleBlock"}>
            {loadingAction === "toggleBlock" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Ban className="h-4 w-4 ml-2" />}
            {status === "BLOCKED" ? "שחרור חסימה" : "חסימה"}
          </Button>

          <Button variant="outline" className={cn("w-full justify-start", status === "EXCEPTION" && "border-orange-300 text-orange-700")} onClick={handleToggleException} disabled={loadingAction === "toggleException"}>
            {loadingAction === "toggleException" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 ml-2" />}
            {status === "EXCEPTION" ? "ביטול חריג" : "סימון חריג"}
          </Button>

          <Button variant="outline" className="w-full justify-start" onClick={handleFreeze} disabled={loadingAction === "freeze" || status === "FROZEN"}>
            {loadingAction === "freeze" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Snowflake className="h-4 w-4 ml-2" />}
            הקפאה
          </Button>

          <Button variant="outline" className="w-full justify-start" onClick={handleToggleSampleType} disabled={loadingAction === "sampleType"}>
            {loadingAction === "sampleType" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Monitor className="h-4 w-4 ml-2" />}
            דגימות למחשב: {sampleType}
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
            <span className="text-sm text-muted-foreground">נותר לתשלום</span>
            <span
              className={cn(
                "font-semibold",
                balance !== null && balance > 0 && "text-red-600",
                balance !== null && balance <= 0 && "text-green-600"
              )}
            >
              {balance !== null && balance > 0
                ? formatCurrency(balance)
                : balance !== null && balance <= 0
                  ? "שולם במלואו"
                  : "-"}
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
