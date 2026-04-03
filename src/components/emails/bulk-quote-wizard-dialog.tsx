"use client"

import { useState, useEffect, useMemo } from "react"
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
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import DOMPurify from "dompurify"
import {
  Loader2,
  Send,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertTriangle,
  Users,
  Mail,
  FolderOpen,
  ChevronDown,
  ChevronUp,
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
  order: number
}

interface OrganInfo {
  id: string
  name: string
}

interface BulkQuoteWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialType?: "not_updated" | "half_set"
}

type WizardStep = "summary" | "templates" | "preview"

const STEP_LABELS: Record<WizardStep, string> = {
  summary: "סיכום לקוחות",
  templates: "בחירת תבניות",
  preview: "תצוגה מקדימה ושליחה",
}

const STEPS: WizardStep[] = ["summary", "templates", "preview"]

export function BulkQuoteWizardDialog({
  open,
  onOpenChange,
  initialType,
}: BulkQuoteWizardDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<WizardStep>("summary")

  // Stats
  const [stats, setStats] = useState<{
    notUpdatedCount: number
    halfSetCount: number
    latestVersion: string | null
  } | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Send types selection
  const [sendNotUpdated, setSendNotUpdated] = useState(true)
  const [sendHalfSet, setSendHalfSet] = useState(true)

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [organs, setOrgans] = useState<OrganInfo[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [notUpdatedTemplateMap, setNotUpdatedTemplateMap] = useState<Record<string, EmailTemplate>>({})
  const [halfSetTemplate, setHalfSetTemplate] = useState<EmailTemplate | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Preview
  const [previewType, setPreviewType] = useState<"not_updated" | "half_set">("not_updated")

  // Sending
  const [sending, setSending] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("summary")
      setStats(null)
      setNotUpdatedTemplateMap({})
      setHalfSetTemplate(null)
      setExpandedSections(new Set())
      setExpandedFolders(new Set())
      // If opened from specific button, pre-select that type
      if (initialType === "not_updated") {
        setSendNotUpdated(true)
        setSendHalfSet(false)
      } else if (initialType === "half_set") {
        setSendNotUpdated(false)
        setSendHalfSet(true)
      } else {
        setSendNotUpdated(true)
        setSendHalfSet(true)
      }
      fetchStats()
    }
  }, [open, initialType])

  const fetchStats = async () => {
    setLoadingStats(true)
    try {
      const res = await fetch("/api/emails/send-bulk")
      if (res.ok) setStats(await res.json())
    } catch {
      toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" })
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const [templatesRes, foldersRes, organsRes] = await Promise.all([
        fetch("/api/emails/templates"),
        fetch("/api/emails/folders"),
        fetch("/api/public/organs"),
      ])
      if (templatesRes.ok) {
        const data = await templatesRes.json()
        const list = data.templates || data
        setTemplates(list.filter((t: EmailTemplate) => t.isActive))
      }
      if (foldersRes.ok) {
        const data = await foldersRes.json()
        setFolders(
          (data as EmailFolder[]).sort((a, b) => a.order - b.order)
        )
      }
      if (organsRes.ok) {
        const data = await organsRes.json()
        setOrgans(
          data
            .filter((o: { supportsUpdates: boolean }) => o.supportsUpdates)
            .map((o: { id: string; name: string }) => ({ id: o.id, name: o.name }))
        )
      }
    } catch {
      toast({ title: "שגיאה בטעינת תבניות", variant: "destructive" })
    } finally {
      setLoadingTemplates(false)
    }
  }

  // Auto-select templates when data loads
  useEffect(() => {
    if (loadingTemplates || templates.length === 0 || folders.length === 0 || organs.length === 0) return
    // Skip if already selected
    if (Object.keys(notUpdatedTemplateMap).length > 0 || halfSetTemplate) return

    const notUpdatedFolderIds = new Set<string>()
    const halfSetFolderIds = new Set<string>()
    for (const f of folders) {
      const name = f.name.trim()
      if (name === "לא זכאים לעדכון" || name === "לא מעודכנים") notUpdatedFolderIds.add(f.id)
      if (name === "חצי סט") halfSetFolderIds.add(f.id)
    }

    // Auto-select not_updated per organ from "לא מעודכנים" folder
    const notUpdatedTemplates = templates.filter((t) => t.folderId && notUpdatedFolderIds.has(t.folderId))
    const autoMap: Record<string, EmailTemplate> = {}
    for (const organ of organs) {
      const ORGAN_MATCH: Record<string, string[]> = {
        "Genos": ["Genos"], "Genos 2": ["Genos"], "Psr-SX920": ["Genos", "Psr-SX", "SX920"],
        "Tyros5-1G": ["Tyros5-1G"], "Tyros5-2G": ["Tyros5-2G"],
      }
      const keywords = ORGAN_MATCH[organ.name] || [organ.name]
      const match = notUpdatedTemplates.find((t) => keywords.some((kw) => t.name.includes(kw)))
      if (match) autoMap[organ.id] = match
    }
    if (Object.keys(autoMap).length > 0) setNotUpdatedTemplateMap(autoMap)

    // Auto-select half_set per organ from "חצי סט" folder
    const halfSetTemplates = templates.filter((t) => t.folderId && halfSetFolderIds.has(t.folderId))
    const halfMatch = halfSetTemplates.find((t) => t.name.includes("גינוס") || t.name.includes("Genos")) || halfSetTemplates[0]
    if (halfMatch) setHalfSetTemplate(halfMatch)
  }, [loadingTemplates, templates, folders, organs, notUpdatedTemplateMap, halfSetTemplate])

  const groupedTemplates = useMemo(() => {
    const groups: { folderId: string | null; folderName: string; templates: EmailTemplate[] }[] = []
    const folderMap = new Map<string, EmailTemplate[]>()
    const unfiled: EmailTemplate[] = []

    for (const t of templates) {
      if (t.folderId) {
        const arr = folderMap.get(t.folderId) || []
        arr.push(t)
        folderMap.set(t.folderId, arr)
      } else {
        unfiled.push(t)
      }
    }

    for (const folder of folders) {
      const ft = folderMap.get(folder.id)
      if (ft && ft.length > 0) {
        groups.push({ folderId: folder.id, folderName: folder.name, templates: ft })
      }
    }

    if (unfiled.length > 0) {
      groups.push({ folderId: null, folderName: "כללי", templates: unfiled })
    }

    return groups
  }, [templates, folders])

  // Filter templates by folder name per segment
  const segmentFolderMap = useMemo(() => {
    const map: Record<string, Set<string>> = {
      not_updated: new Set<string>(),
      half_set: new Set<string>(),
    }
    for (const f of folders) {
      const name = f.name.trim()
      if (name === "לא זכאים לעדכון" || name === "לא מעודכנים") {
        map.not_updated.add(f.id)
      }
      if (name === "חצי סט") {
        map.half_set.add(f.id)
      }
    }
    return map
  }, [folders])

  const filterGroupsBySegment = (groups: typeof groupedTemplates, segmentKey: string) => {
    const allowedIds = segmentFolderMap[segmentKey]
    if (!allowedIds || allowedIds.size === 0) return groups
    return groups.filter((g) => g.folderId != null && allowedIds.has(g.folderId))
  }

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const sendType = sendNotUpdated && sendHalfSet ? "both"
        : sendNotUpdated ? "not_updated"
        : "half_set"

      // Build per-organ template map: { organId: templateId }
      const organTemplateMap: Record<string, string> = {}
      for (const [organId, tpl] of Object.entries(notUpdatedTemplateMap)) {
        organTemplateMap[organId] = tpl.id
      }

      const res = await fetch("/api/emails/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: sendType,
          notUpdatedTemplateMap: organTemplateMap,
          halfSetTemplateId: halfSetTemplate?.id,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: data.message, variant: "success" as "default" })
        onOpenChange(false)
      } else {
        toast({ title: "שגיאה", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "שגיאה בשליחה", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const goToStep = (nextStep: WizardStep) => {
    if (nextStep === "templates" && templates.length === 0) {
      fetchTemplates()
    }
    if (nextStep === "preview") {
      // Set initial preview to first active type
      setPreviewType(sendNotUpdated ? "not_updated" : "half_set")
    }
    setStep(nextStep)
  }

  const currentStepIndex = STEPS.indexOf(step)

  const canProceedFromSummary = (sendNotUpdated && stats && stats.notUpdatedCount > 0) ||
    (sendHalfSet && stats && stats.halfSetCount > 0)

  const allOrgansHaveTemplate = organs.length > 0 && organs.every((o) => notUpdatedTemplateMap[o.id])

  const canProceedFromTemplates =
    (!sendNotUpdated || allOrgansHaveTemplate) &&
    (!sendHalfSet || halfSetTemplate)

  const firstNotUpdatedTemplate = Object.values(notUpdatedTemplateMap)[0] || null
  const activePreviewTemplate = previewType === "not_updated" ? firstNotUpdatedTemplate : halfSetTemplate

  // Sample variables for preview
  const sampleVars: Record<string, string> = {
    fullName: "ישראל ישראלי",
    firstName: "ישראל",
    organ: "Genos 2",
    setType: previewType === "not_updated" ? "סט שלם" : "חצי סט",
    currentVersion: "V3.0",
    updateVersion: "V3.0",
    remainingAmount: "1500",
    remainingForFullSet: "₪1,500",
    paymentLink: "https://pay.example.com/demo",
  }

  const getPreviewHtml = () => {
    if (!activePreviewTemplate) return ""
    let html = activePreviewTemplate.body
    for (const [key, val] of Object.entries(sampleVars)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val)
    }
    return html
  }

  const getPreviewSubject = () => {
    if (!activePreviewTemplate) return ""
    let subject = activePreviewTemplate.subject
    for (const [key, val] of Object.entries(sampleVars)) {
      subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val)
    }
    return subject
  }

  const renderFolderedTemplates = (
    selectedId: string | undefined,
    onSelect: (t: EmailTemplate) => void,
    filteredGroups?: typeof groupedTemplates,
  ) => (
    <div className="space-y-2">
      {(filteredGroups ?? groupedTemplates).map((group) => {
        const folderKey = group.folderId || "_unfiled"
        const isOpen = expandedFolders.has(folderKey)
        const hasSelected = group.templates.some((t) => t.id === selectedId)

        return (
          <div key={folderKey} className="border rounded-md bg-white/60">
            <button
              type="button"
              onClick={() => toggleFolder(folderKey)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors text-sm"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium text-gray-700">{group.folderName}</span>
                <Badge variant="secondary" className="text-[10px]">{group.templates.length}</Badge>
                {hasSelected && <Check className="h-3.5 w-3.5 text-green-600" />}
              </div>
              {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
            </button>
            {isOpen && (
              <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.templates.map((t) => (
                  <Card
                    key={t.id}
                    onClick={() => onSelect(t)}
                    className={cn(
                      "border-2 cursor-pointer transition-all hover:shadow-md",
                      selectedId === t.id
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-gray-200 hover:border-blue-300"
                    )}
                  >
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate flex-1">{t.name}</span>
                        {selectedId === t.id && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1" dir="rtl">
                        {t.subject}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">אשף שליחת הצעות מחיר</DialogTitle>
          <DialogDescription>
            שליחה קבוצתית של הצעות מחיר ללקוחות לפי מצבם
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
        <div className="min-h-[300px]">
          {/* Step 1: Summary */}
          {step === "summary" && (
            <div className="space-y-4">
              {loadingStats ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stats ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    בחר לאילו קבוצות לקוחות לשלוח הצעת מחיר:
                  </p>

                  {/* Not updated card */}
                  <Card
                    className={cn(
                      "border-2 cursor-pointer transition-all",
                      sendNotUpdated
                        ? "border-red-400 bg-red-50/50"
                        : "border-gray-200 opacity-60"
                    )}
                    onClick={() => setSendNotUpdated(!sendNotUpdated)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", sendNotUpdated ? "bg-red-100" : "bg-gray-100")}>
                          <AlertTriangle className={cn("h-5 w-5", sendNotUpdated ? "text-red-600" : "text-gray-400")} />
                        </div>
                        <div>
                          <p className="font-medium">לקוחות לא זכאים לעדכון</p>
                          <p className="text-xs text-muted-foreground">
                            סט שלם, לא בגרסה האחרונה
                            {stats.latestVersion && ` (${stats.latestVersion})`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-lg px-3">
                          {stats.notUpdatedCount}
                        </Badge>
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center",
                          sendNotUpdated ? "bg-red-500 border-red-500" : "border-gray-300"
                        )}>
                          {sendNotUpdated && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Half set card */}
                  <Card
                    className={cn(
                      "border-2 cursor-pointer transition-all",
                      sendHalfSet
                        ? "border-amber-400 bg-amber-50/50"
                        : "border-gray-200 opacity-60"
                    )}
                    onClick={() => setSendHalfSet(!sendHalfSet)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", sendHalfSet ? "bg-amber-100" : "bg-gray-100")}>
                          <Users className={cn("h-5 w-5", sendHalfSet ? "text-amber-600" : "text-gray-400")} />
                        </div>
                        <div>
                          <p className="font-medium">לקוחות חצי סט</p>
                          <p className="text-xs text-muted-foreground">הצעה לשדרוג לסט שלם</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-lg px-3">
                          {stats.halfSetCount}
                        </Badge>
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center",
                          sendHalfSet ? "bg-amber-500 border-amber-500" : "border-gray-300"
                        )}>
                          {sendHalfSet && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {!sendNotUpdated && !sendHalfSet && (
                    <p className="text-sm text-center text-muted-foreground">
                      יש לבחור לפחות קבוצה אחת
                    </p>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  לא ניתן לטעון נתונים
                </div>
              )}
            </div>
          )}

          {/* Step 2: Template selection */}
          {step === "templates" && (
            <div className="space-y-5">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>אין תבניות מייל זמינות</p>
                </div>
              ) : (
                <>
                  {/* Not updated template selection — per organ */}
                  {sendNotUpdated && (
                    <div className={cn("border rounded-lg overflow-hidden", "border-red-200 bg-red-50/30")}>
                      <button
                        type="button"
                        onClick={() => toggleSection("not_updated")}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="font-semibold text-gray-800">לא זכאים לעדכון</span>
                          <Badge variant="secondary">{stats?.notUpdatedCount || 0}</Badge>
                          {allOrgansHaveTemplate && (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                              <Check className="h-3 w-3 ml-1" />
                              כל {organs.length} האורגנים מוגדרים
                            </Badge>
                          )}
                          {!allOrgansHaveTemplate && Object.keys(notUpdatedTemplateMap).length > 0 && (
                            <span className="text-xs text-gray-500">
                              {Object.keys(notUpdatedTemplateMap).length}/{organs.length} אורגנים מוגדרים
                            </span>
                          )}
                        </div>
                        {expandedSections.has("not_updated") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {expandedSections.has("not_updated") && (
                        <div className="px-4 pb-4 space-y-4">
                          {organs.map((organ) => {
                            const selected = notUpdatedTemplateMap[organ.id]
                            return (
                              <div key={organ.id} className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                  <Users className="h-4 w-4" />
                                  <span>{organ.name}</span>
                                  {selected && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <Check className="h-3 w-3" />
                                      {selected.name}
                                    </span>
                                  )}
                                </div>
                                <div className="mr-6">
                                  {renderFolderedTemplates(
                                    selected?.id,
                                    (t) => setNotUpdatedTemplateMap((prev) => ({ ...prev, [organ.id]: t })),
                                    filterGroupsBySegment(groupedTemplates, "not_updated"),
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Half set template selection */}
                  {sendHalfSet && (
                    <div className={cn("border rounded-lg overflow-hidden", "border-amber-200 bg-amber-50/30")}>
                      <button
                        type="button"
                        onClick={() => toggleSection("half_set")}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Users className="h-4 w-4 text-amber-600" />
                          <span className="font-semibold text-gray-800">חצי סט</span>
                          <Badge variant="secondary">{stats?.halfSetCount || 0}</Badge>
                          {halfSetTemplate && (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                              <Check className="h-3 w-3 ml-1" />
                              {halfSetTemplate.name}
                            </Badge>
                          )}
                        </div>
                        {expandedSections.has("half_set") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {expandedSections.has("half_set") && (
                        <div className="px-4 pb-4">
                          {renderFolderedTemplates(
                            halfSetTemplate?.id,
                            (t) => setHalfSetTemplate(t),
                            filterGroupsBySegment(groupedTemplates, "half_set"),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3: Preview & Send */}
          {step === "preview" && (
            <div className="space-y-3">
              {/* Type tabs */}
              {sendNotUpdated && sendHalfSet && (
                <div className="flex gap-2">
                  <Button
                    variant={previewType === "not_updated" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewType("not_updated")}
                    className="gap-1"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    לא זכאים לעדכון ({stats?.notUpdatedCount})
                  </Button>
                  <Button
                    variant={previewType === "half_set" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewType("half_set")}
                    className="gap-1"
                  >
                    <Users className="h-3.5 w-3.5" />
                    חצי סט ({stats?.halfSetCount})
                  </Button>
                </div>
              )}

              {activePreviewTemplate ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 p-3 border-b space-y-1.5 text-sm">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground font-medium">תבנית:</span>
                      <span>{activePreviewTemplate.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground font-medium">נושא:</span>
                      <span>{getPreviewSubject() || "(ללא נושא)"}</span>
                    </div>
                  </div>
                  <div
                    className="p-4 min-h-[200px] max-h-[300px] overflow-y-auto text-sm"
                    dir="rtl"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(getPreviewHtml()),
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  לא נבחרה תבנית לקבוצה זו
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                * התצוגה מציגה נתוני דוגמה. בשליחה בפועל, המשתנים יוחלפו בנתוני הלקוח האמיתיים ויווצר לינק תשלום לכל לקוח.
              </p>

              {/* Summary before send */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <p className="font-medium">סיכום שליחה:</p>
                {sendNotUpdated && (
                  <div>
                    <p>
                      <AlertTriangle className="h-3.5 w-3.5 inline ml-1 text-red-600" />
                      לא זכאים לעדכון: {stats?.notUpdatedCount || 0} לקוחות
                    </p>
                    {organs.map((organ) => {
                      const tpl = notUpdatedTemplateMap[organ.id]
                      return tpl ? (
                        <p key={organ.id} className="text-xs text-muted-foreground mr-5">
                          {organ.name}: {tpl.name}
                        </p>
                      ) : null
                    })}
                  </div>
                )}
                {sendHalfSet && (
                  <p>
                    <Users className="h-3.5 w-3.5 inline ml-1 text-amber-600" />
                    חצי סט: {stats?.halfSetCount || 0} לקוחות — תבנית: {halfSetTemplate?.name || "ברירת מחדל"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
            {step === "summary" && (
              <Button
                onClick={() => goToStep("templates")}
                disabled={!canProceedFromSummary}
              >
                בחירת תבניות
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            )}
            {step === "templates" && (
              <Button
                onClick={() => goToStep("preview")}
                disabled={!canProceedFromTemplates}
              >
                <Eye className="h-4 w-4 ml-1" />
                תצוגה מקדימה
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            )}
            {step === "preview" && (
              <Button
                onClick={handleSend}
                disabled={sending}
                className="bg-green-600 hover:bg-green-700"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-1" />
                )}
                שלח הצעות מחיר
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
