"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowRight, FileText, FolderOpen, Music, Mail, Send } from "lucide-react"
import { WizardShell } from "@/components/updates/wizard/wizard-shell"
import { StepDetails, type UpdateDetailsData } from "@/components/updates/wizard/step-details"

const WIZARD_STEPS = [
  { key: "details", label: "פרטי עדכון", icon: <FileText className="h-4 w-4" /> },
  { key: "rhythms", label: "מקצבים", icon: <FolderOpen className="h-4 w-4" /> },
  { key: "samples", label: "דגימות", icon: <Music className="h-4 w-4" /> },
  { key: "emails", label: "מיילים", icon: <Mail className="h-4 w-4" /> },
  { key: "send", label: "שליחה", icon: <Send className="h-4 w-4" /> },
]

export default function NewUpdateWizardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [updateDetails, setUpdateDetails] = useState<UpdateDetailsData>({
    version: "",
    price: 0,
    description: "",
    releaseDate: "",
    updateType: "FULL",
  })

  const handleCreateUpdate = async () => {
    setLoading(true)
    setError("")

    try {
      const templateRes = await fetch("/api/emails/templates")
      let emailSubject = ""
      let emailBody = ""

      if (templateRes.ok) {
        const templates = await templateRes.json()
        const arr = templates.templates || templates
        const tpl = arr.find((t: { name: string }) => t.name === "שליחת עדכון")
        if (tpl) {
          emailSubject = tpl.subject
          emailBody = tpl.body
        }
      }

      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: updateDetails.version,
          price: updateDetails.price,
          updateType: updateDetails.updateType,
          description: updateDetails.description,
          releaseDate: updateDetails.releaseDate || null,
          emailSubject,
          emailBody,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "שגיאה ביצירת העדכון")
      }

      const data = await res.json()
      router.push(`/updates/${data.id}/wizard`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת העדכון")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">
          אשף עדכון חדש
        </h2>
        <Button variant="ghost" onClick={() => router.push("/updates")}>
          <ArrowRight className="h-4 w-4 ml-1" />
          חזרה לעדכונים
        </Button>
      </div>

      <WizardShell
        steps={WIZARD_STEPS}
        currentStep={0}
        onStepChange={() => {}}
        canGoNext={false}
        completedSteps={new Set()}
      >
        <StepDetails
          data={updateDetails}
          onChange={setUpdateDetails}
          onSubmit={handleCreateUpdate}
          isExisting={false}
          loading={loading}
          error={error}
        />
      </WizardShell>
    </div>
  )
}
