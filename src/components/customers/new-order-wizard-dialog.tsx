"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import DOMPurify from "dompurify"
import {
  Loader2,
  Eye,
  Send,
  Check,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from "lucide-react"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: string | null
  folderId: string | null
  isActive: boolean
}

interface EmailFolder {
  id: string
  name: string
  key: string
}

interface NewOrderWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type WizardStep = "details" | "preview"

const STEP_LABELS: Record<WizardStep, string> = {
  details: "פרטי לקוח",
  preview: "תצוגה מקדימה ושליחה",
}

const STEPS: WizardStep[] = ["details", "preview"]

export function NewOrderWizardDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewOrderWizardDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<WizardStep>("details")

  // Details
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  // Template (auto-selected)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  // Preview
  const [previewSubject, setPreviewSubject] = useState("")
  const [previewBody, setPreviewBody] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Sending
  const [sending, setSending] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("details")
      setName("")
      setEmail("")
      setSelectedTemplate(null)
      setPreviewSubject("")
      setPreviewBody("")
    }
  }, [open])

  const fetchTemplateAndPreview = async () => {
    setLoadingTemplate(true)
    setLoadingPreview(true)
    try {
      const [templatesRes, foldersRes] = await Promise.all([
        fetch("/api/emails/templates"),
        fetch("/api/emails/folders"),
      ])
      if (!templatesRes.ok || !foldersRes.ok) {
        toast({ title: "שגיאה בטעינת תבניות", variant: "destructive" })
        return
      }

      const allTemplates: EmailTemplate[] = await templatesRes.json()
      const allFolders: EmailFolder[] = await foldersRes.json()

      // Find "שליחות פרטיות" folder (key: "welcome")
      const privateFolder = allFolders.find((f) => f.key === "welcome")
      let template: EmailTemplate | null = null

      if (privateFolder) {
        // Find "טופס הזמנת לקוח" template in that folder
        const folderTemplates = allTemplates.filter(
          (t) => t.isActive && t.folderId === privateFolder.id
        )
        template = folderTemplates.find((t) => t.name.includes("טופס הזמנת לקוח")) || folderTemplates[0] || null
      }

      if (!template) {
        // Fallback: find by name in all templates
        template = allTemplates.find((t) => t.isActive && t.name.includes("טופס הזמנת לקוח")) || null
      }

      if (!template) {
        toast({ title: "לא נמצאה תבנית \"טופס הזמנת לקוח\" בתיקיית שליחות פרטיות", variant: "destructive" })
        return
      }

      setSelectedTemplate(template)

      // Generate preview
      const orderFormUrl = "https://motyplus-order.onrender.com"
      let body = template.body
      let subject = template.subject

      const vars: Record<string, string> = {
        fullName: name,
        firstName: name.split(" ")[0],
        email,
        orderFormUrl,
        paymentLink: orderFormUrl,
        newCustomerName: name,
      }

      for (const [key, val] of Object.entries(vars)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g")
        body = body.replace(regex, val)
        subject = subject.replace(regex, val)
        // Also handle data-var spans
        const spanRegex = new RegExp(
          `<span[^>]*data-var="${key}"[^>]*>[^<]*</span>`,
          "g"
        )
        body = body.replace(spanRegex, val)
      }

      setPreviewSubject(subject)
      setPreviewBody(body)
    } catch {
      toast({ title: "שגיאה בטעינת תבנית", variant: "destructive" })
    } finally {
      setLoadingTemplate(false)
      setLoadingPreview(false)
    }
  }

  const handleSend = async () => {
    if (!selectedTemplate) return
    setSending(true)
    try {
      const res = await fetch("/api/customers/invite-new-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          templateId: selectedTemplate.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "שגיאה בשליחה")
      }
      toast({ title: "ההזמנה נשלחה בהצלחה!", variant: "success" as "default" })
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "שגיאה בשליחת ההזמנה",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const goToStep = (nextStep: WizardStep) => {
    if (nextStep === "preview") {
      fetchTemplateAndPreview()
    }
    setStep(nextStep)
  }

  const canProceedFromDetails = name.trim().length > 0 && email.includes("@")
  const currentStepIndex = STEPS.indexOf(step)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">אשף הזמנת לקוח חדש</DialogTitle>
          <DialogDescription>
            שליחת הזמנה עם קישור לטופס תשלום
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
          {/* Step 1: Customer Details */}
          {step === "details" && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <UserPlus className="h-4 w-4" />
                <span>הכנס את פרטי הלקוח החדש</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newCustName">שם מלא</Label>
                <Input
                  id="newCustName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ישראל ישראלי"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newCustEmail">כתובת מייל</Label>
                <Input
                  id="newCustEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>
              <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
                במייל שיישלח ללקוח יהיה קישור לטופס התשלום הציבורי.
                התבנית &quot;טופס הזמנת לקוח&quot; תיבחר אוטומטית מתיקיית שליחות פרטיות.
              </div>
            </div>
          )}

          {/* Step 2: Preview & Send */}
          {step === "preview" && (
            <div className="space-y-3">
              {loadingPreview || loadingTemplate ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !selectedTemplate ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>לא נמצאה תבנית &quot;טופס הזמנת לקוח&quot;</p>
                  <p className="text-sm mt-1">צור תבנית בשם זה בתיקיית &quot;שליחות פרטיות&quot;</p>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    {/* Email header */}
                    <div className="bg-muted/50 p-3 border-b space-y-1.5 text-sm">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground font-medium">אל:</span>
                        <span dir="ltr">{email}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground font-medium">שם:</span>
                        <span>{name}</span>
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
                        __html: DOMPurify.sanitize(
                          previewBody || '<p class="text-muted-foreground">(ללא תוכן)</p>'
                        ),
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
            {step === "details" && (
              <Button
                onClick={() => goToStep("preview")}
                disabled={!canProceedFromDetails}
              >
                <Eye className="h-4 w-4 ml-1" />
                תצוגה מקדימה
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            )}
            {step === "preview" && (
              <Button
                onClick={handleSend}
                disabled={sending || loadingPreview || !selectedTemplate}
                className="bg-green-600 hover:bg-green-700"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-1" />
                )}
                שלח הזמנה
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
