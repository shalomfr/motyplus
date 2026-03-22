"use client"

import { useState, useEffect, useCallback, useMemo, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowRight, FileText, FolderOpen, Music, Mail, CheckCircle2 } from "lucide-react"
import { WizardShell } from "@/components/updates/wizard/wizard-shell"
import { StepDetails, type UpdateDetailsData } from "@/components/updates/wizard/step-details"
import { StepRhythms } from "@/components/updates/wizard/step-rhythms"
import { StepSamples } from "@/components/updates/wizard/step-samples"
import { StepEmailPreview } from "@/components/updates/wizard/step-email-preview"
import { StepSummary } from "@/components/updates/wizard/step-summary"

const ALL_WIZARD_STEPS = [
  { key: "details", label: "פרטי עדכון", icon: <FileText className="h-4 w-4" /> },
  { key: "rhythms", label: "מקצבים", icon: <FolderOpen className="h-4 w-4" /> },
  { key: "samples", label: "דגימות", icon: <Music className="h-4 w-4" /> },
  { key: "emails", label: "מיילים", icon: <Mail className="h-4 w-4" /> },
  { key: "summary", label: "סיכום", icon: <CheckCircle2 className="h-4 w-4" /> },
]

interface WizardData {
  updateVersion: {
    id: string
    version: string
    status: string
    price: number
    description: string | null
    updateType: "FULL" | "PARTIAL"
  }
  segments: Array<{
    key: string
    label: string
    count: number
    templateName: string | null
    previewSubject: string
    previewBody: string
    sampleCustomers: Array<{ id: number; fullName: string; email: string; organ: string; setType: string }>
    canSend: boolean
    color: string
  }>
  cpiStatus: { ready: number; total: number }
  alreadySent: number
}

export default function UpdateWizardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(new Set<number>([0]))
  const [loading, setLoading] = useState(true)
  const [wizardData, setWizardData] = useState<WizardData | null>(null)
  const [updateDetails, setUpdateDetails] = useState<UpdateDetailsData>({
    version: "",
    price: 0,
    description: "",
    releaseDate: "",
    updateType: "FULL",
  })
  const [foldersReady, setFoldersReady] = useState(false)

  const isPartial = wizardData?.updateVersion.updateType === "PARTIAL"
  const wizardSteps = useMemo(
    () => isPartial ? ALL_WIZARD_STEPS.filter((s) => s.key !== "samples") : ALL_WIZARD_STEPS,
    [isPartial]
  )
  const activeStepKey = wizardSteps[currentStep]?.key

  const fetchFolderStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/updates/${id}/folders`)
      if (!res.ok) return
      const data = await res.json()
      const folders: Array<{ packageTypes: Array<{ hasFiles: boolean }> }> = data.folders || []
      const allReady = folders.length > 0 && folders.every((f) =>
        f.packageTypes.every((p) => p.hasFiles)
      )
      setFoldersReady(allReady)
    } catch {
      setFoldersReady(false)
    }
  }, [id])

  const fetchWizardData = useCallback(async () => {
    try {
      const res = await fetch(`/api/updates/${id}/wizard`)
      if (!res.ok) throw new Error("Failed to load wizard data")
      const data: WizardData = await res.json()
      setWizardData(data)
      setUpdateDetails({
        version: data.updateVersion.version,
        price: Number(data.updateVersion.price),
        description: data.updateVersion.description || "",
        releaseDate: "",
        updateType: data.updateVersion.updateType || "FULL",
      })
    } catch (err) {
      console.error("Error loading wizard:", err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchWizardData()
    fetchFolderStatus()
  }, [fetchWizardData, fetchFolderStatus])

  const handleStepChange = (step: number) => {
    const stepKey = wizardSteps[step]?.key
    if (stepKey === "emails" || stepKey === "summary") {
      fetchWizardData()
      fetchFolderStatus()
    }
    setCurrentStep(step)
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      for (let i = 0; i <= step; i++) next.add(i)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!wizardData) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">לא ניתן לטעון את נתוני האשף.</p>
        <Button variant="outline" onClick={() => router.push("/updates")}>
          <ArrowRight className="h-4 w-4 ml-2" />
          חזרה לעדכונים
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">
          אשף עדכון {wizardData.updateVersion.version}
        </h2>
        <Button variant="ghost" onClick={() => router.push(`/updates/${id}`)}>
          <ArrowRight className="h-4 w-4 ml-1" />
          חזרה לפרטי העדכון
        </Button>
      </div>

      <WizardShell
        steps={wizardSteps}
        currentStep={currentStep}
        onStepChange={handleStepChange}
        canGoNext={true}
        completedSteps={completedSteps}
      >
        {activeStepKey === "details" && (
          <StepDetails
            data={updateDetails}
            onChange={setUpdateDetails}
            onSubmit={async () => {}}
            isExisting={true}
            loading={false}
            error=""
          />
        )}

        {activeStepKey === "rhythms" && (
          <StepRhythms
            updateId={id}
            version={wizardData.updateVersion.version}
          />
        )}

        {activeStepKey === "samples" && (
          <StepSamples
            updateId={id}
            cpiReady={wizardData.cpiStatus.ready}
            cpiTotal={wizardData.cpiStatus.total}
          />
        )}

        {activeStepKey === "emails" && (
          <StepEmailPreview segments={wizardData.segments} />
        )}

        {activeStepKey === "summary" && (
          <StepSummary
            updateId={id}
            version={wizardData.updateVersion.version}
            segments={wizardData.segments}
            cpiStatus={wizardData.cpiStatus}
            alreadySent={wizardData.alreadySent}
            foldersReady={foldersReady}
          />
        )}
      </WizardShell>
    </div>
  )
}
