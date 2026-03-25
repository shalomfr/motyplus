"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, Mail, ChevronDown, ChevronUp, Users, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [templateMap, setTemplateMap] = useState<EmailTemplateMap>(emailTemplateMap || {})
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set<string>())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set<string>())

  const [allOrgans, setAllOrgans] = useState<OrganGroup[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const [templatesRes, organsRes, foldersRes] = await Promise.all([
          fetch("/api/emails/templates"),
          fetch("/api/public/organs"),
          fetch("/api/emails/folders"),
        ])
        if (templatesRes.ok) {
          const data = await templatesRes.json()
          setTemplates(data.filter((t: EmailTemplate) => t.isActive))
        }
        if (organsRes.ok) {
          const organs = await organsRes.json()
          setAllOrgans(organs.map((o: { id: string; name: string }) => ({
            organId: o.id,
            organName: o.name,
            count: 0,
          })))
        }
        if (foldersRes.ok) {
          const foldersData = await foldersRes.json()
          setFolders(
            (foldersData as { id: string; name: string; order: number }[])
              .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
          )
        }
      } catch (err) {
        console.error("Failed to fetch data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
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

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

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
      const folderTemplates = folderMap.get(folder.id)
      if (folderTemplates && folderTemplates.length > 0) {
        groups.push({ folderId: folder.id, folderName: folder.name, templates: folderTemplates })
      }
    }

    if (unfiled.length > 0) {
      groups.push({ folderId: null, folderName: "כללי", templates: unfiled })
    }

    return groups
  }, [templates, folders])

  // Folder-name based filtering for each segment
  const segmentFolderMap = useMemo(() => {
    const map: Record<string, Set<string>> = {
      eligible: new Set<string>(),
      not_updated: new Set<string>(),
      half_set: new Set<string>(),
    }
    for (const f of folders) {
      const name = f.name.trim()
      // Exact matching to avoid "לא מעודכנים" being included in "מעודכנים"
      if (name === "מעודכנים") {
        map.eligible.add(f.id)
      } else if (name === "לא מעודכנים") {
        map.not_updated.add(f.id)
      } else if (name === "מבצעים והצעות מחיר" || name === "הצעות מחיר") {
        map.not_updated.add(f.id)
        map.half_set.add(f.id)
      }
    }
    return map
  }, [folders])

  const filterGroupsBySegment = (groups: typeof groupedTemplates, segmentKey: string) => {
    const allowedIds = segmentFolderMap[segmentKey]
    if (!allowedIds || allowedIds.size === 0) return groups // fallback: show all if no matching folders
    return groups.filter((g) => g.folderId != null && allowedIds.has(g.folderId))
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

  const renderFolderedTemplates = (
    selectedId: string | undefined,
    isSavingKey: string,
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
              <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {group.templates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isSelected={selectedId === t.id}
                    isSaving={saving === isSavingKey}
                    onClick={() => onSelect(t)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const mergedOrgans = allOrgans.map((o) => {
    const fromApi = organGroups.find((g) => g.organId === o.organId)
    return { ...o, count: fromApi?.count || 0 }
  })
  for (const g of organGroups) {
    if (!mergedOrgans.find((o) => o.organId === g.organId)) {
      mergedOrgans.push(g)
    }
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
      {mergedOrgans.length > 0 && (
        <SegmentSection
          title="זכאי לעדכון"
          count={eligibleSegment?.count || 0}
          color="green"
          expanded={expandedSections.has("eligible")}
          onToggle={() => toggleSection("eligible")}
          allSelected={mergedOrgans.every((g) => templateMap.eligible?.[g.organId])}
          selectedSummary={getEligibleSummary(mergedOrgans, templateMap)}
        >
          {mergedOrgans.map((group) => {
            const selected = templateMap.eligible?.[group.organId]
            return (
              <div key={group.organId} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Users className="h-4 w-4" />
                  <span>{group.organName}</span>
                  <Badge variant="secondary" className="text-xs">{group.count}</Badge>
                  {selected && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      {selected.templateName}
                    </span>
                  )}
                </div>
                <div className="mr-6">
                  {renderFolderedTemplates(
                    selected?.templateId,
                    `eligible:${group.organId}`,
                    (t) => selectForOrgan(group.organId, t),
                    filterGroupsBySegment(groupedTemplates, "eligible"),
                  )}
                </div>
              </div>
            )
          })}
        </SegmentSection>
      )}

      {/* Not Updated */}
      {notUpdatedSegment && (
        <SegmentSection
          title="לא מעודכן (סט שלם)"
          count={notUpdatedSegment.count}
          color="orange"
          expanded={expandedSections.has("not_updated")}
          onToggle={() => toggleSection("not_updated")}
          allSelected={!!templateMap.not_updated}
          selectedSummary={templateMap.not_updated?.templateName}
        >
          {renderFolderedTemplates(
            templateMap.not_updated?.templateId,
            "not_updated",
            (t) => selectForSegment("not_updated", t),
            filterGroupsBySegment(groupedTemplates, "not_updated"),
          )}
        </SegmentSection>
      )}

      {/* Half Set */}
      {halfSetSegment && (
        <SegmentSection
          title="חצי סט"
          count={halfSetSegment.count}
          color="blue"
          expanded={expandedSections.has("half_set")}
          onToggle={() => toggleSection("half_set")}
          allSelected={!!templateMap.half_set}
          selectedSummary={templateMap.half_set?.templateName}
        >
          {renderFolderedTemplates(
            templateMap.half_set?.templateId,
            "half_set",
            (t) => selectForSegment("half_set", t),
            filterGroupsBySegment(groupedTemplates, "half_set"),
          )}
        </SegmentSection>
      )}
    </div>
  )
}

// ===== Helpers =====

function getEligibleSummary(organs: OrganGroup[], templateMap: EmailTemplateMap): string | undefined {
  const selected = organs.filter((o) => templateMap.eligible?.[o.organId])
  if (selected.length === 0) return undefined
  if (selected.length === organs.length) return `כל ${organs.length} האורגנים מוגדרים`
  return `${selected.length}/${organs.length} אורגנים מוגדרים`
}

// ===== Sub-components =====

function SegmentSection({
  title,
  count,
  color,
  expanded,
  onToggle,
  allSelected,
  selectedSummary,
  children,
}: {
  title: string
  count: number
  color: string
  expanded: boolean
  onToggle: () => void
  allSelected: boolean
  selectedSummary?: string
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-800">{title}</span>
          <Badge variant="secondary">{count}</Badge>
          {allSelected && (
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
              <Check className="h-3 w-3 ml-1" />
              תבניות נבחרו
            </Badge>
          )}
          {!expanded && selectedSummary && !allSelected && (
            <span className="text-xs text-gray-500">{selectedSummary}</span>
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
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate flex-1">{template.name}</span>
          {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1" dir="rtl">
          {template.subject}
        </p>
      </CardContent>
    </Card>
  )
}
