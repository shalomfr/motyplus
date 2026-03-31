"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CustomerBalanceCard } from "./customer-balance-card"
import { SendOrderWizardDialog } from "./send-order-wizard-dialog"
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
  Package,
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
  status: "PENDING_APPROVAL" | "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION"
  sampleType: "CPI" | "CPF"
  amountPaid: number
  balance: number | null
  includesUpdates: boolean
  currentUpdateVersion: string | null
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
  includesUpdates,
  currentUpdateVersion,
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
  const [sendOrderOpen, setSendOrderOpen] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [whatsappMenuOpen, setWhatsappMenuOpen] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

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

  const handleApprove = () => {
    handleAction("approve", `/api/customers/${customerId}`, "PATCH", {
      action: "approve",
    })
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
      {/* כפתורי פעולה מהירים — מוצגים כשלקוח מצפה לקבל משלוח */}
      {(status === "PENDING_APPROVAL" || status === "ACTIVE") && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => {
              navigator.clipboard.writeText(customerId.toString())
              setCopiedId(true)
              toast({ title: "מזהה הועתק ללוח", variant: "success" as "default" })
              setTimeout(() => setCopiedId(false), 2000)
            }}>
              {copiedId ? <CheckCircle className="h-4 w-4 ml-2 text-green-600" /> : <Copy className="h-4 w-4 ml-2" />}
              {copiedId ? `הועתק! (${customerId})` : `העתקת מזהה (${customerId})`}
            </Button>
            <Button variant="outline" className="w-full justify-start"
              onClick={async () => {
                setLoadingAction("checkSamplesTop")
                try {
                  const res = await fetch(`/api/customers/${customerId}/updates`)
                  const data = await res.json()
                  const hasSamples = data?.some?.((u: { downloadedAt: string | null }) => u.downloadedAt)
                  if (hasSamples) {
                    toast({ title: "נמצאו דגימות!", variant: "success" as "default" })
                  } else {
                    toast({ title: "אין דגימות ללקוח", description: "הלקוח לא הוריד דגימות", variant: "destructive" })
                  }
                } catch {
                  toast({ title: "שגיאה בבדיקה", variant: "destructive" })
                } finally {
                  setLoadingAction(null)
                }
              }}
              disabled={loadingAction === "checkSamplesTop"}
            >
              {loadingAction === "checkSamplesTop" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Headphones className="h-4 w-4 ml-2" />}
              בדוק דגימות
            </Button>
            <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSendUpdateEmail} disabled={loadingAction === "sendUpdate"}>
              {loadingAction === "sendUpdate" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Music className="h-4 w-4 ml-2" />}
              שלח מקצבים
            </Button>
          </CardContent>
        </Card>
      )}

      {/* #16: תפריט שליחות — 9 אפשרויות */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base cursor-pointer flex items-center justify-between" onClick={() => setSendMenuOpen(!sendMenuOpen)}>
            <span>תפריט שליחות</span>
            {sendMenuOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
          <CardDescription>9 אפשרויות שליחה ללקוח</CardDescription>
        </CardHeader>
        {sendMenuOpen && (
        <CardContent className="space-y-2">
          {/* 1. מייל ברכה + מקצבים (לקוח חדש) */}
          <Button variant="outline" className="w-full justify-start text-green-700 border-green-200 hover:bg-green-50" onClick={handleSendWelcomeEmail} disabled={loadingAction === "welcomeEmail"}>
            {loadingAction === "welcomeEmail" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <PartyPopper className="h-4 w-4 ml-2" />}
            1. מייל ברכה + מקצבים (לקוח חדש)
          </Button>
          {/* 2. מייל ברכה + עדכון (לקוח קיים) */}
          <Button variant="outline" className="w-full justify-start text-green-700 border-green-200 hover:bg-green-50" onClick={() => handleAction("welcomeUpdate", `/api/customers/${customerId}/send-welcome-email`, "POST", { updateOnly: true })} disabled={loadingAction === "welcomeUpdate"}>
            {loadingAction === "welcomeUpdate" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Package className="h-4 w-4 ml-2" />}
            2. מייל ברכה + עדכון (לקוח קיים)
          </Button>
          {/* 3. מקצבים + דגימות (בלי ברכה) */}
          <Button variant="outline" className="w-full justify-start" onClick={() => handleAction("sendBoth", `/api/customers/${customerId}/send-update-email`, "POST", { includeSamples: true })} disabled={loadingAction === "sendBoth"}>
            {loadingAction === "sendBoth" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Mail className="h-4 w-4 ml-2" />}
            3. מקצבים + דגימות (בלי ברכה)
          </Button>
          {/* 4. שליחת מקצבים בלבד */}
          <Button variant="outline" className="w-full justify-start" onClick={handleSendUpdateEmail} disabled={loadingAction === "sendUpdate"}>
            {loadingAction === "sendUpdate" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Music className="h-4 w-4 ml-2" />}
            4. שליחת מקצבים בלבד
          </Button>
          {/* 5. שליחת דגימות בלבד */}
          <Button variant="outline" className="w-full justify-start" onClick={() => handleAction("sendSamples", `/api/customers/${customerId}/send-update-email`, "POST", { samplesOnly: true })} disabled={loadingAction === "sendSamples"}>
            {loadingAction === "sendSamples" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Headphones className="h-4 w-4 ml-2" />}
            5. שליחת דגימות בלבד
          </Button>
          {/* 6. הוראות שימוש */}
          <Button variant="outline" className="w-full justify-start" onClick={() => handleAction("sendInstructions", `/api/customers/${customerId}/send-email`, "POST", { subject: "הוראות שימוש", body: "הוראות שימוש מצורפות" })} disabled={loadingAction === "sendInstructions"}>
            {loadingAction === "sendInstructions" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <BookOpen className="h-4 w-4 ml-2" />}
            6. הוראות שימוש
          </Button>
          {/* 7. מייל חופשי */}
          <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <Send className="h-4 w-4 ml-2" />
                7. מייל חופשי
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
          {/* 8. טופס לעדכון פרטים */}
          <Button variant="outline" className="w-full justify-start" onClick={handleSendDetailsForm} disabled={loadingAction === "detailsForm"}>
            {loadingAction === "detailsForm" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <FileText className="h-4 w-4 ml-2" />}
            8. טופס לעדכון פרטים
          </Button>
          {/* 9. שלח אינפו ללקוח */}
          {infoFileUrl && (
            <Button variant="outline" className="w-full justify-start" onClick={() => handleAction("sendInfo", `/api/customers/${customerId}/send-email`, "POST", {
              subject: "קובץ אינפו שלך",
              body: `<p>שלום ${customerName},</p><p>מצורף קישור לקובץ האינפו שלך:</p><p><a href="${infoFileUrl}">לחץ להורדה</a></p>`,
            })} disabled={loadingAction === "sendInfo"}>
              {loadingAction === "sendInfo" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Upload className="h-4 w-4 ml-2" />}
              9. שלח אינפו ללקוח
            </Button>
          )}
        </CardContent>
        )}
      </Card>

      {/* פעולות מהירות */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base cursor-pointer flex items-center justify-between" onClick={() => setQuickActionsOpen(!quickActionsOpen)}>
            <span>פעולות מהירות</span>
            {quickActionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {quickActionsOpen && (
        <CardContent className="space-y-2">
          {/* העתקת מזהה עם אינדיקציית ✓ */}
          <Button variant="outline" className="w-full justify-start" onClick={() => {
            navigator.clipboard.writeText(customerId.toString())
            setCopiedId(true)
            toast({ title: "מזהה הועתק ללוח", variant: "success" as "default" })
            setTimeout(() => setCopiedId(false), 2000)
          }}>
            {copiedId ? <CheckCircle className="h-4 w-4 ml-2 text-green-600" /> : <Copy className="h-4 w-4 ml-2" />}
            {copiedId ? `הועתק! (${customerId})` : `העתקת מזהה (${customerId})`}
          </Button>

          {/* תפריט WhatsApp מתכווץ */}
          <div className="border rounded-md">
            <Button variant="ghost" className="w-full justify-start text-emerald-700 hover:bg-emerald-50" onClick={() => setWhatsappMenuOpen(!whatsappMenuOpen)}>
              <MessageCircle className="h-4 w-4 ml-2" />
              WhatsApp
              {whatsappMenuOpen ? <ChevronUp className="h-4 w-4 mr-auto" /> : <ChevronDown className="h-4 w-4 mr-auto" />}
            </Button>
            {whatsappMenuOpen && (
              <div className="px-2 pb-2 space-y-1">
                <Button variant="outline" size="sm" className="w-full justify-start text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleWhatsAppGreeting} disabled={loadingAction === "waGreeting"}>
                  {loadingAction === "waGreeting" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <MessageCircle className="h-4 w-4 ml-2" />}
                  וואטסאפ ברכה
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  onClick={() => {
                    const phone = (customerWhatsapp || customerPhone).replace(/\D/g, "")
                    const intlPhone = phone.startsWith("0") ? "972" + phone.slice(1) : phone
                    window.open(`https://wa.me/${intlPhone}`, "_blank")
                  }}
                >
                  <ExternalLink className="h-4 w-4 ml-2" />
                  פתח צ&apos;אט WhatsApp
                </Button>
              </div>
            )}
          </div>

          {/* בדיקת דגימות — בודק CPI בדרייב, פותח אשף שליחה */}
          <Button variant="outline" className="w-full justify-start"
            onClick={async () => {
              setLoadingAction("checkSamples")
              try {
                const res = await fetch(`/api/customers/${customerId}/updates`)
                const data = await res.json()
                const hasSamples = data?.some?.((u: { downloadedAt: string | null }) => u.downloadedAt)
                if (hasSamples) {
                  toast({ title: "נמצאו דגימות! פותח אשף שליחה...", variant: "success" as "default" })
                  setSendOrderOpen(true)
                } else {
                  toast({ title: "אין דגימות ללקוח", description: "הלקוח לא הוריד דגימות", variant: "destructive" })
                }
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

          {/* סנכרון לספק חיוב */}
          <Button variant="outline" className="w-full justify-start text-blue-700 border-blue-200 hover:bg-blue-50"
            onClick={async () => {
              setLoadingAction("syncBilling")
              try {
                const res = await fetch(`/api/customers/${customerId}/sync-billing`, { method: "POST" })
                const data = await res.json()
                if (data.success) {
                  toast({ title: "סונכרן לספק חיוב!", description: `מזהה: ${data.billingClientId}` })
                } else {
                  toast({ title: "שגיאה", description: data.error, variant: "destructive" })
                }
              } catch {
                toast({ title: "שגיאה בסנכרון", variant: "destructive" })
              } finally {
                setLoadingAction(null)
              }
            }}
            disabled={loadingAction === "syncBilling"}
          >
            {loadingAction === "syncBilling" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Receipt className="h-4 w-4 ml-2" />}
            סנכרן לספק חיוב
          </Button>

          {/* הנפקת קבלה */}
          <Button variant="outline" className="w-full justify-start text-blue-700 border-blue-200 hover:bg-blue-50"
            onClick={async () => {
              const amountStr = prompt("סכום הקבלה:")
              if (!amountStr) return
              const amount = parseFloat(amountStr)
              if (isNaN(amount) || amount <= 0) { toast({ title: "סכום לא תקין", variant: "destructive" }); return }
              const description = prompt("תיאור (אופציונלי):") || "תשלום"
              setLoadingAction("receipt")
              try {
                const res = await fetch(`/api/customers/${customerId}/receipt`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ amount, description }),
                })
                const data = await res.json()
                if (data.receiptNumber) {
                  toast({ title: `קבלה ${data.receiptNumber} הונפקה!` })
                  onStatusChange()
                } else {
                  toast({ title: "שגיאה", description: data.error, variant: "destructive" })
                }
              } catch {
                toast({ title: "שגיאה בהנפקת קבלה", variant: "destructive" })
              } finally {
                setLoadingAction(null)
              }
            }}
            disabled={loadingAction === "receipt"}
          >
            {loadingAction === "receipt" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Receipt className="h-4 w-4 ml-2" />}
            הנפק קבלה
          </Button>

          {/* צור ושלח קישור להעלאת אינפו — כפתור אחד */}
          <Button variant="outline" className="w-full justify-start"
            onClick={async () => {
              setLoadingAction("createAndSendUploadLink")
              try {
                const res = await fetch(`/api/customers/${customerId}/send-upload-link`, { method: "POST" })
                const data = await res.json()
                if (data.success) {
                  toast({ title: "קישור נוצר ונשלח במייל!", description: customerEmail })
                } else {
                  toast({ title: "שגיאה", description: data.error || "שגיאה ביצירת/שליחת הקישור", variant: "destructive" })
                }
              } catch {
                toast({ title: "שגיאה", description: "שגיאה ביצירת/שליחת הקישור", variant: "destructive" })
              } finally {
                setLoadingAction(null)
              }
            }}
            disabled={loadingAction === "createAndSendUploadLink"}
          >
            {loadingAction === "createAndSendUploadLink" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Link2 className="h-4 w-4 ml-2" />}
            צור ושלח קישור להעלאת אינפו
          </Button>

          {/* החלפת אינפו */}
          {infoFileUrl && (
            <Button variant="outline" className="w-full justify-start"
              onClick={() => {
                const input = document.createElement("input")
                input.type = "file"
                input.accept = ".n27"
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (!file) return
                  setLoadingAction("replaceInfo")
                  try {
                    const formData = new FormData()
                    formData.append("file", file)
                    const res = await fetch(`/api/customers/${customerId}/upload-info`, { method: "POST", body: formData })
                    const data = await res.json()
                    if (res.ok) {
                      toast({ title: "האינפו הוחלף בהצלחה!" })
                      onStatusChange()
                    } else {
                      toast({ title: "שגיאה", description: data.error || "שגיאה בהחלפת אינפו", variant: "destructive" })
                    }
                  } catch {
                    toast({ title: "שגיאה", description: "שגיאה בהחלפת אינפו", variant: "destructive" })
                  } finally {
                    setLoadingAction(null)
                  }
                }
                input.click()
              }}
              disabled={loadingAction === "replaceInfo"}
            >
              {loadingAction === "replaceInfo" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Upload className="h-4 w-4 ml-2" />}
              החלף אינפו
            </Button>
          )}

          {/* החלפת אינפו נוסף */}
          {additionalInfoFileUrl && (
            <Button variant="outline" className="w-full justify-start"
              onClick={() => {
                const input = document.createElement("input")
                input.type = "file"
                input.accept = ".n27"
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (!file) return
                  setLoadingAction("replaceAdditionalInfo")
                  try {
                    const formData = new FormData()
                    formData.append("file", file)
                    const res = await fetch(`/api/customers/${customerId}/upload-info?type=additional`, { method: "POST", body: formData })
                    const data = await res.json()
                    if (res.ok) {
                      toast({ title: "האינפו הנוסף הוחלף בהצלחה!" })
                      onStatusChange()
                    } else {
                      toast({ title: "שגיאה", description: data.error || "שגיאה בהחלפת אינפו", variant: "destructive" })
                    }
                  } catch {
                    toast({ title: "שגיאה", description: "שגיאה בהחלפת אינפו", variant: "destructive" })
                  } finally {
                    setLoadingAction(null)
                  }
                }
                input.click()
              }}
              disabled={loadingAction === "replaceAdditionalInfo"}
            >
              {loadingAction === "replaceAdditionalInfo" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Upload className="h-4 w-4 ml-2" />}
              החלף אינפו נוסף
            </Button>
          )}

          {status === "PENDING_APPROVAL" && (
            <Button variant="outline" className="w-full justify-start border-green-300 bg-green-50 text-green-700 hover:bg-green-100" onClick={handleApprove} disabled={loadingAction === "approve"}>
              {loadingAction === "approve" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <CheckCircle className="h-4 w-4 ml-2" />}
              אשר לקוח
            </Button>
          )}

          <Button variant="outline" className="w-full justify-start text-red-700 border-red-200 hover:bg-red-50" onClick={handleToggleBlock} disabled={loadingAction === "toggleBlock"}>
            {loadingAction === "toggleBlock" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Ban className="h-4 w-4 ml-2" />}
            {status === "BLOCKED" ? "שחרור חסימה" : "חסימה"}
          </Button>

          <Button variant="outline" className="w-full justify-start text-orange-700 border-orange-200 hover:bg-orange-50" onClick={handleToggleException} disabled={loadingAction === "toggleException"}>
            {loadingAction === "toggleException" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 ml-2" />}
            {status === "EXCEPTION" ? "ביטול חריג" : "סימון חריג"}
          </Button>

          <Button variant="outline" className="w-full justify-start text-sky-700 border-sky-200 hover:bg-sky-50" onClick={handleFreeze} disabled={loadingAction === "freeze" || status === "FROZEN"}>
            {loadingAction === "freeze" ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Snowflake className="h-4 w-4 ml-2" />}
            הקפאה
          </Button>
        </CardContent>
        )}
      </Card>

      {/* Balance & Updates Status + Quote Wizard */}
      <CustomerBalanceCard
        customerId={customerId}
        customerName={customerName}
        customerEmail={customerEmail}
        amountPaid={amountPaid}
        onStatusChange={onStatusChange}
      />

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

      {/* Send Order Wizard Dialog */}
      <SendOrderWizardDialog
        open={sendOrderOpen}
        onOpenChange={setSendOrderOpen}
        customerId={customerId}
        customerName={customerName}
        customerEmail={customerEmail}
        onSuccess={onStatusChange}
      />
    </div>
  )
}
