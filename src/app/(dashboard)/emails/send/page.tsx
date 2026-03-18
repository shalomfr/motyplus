"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmailEditor } from "@/components/emails/email-editor"
import { EmailPreview } from "@/components/emails/email-preview"
import { ArrowRight, Send, Loader2, AlertTriangle, Users, User } from "lucide-react"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  variables: string[]
}

interface Organ {
  id: string
  name: string
}

type RecipientType = "single" | "filtered" | "all"

export default function SendEmailPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [organs, setOrgans] = useState<Organ[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [recipientType, setRecipientType] = useState<RecipientType>("single")
  const [singleEmail, setSingleEmail] = useState("")

  // Filter state
  const [filterOrgan, setFilterOrgan] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterUpdateStatus, setFilterUpdateStatus] = useState<string>("all")

  const [recipientCount, setRecipientCount] = useState<number>(0)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templatesRes, organsRes] = await Promise.all([
          fetch("/api/emails/templates"),
          fetch("/api/data/organs"),
        ])

        if (templatesRes.ok) {
          const data = await templatesRes.json()
          setTemplates(data.templates || data)
        }
        if (organsRes.ok) {
          const data = await organsRes.json()
          setOrgans(data.organs || data)
        }
      } catch (err) {
        console.error("Error fetching data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Fetch recipient count when filters change
  useEffect(() => {
    if (recipientType === "single") {
      setRecipientCount(singleEmail ? 1 : 0)
      return
    }

    const fetchCount = async () => {
      const params = new URLSearchParams()
      if (filterOrgan !== "all") params.set("organId", filterOrgan)
      if (filterStatus !== "all") params.set("status", filterStatus)
      if (filterUpdateStatus !== "all") params.set("updateStatus", filterUpdateStatus)
      if (recipientType === "all") params.set("all", "true")

      try {
        const res = await fetch(`/api/emails/recipients/count?${params}`)
        if (res.ok) {
          const data = await res.json()
          setRecipientCount(data.count || 0)
        }
      } catch {
        // Silently handle - count display is informational
      }
    }

    fetchCount()
  }, [recipientType, filterOrgan, filterStatus, filterUpdateStatus, singleEmail])

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (templateId === "custom") {
      setSubject("")
      setBody("")
      return
    }
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
    }
  }

  const handleSendClick = () => {
    setError("")
    if (!subject.trim()) {
      setError("יש להזין נושא למייל")
      return
    }
    if (!body.trim()) {
      setError("יש להזין תוכן למייל")
      return
    }
    if (recipientType === "single" && !singleEmail.trim()) {
      setError("יש להזין כתובת מייל של הנמען")
      return
    }
    setShowConfirm(true)
  }

  const handleSendConfirm = async () => {
    setSending(true)
    setError("")
    setShowConfirm(false)

    try {
      const payload: Record<string, unknown> = {
        subject,
        body,
        recipientType,
        templateId: selectedTemplateId !== "custom" ? selectedTemplateId : undefined,
      }

      if (recipientType === "single") {
        payload.toEmail = singleEmail
      } else {
        if (filterOrgan !== "all") payload.organId = filterOrgan
        if (filterStatus !== "all") payload.status = filterStatus
        if (filterUpdateStatus !== "all") payload.updateStatus = filterUpdateStatus
      }

      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "שגיאה בשליחת המייל")
      }

      const data = await res.json()
      setSuccess(`המייל נשלח בהצלחה ל-${data.sentCount || 1} נמענים`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחת המייל")
    } finally {
      setSending(false)
    }
  }

  const handleSendTest = async () => {
    setSending(true)
    setError("")

    try {
      const res = await fetch("/api/emails/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "שגיאה בשליחת מייל בדיקה")
      }

      setSuccess("מייל בדיקה נשלח בהצלחה")
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחת מייל בדיקה")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/emails")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">שליחת מייל</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side - Compose */}
        <div className="space-y-4">
          {/* Template selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">בחר תבנית או כתוב חדש</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>תבנית</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר תבנית..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">כתיבה חופשית</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">נושא</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="נושא המייל"
                />
              </div>

              <EmailEditor value={body} onChange={setBody} />
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">נמענים</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>סוג שליחה</Label>
                <Select
                  value={recipientType}
                  onValueChange={(v) => setRecipientType(v as RecipientType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        לקוח בודד
                      </div>
                    </SelectItem>
                    <SelectItem value="filtered">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        קבוצה מסוננת
                      </div>
                    </SelectItem>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        כל הלקוחות
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recipientType === "single" && (
                <div className="space-y-2">
                  <Label htmlFor="email">כתובת מייל</Label>
                  <Input
                    id="email"
                    type="email"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    placeholder="email@example.com"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
              )}

              {recipientType === "filtered" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>אורגן</Label>
                    <Select value={filterOrgan} onValueChange={setFilterOrgan}>
                      <SelectTrigger>
                        <SelectValue placeholder="כל האורגנים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל האורגנים</SelectItem>
                        {organs.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>סטטוס לקוח</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="כל הסטטוסים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל הסטטוסים</SelectItem>
                        <SelectItem value="ACTIVE">פעיל</SelectItem>
                        <SelectItem value="BLOCKED">חסום</SelectItem>
                        <SelectItem value="FROZEN">מוקפא</SelectItem>
                        <SelectItem value="EXCEPTION">חריג</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>סטטוס עדכון</Label>
                    <Select value={filterUpdateStatus} onValueChange={setFilterUpdateStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="הכל" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">הכל</SelectItem>
                        <SelectItem value="eligible">זכאים לעדכון</SelectItem>
                        <SelectItem value="expired">פג תוקף עדכון</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="bg-muted/50 p-3 rounded-md text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>
                  {recipientCount} נמענים{recipientType === "all" ? " (כל הלקוחות)" : ""}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right side - Preview & Actions */}
        <div className="space-y-4">
          <EmailPreview
            subject={subject}
            body={body}
            recipient={recipientType === "single" ? singleEmail : undefined}
          />

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-2">
                <Button onClick={handleSendClick} disabled={sending} className="flex-1">
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Send className="h-4 w-4 ml-2" />
                  )}
                  שלח מייל
                </Button>
                <Button variant="outline" onClick={handleSendTest} disabled={sending}>
                  שלח בדיקה
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              אישור שליחת מייל
            </DialogTitle>
            <DialogDescription>
              {recipientType === "all" ? (
                <span className="text-red-600 font-medium">
                  אתה עומד לשלוח מייל לכל {recipientCount} הלקוחות במערכת.
                </span>
              ) : recipientType === "filtered" ? (
                <span>
                  המייל ישלח ל-{recipientCount} נמענים לפי הסינון שנבחר.
                </span>
              ) : (
                <span>המייל ישלח ל-{singleEmail}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 p-3 rounded-md text-sm space-y-1">
            <p><strong>נושא:</strong> {subject}</p>
            <p><strong>נמענים:</strong> {recipientCount}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              ביטול
            </Button>
            <Button onClick={handleSendConfirm} disabled={sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Send className="h-4 w-4 ml-2" />
              )}
              אישור ושליחה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
