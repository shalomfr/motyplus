"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import DOMPurify from "dompurify"
import {
  Loader2,
  CreditCard,
  Mail,
  Eye,
  Send,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  AlertTriangle,
} from "lucide-react"
import type { BalanceDetails } from "@/lib/services/customer-balance.service"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: string | null
  isActive: boolean
}

interface QuoteWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: number
  customerName: string
  customerEmail: string
  amountPaid: number
  onSuccess?: () => void
}

type WizardStep = "summary" | "template" | "preview"

const STEP_LABELS: Record<WizardStep, string> = {
  summary: "סיכום מצב",
  template: "בחירת תבנית",
  preview: "תצוגה מקדימה ושליחה",
}

const STEPS: WizardStep[] = ["summary", "template", "preview"]

export function QuoteWizardDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  customerEmail,
  amountPaid,
  onSuccess,
}: QuoteWizardDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<WizardStep>("summary")
  const [details, setDetails] = useState<BalanceDetails | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)

  // Payment link
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [creatingLink, setCreatingLink] = useState(false)

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)

  // Preview
  const [previewSubject, setPreviewSubject] = useState("")
  const [previewBody, setPreviewBody] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Sending
  const [sending, setSending] = useState(false)

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("summary")
      setDetails(null)
      setPaymentUrl(null)
      setSelectedTemplate(null)
      setPreviewSubject("")
      setPreviewBody("")
      fetchBalance()
    }
  }, [open])

  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/balance`)
      if (res.ok) setDetails(await res.json())
    } catch {
      toast({ title: "שגיאה בטעינת מצב עדכונים", variant: "destructive" })
    } finally {
      setLoadingBalance(false)
    }
  }, [customerId, toast])

  const handleCreatePaymentLink = async () => {
    setCreatingLink(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/payment-link`, { method: "POST" })
      if (!res.ok) throw new Error("failed")
      const data = await res.json()
      setPaymentUrl(data.url)
      toast({ title: "לינק תשלום נוצר בהצלחה" })
    } catch {
      toast({ title: "שגיאה ביצירת לינק תשלום", variant: "destructive" })
    } finally {
      setCreatingLink(false)
    }
  }

  const fetchTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const res = await fetch("/api/emails/templates")
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.filter((t: EmailTemplate) => t.isActive))
      }
    } catch {
      toast({ title: "שגיאה בטעינת תבניות", variant: "destructive" })
    } finally {
      setLoadingTemplates(false)
    }
  }

  const fetchPreview = async (template: EmailTemplate) => {
    setLoadingPreview(true)
    try {
      const res = await fetch("/api/emails/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          customerId,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        // Inject payment link into preview
        let body = data.body as string
        let subject = data.subject as string
        const linkPlaceholder = paymentUrl || "https://pay.example.com/link/demo"
        body = body.replace(/\{\{paymentLink\}\}/g, linkPlaceholder)
        subject = subject.replace(/\{\{paymentLink\}\}/g, linkPlaceholder)
        // Also replace remaining amount vars
        if (details) {
          const amount = `₪${details.totalOwed.toLocaleString("he-IL")}`
          body = body.replace(/\{\{remainingAmount\}\}/g, String(details.totalOwed))
          body = body.replace(/\{\{remainingForFullSet\}\}/g, amount)
          subject = subject.replace(/\{\{remainingAmount\}\}/g, String(details.totalOwed))
          subject = subject.replace(/\{\{remainingForFullSet\}\}/g, amount)
        }
        setPreviewSubject(subject)
        setPreviewBody(body)
      }
    } catch {
      toast({ title: "שגיאה בטעינת תצוגה מקדימה", variant: "destructive" })
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleSend = async () => {
    if (!selectedTemplate) return
    setSending(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/send-price-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          paymentUrl: paymentUrl || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "שגיאה בשליחה")
      }
      const data = await res.json()
      if (!paymentUrl && data.paymentUrl) {
        setPaymentUrl(data.paymentUrl)
      }
      toast({ title: "הצעת המחיר נשלחה בהצלחה!", variant: "success" as "default" })
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "שגיאה בשליחת הצעת מחיר",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const goToStep = (nextStep: WizardStep) => {
    if (nextStep === "template" && templates.length === 0) {
      fetchTemplates()
    }
    if (nextStep === "preview" && selectedTemplate) {
      fetchPreview(selectedTemplate)
    }
    setStep(nextStep)
  }

  const currentStepIndex = STEPS.indexOf(step)

  const copyLink = () => {
    if (!paymentUrl) return
    navigator.clipboard.writeText(paymentUrl)
    toast({ title: "הלינק הועתק" })
  }

  // Sort templates: price_quote category first
  const sortedTemplates = [...templates].sort((a, b) => {
    const aIsQuote = a.category === "price_quote" || a.name.includes("הצעת מחיר") ? 0 : 1
    const bIsQuote = b.category === "price_quote" || b.name.includes("הצעת מחיר") ? 0 : 1
    return aIsQuote - bIsQuote
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">אשף הצעת מחיר</DialogTitle>
          <DialogDescription>
            שליחת הצעת מחיר ל-{customerName} ({customerEmail})
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 py-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : i < currentStepIndex
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i < currentStepIndex ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span>{i + 1}</span>
                )}
                <span>{STEP_LABELS[s]}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronLeft className="h-4 w-4 text-muted-foreground mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[250px]">
          {/* Step 1: Summary */}
          {step === "summary" && (
            <div className="space-y-4">
              {loadingBalance ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : details ? (
                <>
                  {/* Balance summary */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>שולם: {formatCurrency(amountPaid)}</span>
                        <span>{details.totalOwed === 0 ? "100" : Math.round((amountPaid / (amountPaid + details.totalOwed)) * 100)}%</span>
                      </div>
                      <Progress
                        value={details.totalOwed === 0 ? 100 : Math.round((amountPaid / (amountPaid + details.totalOwed)) * 100)}
                        className={cn(
                          "h-2.5",
                          details.totalOwed === 0 ? "[&>div]:bg-green-500" : "[&>div]:bg-orange-500"
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-b">
                      <span className="text-sm font-medium">נותר לתשלום</span>
                      <span className={cn(
                        "text-xl font-bold",
                        details.totalOwed > 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {details.totalOwed > 0 ? formatCurrency(details.totalOwed) : "שולם במלואו"}
                      </span>
                    </div>

                    {/* Version info */}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">גרסה נוכחית</span>
                      <span className="font-medium">{details.currentVersion || "—"}</span>
                    </div>
                    {details.latestVersion && details.latestVersion !== details.currentVersion && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">גרסה אחרונה</span>
                        <span className="font-medium">{details.latestVersion}</span>
                      </div>
                    )}

                    {/* Missing updates */}
                    {details.missingUpdates.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">עדכונים חסרים:</span>
                        {details.missingUpdates.map((u) => (
                          <div key={u.version} className="flex items-center justify-between text-sm bg-orange-50 rounded px-3 py-1.5 border border-orange-100">
                            <span className="font-medium">{u.version}</span>
                            <span className="text-orange-700 font-semibold">{formatCurrency(u.price)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Half set */}
                    {details.type === "half_set" && details.setCompletionCost != null && details.setCompletionCost > 0 && (
                      <div className="text-sm bg-blue-50 rounded px-3 py-2 border border-blue-100">
                        <span className="text-muted-foreground">להשלמת סט שלם: </span>
                        <span className="font-bold text-blue-700">{formatCurrency(details.setCompletionCost)}</span>
                      </div>
                    )}
                  </div>

                  {/* Payment link section */}
                  {details.totalOwed > 0 && (
                    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                      <span className="text-sm font-medium">לינק תשלום</span>
                      {!paymentUrl ? (
                        <Button
                          className="w-full gap-2"
                          variant="outline"
                          onClick={handleCreatePaymentLink}
                          disabled={creatingLink}
                        >
                          {creatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          צור לינק תשלום — {formatCurrency(details.totalOwed)}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={copyLink}>
                              <Copy className="h-3 w-3" /> העתק לינק
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1 text-xs" asChild>
                              <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" /> פתח
                              </a>
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-center truncate" dir="ltr">
                            {paymentUrl}
                          </p>
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        * הלינק ייכלל אוטומטית במייל הצעת המחיר. אם לא תיצור לינק כאן, הוא ייווצר בשלב השליחה.
                      </p>
                    </div>
                  )}

                  {details.totalOwed <= 0 && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200 text-green-700 text-sm">
                      <Check className="h-4 w-4" />
                      <span>הלקוח שילם את כל היתרה — אין צורך בהצעת מחיר</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  לא ניתן לטעון את פרטי היתרה
                </div>
              )}
            </div>
          )}

          {/* Step 2: Template selection */}
          {step === "template" && (
            <div className="space-y-3">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sortedTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>אין תבניות מייל זמינות</p>
                  <p className="text-sm mt-1">צור תבנית חדשה בעמוד המיילים</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">בחר תבנית מייל להצעת מחיר:</p>
                  <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-1">
                    {sortedTemplates.map((t) => {
                      const isQuoteTemplate = t.category === "price_quote" || t.name.includes("הצעת מחיר")
                      return (
                        <Card
                          key={t.id}
                          onClick={() => setSelectedTemplate(t)}
                          className={cn(
                            "border-2 cursor-pointer transition-all hover:shadow-md",
                            selectedTemplate?.id === t.id
                              ? "border-blue-500 bg-blue-50 shadow-sm"
                              : "border-gray-200 hover:border-blue-300"
                          )}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate flex-1">{t.name}</span>
                              {isQuoteTemplate && (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                                  הצעת מחיר
                                </Badge>
                              )}
                              {selectedTemplate?.id === t.id && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1" dir="rtl">
                              {t.subject}
                            </p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Preview & Send */}
          {step === "preview" && (
            <div className="space-y-3">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {!paymentUrl && (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-700 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>לא יצרת לינק תשלום — הוא ייווצר אוטומטית בשליחה</span>
                    </div>
                  )}
                  <div className="border rounded-lg overflow-hidden">
                    {/* Email header */}
                    <div className="bg-muted/50 p-3 border-b space-y-1.5 text-sm">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground font-medium">אל:</span>
                        <span dir="ltr">{customerEmail}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground font-medium">נושא:</span>
                        <span>{previewSubject || "(ללא נושא)"}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground font-medium">תבנית:</span>
                        <span>{selectedTemplate?.name}</span>
                      </div>
                    </div>

                    {/* Email body */}
                    <div
                      className="p-4 min-h-[200px] max-h-[300px] overflow-y-auto text-sm"
                      dir="rtl"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(previewBody || '<p class="text-muted-foreground">(ללא תוכן)</p>'),
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <DialogFooter className="flex !justify-between gap-2 pt-2">
          <div className="flex gap-2">
            {currentStepIndex > 0 && (
              <Button
                variant="outline"
                onClick={() => goToStep(STEPS[currentStepIndex - 1])}
                disabled={sending}
              >
                <ChevronRight className="h-4 w-4 ml-1" />
                הקודם
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === "summary" && details && details.totalOwed > 0 && (
              <Button onClick={() => goToStep("template")}>
                בחירת תבנית
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            )}
            {step === "template" && (
              <Button
                onClick={() => goToStep("preview")}
                disabled={!selectedTemplate}
              >
                <Eye className="h-4 w-4 ml-1" />
                תצוגה מקדימה
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            )}
            {step === "preview" && (
              <Button
                onClick={handleSend}
                disabled={sending || loadingPreview}
                className="bg-green-600 hover:bg-green-700"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-1" />
                )}
                שלח הצעת מחיר
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
