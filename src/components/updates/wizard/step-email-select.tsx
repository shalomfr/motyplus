"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, Mail, ChevronDown, ChevronUp, Users } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: string | null
  isActive: boolean
}

interface OrganGroup {
  organId: string
  organName: string
  count: number
}

interface Segment {
  key: string
  label: string
  count: number
  canSend: boolean
  color: string
}

// Shape of the template map stored in DB
interface TemplateEntry {
  templateId: string
  templateName: string
  subject: string
  body: string
}

type EmailTemplateMap = {
  eligible?: Record<string, TemplateEntry>
  not_updated?: TemplateEntry
  half_set?: TemplateEntry
}

interface StepEmailSelectProps {
  updateId: string
  segments: Segment[]
  organGroups: OrganGroup[]
  emailTemplateMap: EmailTemplateMap | null
  onTemplateApplied: () => void
}

export function StepEmailSelect({
  updateId,
  segments,
  organGroups,
  emailTemplateMap,
  onTemplateApplied,
}: StepEmailSelectProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [templateMap, setTemplateMap] = useState<EmailTemplateMap>(emailTemplateMap || {})
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["eligible"]))

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/emails/templates")
        if (res.ok) {
          const data = await res.json()
          setTemplates(data.filter((t: EmailTemplate) => t.isActive))
        }
      } catch (err) {
        console.error("Failed to fetch templates:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  useEffect(() => {
    if (emailTemplateMap) setTemplateMap(emailTemplateMap)
  }, [emailTemplateMap])

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const saveMap = useCallback(
    async (newMap: EmailTemplateMap) => {
      setTemplateMap(newMap)
      try {
        const res = await fetch(`/api/updates/${updateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailTemplateMap: newMap }),
        })
        if (res.ok) onTemplateApplied()
      } catch (err) {
        console.error("Failed to save template map:", err)
      }
    },
    [updateId, onTemplateApplied]
  )

  const selectForOrgan = async (organId: string, template: EmailTemplate) => {
    setSaving(`eligible:${organId}`)
    const newMap: EmailTemplateMap = {
      ...templateMap,
      eligible: {
        ...(templateMap.eligible || {}),
        [organId]: {
          templateId: template.id,
          templateName: template.name,
          subject: template.subject,
          body: template.body,
        },
      },
    }
    // Also update legacy emailSubject/emailBody with first organ's template
    await fetch(`/api/updates/${updateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailSubject: template.subject,
        emailBody: template.body,
        emailTemplateMap: newMap,
      }),
    })
    setTemplateMap(newMap)
    onTemplateApplied()
    setSaving(null)
  }

  const selectForSegment = async (segmentKey: "not_updated" | "half_set", template: EmailTemplate) => {
    setSaving(segmentKey)
    const newMap: EmailTemplateMap = {
      ...templateMap,
      [segmentKey]: {
        templateId: template.id,
        templateName: template.name,
        subject: template.subject,
        body: template.body,
      },
    }
    await saveMap(newMap)
    setSaving(null)
  }

  const eligibleSegment = segments.find((s) => s.key === "eligible")
  const notUpdatedSegment = segments.find((s) => s.key === "not_updated")
  const halfSetSegment = segments.find((s) => s.key === "half_set")

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>אין תבניות מייל זמינות</p>
        <p className="text-sm mt-1">צור תבנית חדשה בעמוד המיילים</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">בחירת תבניות מייל</h3>
        <p className="text-sm text-muted-foreground mt-1">
          בחר תבנית מייל עבור כל קבוצת לקוחות
        </p>
      </div>

      {/* Eligible — per organ */}
      {eligibleSegment && eligibleSegment.count > 0 && (
        <SegmentSection
          title="זכאי לעדכון"
          count={eligibleSegment.count}
          color="green"
          expanded={expandedSections.has("eligible")}
          onToggle={() => toggleSection("eligible")}
          allSelected={organGroups.every((g) => templateMap.eligible?.[g.organId])}
        >
          {organGroups.map((group) => {
            const selected = templateMap.eligible?.[group.organId]
            return (
              <div key={group.organId} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Users className="h-4 w-4" />
                  <span>{group.organName}</span>
                  <Badge variant="secondary" className="text-xs">{group.count}</Badge>
                  {selected && <Check className="h-4 w-4 text-green-600" />}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mr-6">
                  {templates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      isSelected={selected?.templateId === t.id}
                      isSaving={saving === `eligible:${group.organId}`}
                      onClick={() => selectForOrgan(group.organId, t)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </SegmentSection>
      )}

      {/* Not Updated */}
      {notUpdatedSegment && notUpdatedSegment.count > 0 && (
        <SegmentSection
          title="לא מעודכן (סט שלם)"
          count={notUpdatedSegment.count}
          color="orange"
          expanded={expandedSections.has("not_updated")}
          onToggle={() => toggleSection("not_updated")}
          allSelected={!!templateMap.not_updated}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                isSelected={templateMap.not_updated?.templateId === t.id}
                isSaving={saving === "not_updated"}
                onClick={() => selectForSegment("not_updated", t)}
              />
            ))}
          </div>
        </SegmentSection>
      )}

      {/* Half Set */}
      {halfSetSegment && halfSetSegment.count > 0 && (
        <SegmentSection
          title="חצי סט"
          count={halfSetSegment.count}
          color="blue"
          expanded={expandedSections.has("half_set")}
          onToggle={() => toggleSection("half_set")}
          allSelected={!!templateMap.half_set}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                isSelected={templateMap.half_set?.templateId === t.id}
                isSaving={saving === "half_set"}
                onClick={() => selectForSegment("half_set", t)}
              />
            ))}
          </div>
        </SegmentSection>
      )}
    </div>
  )
}

// ===== Sub-components =====

function SegmentSection({
  title,
  count,
  color,
  expanded,
  onToggle,
  allSelected,
  children,
}: {
  title: string
  count: number
  color: string
  expanded: boolean
  onToggle: () => void
  allSelected: boolean
  children: React.ReactNode
}) {
  const colorMap: Record<string, string> = {
    green: "border-green-200 bg-green-50/50",
    orange: "border-orange-200 bg-orange-50/50",
    blue: "border-blue-200 bg-blue-50/50",
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden", colorMap[color] || "border-gray-200")}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">{title}</span>
          <Badge variant="secondary">{count}</Badge>
          {allSelected && (
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
              <Check className="h-3 w-3 ml-1" />
              תבניות נבחרו
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  )
}

function TemplateCard({
  template,
  isSelected,
  isSaving,
  onClick,
}: {
  template: EmailTemplate
  isSelected: boolean
  isSaving: boolean
  onClick: () => void
}) {
  return (
    <Card
      onClick={() => !isSaving && onClick()}
      className={cn(
        "border-2 cursor-pointer transition-all hover:shadow-md",
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-sm"
          : "border-gray-200 hover:border-blue-300"
      )}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate flex-1">{template.name}</span>
          {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />}
        </div>
        {template.category && (
          <Badge variant="secondary" className="text-[10px]">{template.category}</Badge>
        )}
        <p className="text-xs text-muted-foreground line-clamp-2" dir="rtl">
          נושא: {template.subject}
        </p>
      </CardContent>
    </Card>
  )
}
