"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Plus, Send, Mail, Loader2, Edit, Users, AlertTriangle, Info,
  RefreshCw, UserPlus, Percent, Gift, Bell, ShoppingBag,
  ChevronDown, ChevronUp, FolderOpen, FolderPlus, Trash2, Pencil,
  Copy, GripVertical, FolderInput, Download, Upload, Eye,
  Clock, Package,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { BulkQuoteWizardDialog } from "@/components/emails/bulk-quote-wizard-dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { EmailPreview } from "@/components/emails/email-preview"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: string | null
  folderId: string | null
  variables: string[]
  blocks: unknown[]
  order?: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    emailLogs: number
  }
}

interface EmailFolder {
  id: string
  name: string
  key: string
  color: string
  iconName: string
  order: number
  _count?: { templates: number }
}

interface PendingUpdate {
  id: string
  version: string
  status: string
  updateType: string
  price: number
  description: string | null
  releaseDate: string | null
  createdAt: string
  totalCustomers: number
  sentCount: number
  pendingCount: number
}

const ICON_MAP: Record<string, LucideIcon> = {
  RefreshCw,
  ShoppingBag,
  UserPlus,
  Percent,
  Gift,
  Bell,
  FolderOpen,
}

const COLOR_MAP: Record<string, { border: string; bg: string; text: string }> = {
  blue:    { border: "border-r-orange-500",    bg: "bg-orange-100",    text: "text-blue-600" },
  emerald: { border: "border-r-emerald-500", bg: "bg-emerald-100", text: "text-emerald-600" },
  green:   { border: "border-r-green-500",   bg: "bg-green-100",   text: "text-green-600" },
  orange:  { border: "border-r-orange-500",  bg: "bg-orange-100",  text: "text-blue-600" },
  pink:    { border: "border-r-pink-500",    bg: "bg-pink-100",    text: "text-pink-600" },
  amber:   { border: "border-r-amber-500",   bg: "bg-amber-100",   text: "text-amber-600" },
  gray:    { border: "border-r-gray-500",    bg: "bg-gray-100",    text: "text-gray-600" },
  red:     { border: "border-r-red-500",     bg: "bg-red-100",     text: "text-red-600" },
  purple:  { border: "border-r-orange-500",  bg: "bg-orange-100",  text: "text-blue-600" },
  cyan:    { border: "border-r-cyan-500",    bg: "bg-cyan-100",    text: "text-cyan-600" },
  indigo:  { border: "border-r-blue-500",  bg: "bg-blue-100",  text: "text-blue-600" },
}

const AVAILABLE_COLORS = Object.keys(COLOR_MAP)

function getColorClasses(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.gray
}

function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || FolderOpen
}

export default function EmailsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [bulkWizardOpen, setBulkWizardOpen] = useState(false)
  const [bulkWizardType, setBulkWizardType] = useState<"not_updated" | "half_set" | undefined>(undefined)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Dialog state
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<EmailFolder | null>(null)
  const [folderName, setFolderName] = useState("")
  const [folderColor, setFolderColor] = useState("gray")
  const [folderSaving, setFolderSaving] = useState(false)

  // Duplicate to folder dialog
  const [dupDialogOpen, setDupDialogOpen] = useState(false)
  const [dupTemplate, setDupTemplate] = useState<EmailTemplate | null>(null)
  const [dupFolderId, setDupFolderId] = useState("")

  // New template dialog
  const [newTemplateDialogOpen, setNewTemplateDialogOpen] = useState(false)
  const [newTemplateFolderId, setNewTemplateFolderId] = useState("")

  // Move to folder dialog
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveTemplate, setMoveTemplate] = useState<EmailTemplate | null>(null)
  const [moveFolderId, setMoveFolderId] = useState("")

  // Preview dialog
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)

  // Pending updates for send tab
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("templates")

  const fetchPendingUpdates = async () => {
    setPendingLoading(true)
    try {
      const res = await fetch("/api/updates/pending")
      if (res.ok) {
        const data = await res.json()
        setPendingUpdates(data)
      }
    } catch (err) {
      console.error("Error fetching pending updates:", err)
    } finally {
      setPendingLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "sending") {
      fetchPendingUpdates()
    }
  }, [activeTab])

  const openBulkWizard = (type: "not_updated" | "half_set") => {
    setBulkWizardType(type)
    setBulkWizardOpen(true)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templatesRes, foldersRes] = await Promise.all([
          fetch("/api/emails/templates"),
          fetch("/api/emails/folders"),
        ])
        if (templatesRes.ok) {
          const data = await templatesRes.json()
          setTemplates(data.templates || data)
        }
        if (foldersRes.ok) {
          const data = await foldersRes.json()
          setFolders(data)
        }
      } catch (err) {
        console.error("Error fetching data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`למחוק את התבנית "${name}"? פעולה זו לא ניתנת לביטול.`)) return
    try {
      const res = await fetch(`/api/emails/templates/${id}`, { method: "DELETE" })
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id))
        toast({ title: "התבנית נמחקה" })
      } else {
        const data = await res.json()
        toast({ title: data.error || "שגיאה במחיקה", variant: "destructive" })
      }
    } catch {
      toast({ title: "שגיאה במחיקת התבנית", variant: "destructive" })
    }
  }

  const handleDuplicateTemplate = (template: EmailTemplate) => {
    setDupTemplate(template)
    setDupFolderId(template.folderId || "")
    setDupDialogOpen(true)
  }

  const confirmDuplicate = async () => {
    if (!dupTemplate) return
    try {
      const res = await fetch("/api/emails/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${dupTemplate.name} (עותק)`,
          subject: dupTemplate.subject,
          body: dupTemplate.body,
          category: dupTemplate.category,
          folderId: dupFolderId || null,
          blocks: dupTemplate.blocks,
        }),
      })
      if (res.ok) {
        const newTemplate = await res.json()
        setTemplates((prev) => [...prev, newTemplate])
        toast({ title: "התבנית שוכפלה בהצלחה" })
      } else {
        toast({ title: "שגיאה בשכפול", variant: "destructive" })
      }
    } catch {
      toast({ title: "שגיאה בשכפול התבנית", variant: "destructive" })
    }
    setDupDialogOpen(false)
    setDupTemplate(null)
  }

  const confirmMove = async () => {
    if (!moveTemplate) return
    try {
      const res = await fetch(`/api/emails/templates/${moveTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: moveFolderId || null }),
      })
      if (res.ok) {
        setTemplates((prev) => prev.map((t) => t.id === moveTemplate.id ? { ...t, folderId: moveFolderId || null } : t))
        toast({ title: "התבנית הועברה בהצלחה" })
      } else {
        toast({ title: "שגיאה בהעברה", variant: "destructive" })
      }
    } catch {
      toast({ title: "שגיאה בהעברת התבנית", variant: "destructive" })
    }
    setMoveDialogOpen(false)
    setMoveTemplate(null)
  }

  // Drag & drop for templates within a folder
  const [dragTemplateId, setDragTemplateId] = useState<string | null>(null)

  const handleTemplateDrop = async (targetId: string, folderId: string) => {
    if (!dragTemplateId || dragTemplateId === targetId) {
      setDragTemplateId(null)
      return
    }
    const folderTemplates = templates
      .filter((t) => t.folderId === folderId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const fromIdx = folderTemplates.findIndex((t) => t.id === dragTemplateId)
    const toIdx = folderTemplates.findIndex((t) => t.id === targetId)
    if (fromIdx === -1 || toIdx === -1) { setDragTemplateId(null); return }
    const reordered = [...folderTemplates]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    // Update local state immediately
    const orderMap = new Map(reordered.map((t, i) => [t.id, i]))
    setTemplates((prev) => prev.map((t) => orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id)! } : t))
    // Persist to server
    await fetch("/api/emails/templates/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((t) => t.id) }),
    })
    setDragTemplateId(null)
  }

  // Drag & drop for folders
  const [dragFolderId, setDragFolderId] = useState<string | null>(null)

  const handleFolderDrop = async (targetId: string) => {
    if (!dragFolderId || dragFolderId === targetId) {
      setDragFolderId(null)
      return
    }
    const sorted = [...folders].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const fromIdx = sorted.findIndex((f) => f.id === dragFolderId)
    const toIdx = sorted.findIndex((f) => f.id === targetId)
    if (fromIdx === -1 || toIdx === -1) { setDragFolderId(null); return }
    const reordered = [...sorted]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    setFolders(reordered.map((f, i) => ({ ...f, order: i })))
    await fetch("/api/emails/folders/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((f) => f.id) }),
    })
    setDragFolderId(null)
  }

  // ===== Export / Import =====
  const importFileRef = useRef<HTMLInputElement>(null)

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportTemplate = async (template: EmailTemplate) => {
    try {
      const res = await fetch(`/api/emails/templates/export?id=${template.id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const datePart = new Date().toISOString().slice(0, 10)
      const safeName = template.name.replace(/[^a-zA-Z0-9\u0590-\u05FF_-]/g, "_")
      downloadJson(data, `template-${safeName}-${datePart}.json`)
      toast({ title: "התבנית יוצאה בהצלחה" })
    } catch {
      toast({ title: "שגיאה בייצוא התבנית", variant: "destructive" })
    }
  }

  const handleExportAll = async () => {
    try {
      const res = await fetch("/api/emails/templates/export")
      if (!res.ok) throw new Error()
      const data = await res.json()
      const datePart = new Date().toISOString().slice(0, 10)
      downloadJson(data, `all-templates-${datePart}.json`)
      toast({ title: `${data.templates?.length || 0} תבניות יוצאו בהצלחה` })
    } catch {
      toast({ title: "שגיאה בייצוא התבניות", variant: "destructive" })
    }
  }

  const handleImportTemplates = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch("/api/emails/templates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) {
        toast({ title: result.error || "שגיאה בייבוא", variant: "destructive" })
        return
      }
      // Add imported templates to state
      if (result.templates) {
        setTemplates((prev) => [...prev, ...result.templates])
      }
      toast({ title: result.message || "תבניות יובאו בהצלחה" })
    } catch {
      toast({ title: "שגיאה בקריאת הקובץ — ודא שזהו קובץ JSON תקין", variant: "destructive" })
    }
    // Reset input
    if (importFileRef.current) importFileRef.current.value = ""
  }

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Group templates by folderId, fallback to category for backward compat
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, EmailTemplate[]> = {}
    for (const folder of folders) {
      groups[folder.id] = []
    }
    groups["uncategorized"] = []

    for (const t of templates) {
      if (t.folderId && groups[t.folderId]) {
        groups[t.folderId].push(t)
      } else {
        // Try matching by category → folder.key for backward compat
        const matchedFolder = folders.find(
          (f) => f.key === t.category || (t.category === "general" && f.key === "greeting")
        )
        if (matchedFolder) {
          groups[matchedFolder.id].push(t)
        } else {
          groups["uncategorized"].push(t)
        }
      }
    }

    return groups
  }, [templates, folders])

  const allKeys = folders.map(f => f.id).concat(["uncategorized"])
  const allExpanded = allKeys.every(k => expandedSections.has(k))

  // Folder CRUD
  const openNewFolderDialog = () => {
    setEditingFolder(null)
    setFolderName("")
    setFolderColor("gray")
    setFolderDialogOpen(true)
  }

  const openEditFolderDialog = (folder: EmailFolder) => {
    setEditingFolder(folder)
    setFolderName(folder.name)
    setFolderColor(folder.color)
    setFolderDialogOpen(true)
  }

  const handleSaveFolder = async () => {
    if (!folderName.trim()) return
    setFolderSaving(true)
    try {
      if (editingFolder) {
        const res = await fetch(`/api/emails/folders/${editingFolder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: folderName.trim(), color: folderColor }),
        })
        if (res.ok) {
          const updated = await res.json()
          setFolders((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)))
          toast({ title: "התיקייה עודכנה" })
        }
      } else {
        const res = await fetch("/api/emails/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: folderName.trim(), color: folderColor }),
        })
        if (res.ok) {
          const newFolder = await res.json()
          setFolders((prev) => [...prev, newFolder])
          toast({ title: "התיקייה נוצרה" })
        }
      }
      setFolderDialogOpen(false)
    } catch {
      toast({ title: "שגיאה בשמירת תיקייה", variant: "destructive" })
    } finally {
      setFolderSaving(false)
    }
  }

  const handleDeleteFolder = async (folder: EmailFolder) => {
    const count = groupedTemplates[folder.id]?.length || 0
    const msg = count > 0
      ? `למחוק את התיקייה "${folder.name}"? ${count} תבניות יעברו לללא קטגוריה.`
      : `למחוק את התיקייה "${folder.name}"?`
    if (!confirm(msg)) return
    try {
      const res = await fetch(`/api/emails/folders/${folder.id}`, { method: "DELETE" })
      if (res.ok) {
        setFolders((prev) => prev.filter((f) => f.id !== folder.id))
        // Move templates to uncategorized in UI
        setTemplates((prev) =>
          prev.map((t) => (t.folderId === folder.id ? { ...t, folderId: null } : t))
        )
        toast({ title: "התיקייה נמחקה" })
      }
    } catch {
      toast({ title: "שגיאה במחיקת תיקייה", variant: "destructive" })
    }
  }

  const renderTemplateTable = (templatesList: EmailTemplate[], folderId?: string) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"></TableHead>
          <TableHead>שם</TableHead>
          <TableHead>נושא</TableHead>
          <TableHead>משתנים</TableHead>
          <TableHead>שימושים</TableHead>
          <TableHead>עדכון אחרון</TableHead>
          <TableHead className="w-36">פעולות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templatesList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((template) => (
          <TableRow
            key={template.id}
            draggable={!!folderId}
            onDragStart={() => setDragTemplateId(template.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => folderId && handleTemplateDrop(template.id, folderId)}
            className={dragTemplateId === template.id ? "opacity-50" : ""}
          >
            <TableCell className="w-8 px-1">
              {folderId && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
            </TableCell>
            <TableCell className="font-medium">{template.name}</TableCell>
            <TableCell className="max-w-[200px] truncate">{template.subject}</TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {template.variables.length}
              </span>
            </TableCell>
            <TableCell>{template._count?.emailLogs ?? 0}</TableCell>
            <TableCell className="text-sm">
              {formatDateTime(template.updatedAt)}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewTemplate(template)}
                  title="תצוגה מקדימה"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/emails/templates/${template.id}`)}
                  title="ערוך"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDuplicateTemplate(template)}
                  title="שכפל"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleExportTemplate(template)}
                  title="ייצוא"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setMoveTemplate(template); setMoveFolderId(template.folderId || ""); setMoveDialogOpen(true) }}
                  title="העבר לתיקייה"
                >
                  <FolderInput className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDeleteTemplate(template.id, template.name)}
                  title="מחק"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">מיילים</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="templates" className="gap-2">
            <Mail className="h-4 w-4" />
            תבניות מייל
          </TabsTrigger>
          <TabsTrigger value="sending" className="gap-2">
            <Send className="h-4 w-4" />
            שליחת מיילים
          </TabsTrigger>
        </TabsList>

        {/* ===== טאב תבניות ===== */}
        <TabsContent value="templates" className="space-y-6">

      {/* הסבר על תבניות */}
      <Card className="border-blue-200 bg-orange-50/50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-blue-800">תבניות קבועות ומשתנות</p>
              <p className="text-blue-700">
                <strong>תבניות קבועות</strong> (ברכות, חגים) — התוכן זהה לכל לקוח ולא צריך לשנות אותן.
              </p>
              <p className="text-blue-700">
                <strong>תבניות משתנות</strong> (עדכונים, הצעות מחיר) — משתמשות במשתנים כמו {`{{version}}`}, {`{{downloadLink}}`}, {`{{customerName}}`} שמוחלפים אוטומטית בשליחה.
                <br />
                לא צריך לשנות אותן בכל עדכון — המערכת מחליפה את המשתנים לבד.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* כותרת + הרחב/כווץ + הוסף תיקייה */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <h3 className="font-semibold text-lg">תבניות מייל</h3>
          <Badge variant="outline">{templates.length} תבניות</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setNewTemplateFolderId(""); setNewTemplateDialogOpen(true) }} className="gap-1">
            <Plus className="h-4 w-4" />
            תבנית חדשה
          </Button>
          <Button variant="outline" size="sm" onClick={openNewFolderDialog} className="gap-1">
            <FolderPlus className="h-4 w-4" />
            תיקייה חדשה
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportAll} className="gap-1">
            <Download className="h-4 w-4" />
            ייצוא הכל
          </Button>
          <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()} className="gap-1">
            <Upload className="h-4 w-4" />
            ייבוא תבניות
          </Button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportTemplates}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (allExpanded) {
                setExpandedSections(new Set())
              } else {
                setExpandedSections(new Set(allKeys))
              }
            }}
          >
            {allExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 ml-1" />
                כווץ הכל
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 ml-1" />
                הרחב הכל
              </>
            )}
          </Button>
        </div>
      </div>

      {/* תוכן */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 && folders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          אין תבניות מייל. צור תבנית חדשה כדי להתחיל.
        </div>
      ) : (
        <div className="space-y-3">
          {folders.map(folder => {
            const folderTemplates = groupedTemplates[folder.id] || []
            const Icon = getIcon(folder.iconName)
            const colors = getColorClasses(folder.color)
            const isExpanded = expandedSections.has(folder.id)

            return (
              <Card
                key={folder.id}
                className={`border-r-4 ${colors.border} ${dragFolderId === folder.id ? "opacity-50" : ""}`}
                draggable
                onDragStart={() => setDragFolderId(folder.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFolderDrop(folder.id) }}
                onDragEnd={() => setDragFolderId(null)}
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleSection(folder.id)}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <div className={`p-2 rounded-lg ${colors.bg}`}>
                      <Icon className={`h-4 w-4 ${colors.text}`} />
                    </div>
                    <span className="font-medium">{folder.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {folderTemplates.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); openEditFolderDialog(folder) }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder) }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="pt-0">
                    {folderTemplates.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        אין תבניות בתיקייה זו.{" "}
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={() => router.push(`/emails/templates/new?folderId=${folder.id}`)}
                        >
                          צור תבנית חדשה
                        </button>
                      </p>
                    ) : (
                      renderTemplateTable(folderTemplates, folder.id)
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}

          {/* ללא קטגוריה */}
          {groupedTemplates["uncategorized"]?.length > 0 && (
            <Card className="border-r-4 border-r-gray-400">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection("uncategorized")}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100">
                    <FolderOpen className="h-4 w-4 text-gray-600" />
                  </div>
                  <span className="font-medium">ללא קטגוריה</span>
                  <Badge variant="outline" className="text-xs">
                    {groupedTemplates["uncategorized"].length}
                  </Badge>
                </div>
                {expandedSections.has("uncategorized") ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {expandedSections.has("uncategorized") && (
                <CardContent className="pt-0">
                  {renderTemplateTable(groupedTemplates["uncategorized"])}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}

        </TabsContent>

        {/* ===== טאב שליחת מיילים ===== */}
        <TabsContent value="sending" className="space-y-6">
          {/* עדכונים ממתינים לשליחה */}
          <Card className="border-blue-200 bg-orange-50/50">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium text-blue-800">שליחת עדכונים ומיילים</p>
                  <p className="text-blue-700">
                    כאן ניתן לשלוח עדכונים שהוכנו באשף העדכונים, או לשלוח מיילים מותאמים אישית.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* עדכונים ממתינים */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <h3 className="font-semibold text-lg">עדכונים ממתינים לשליחה</h3>
              </div>
              <Button variant="outline" size="sm" onClick={fetchPendingUpdates} disabled={pendingLoading}>
                {pendingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>

            {pendingLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingUpdates.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>אין עדכונים ממתינים לשליחה</p>
                  <p className="text-xs mt-1">עדכונים שנשמרים באשף העדכונים יופיעו כאן</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingUpdates.map((update) => (
                  <Card key={update.id} className="border-r-4 border-r-orange-400 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <Package className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">
                              עדכון {update.version}
                              <Badge variant="outline" className="mr-2 text-xs">
                                {update.updateType === "FULL" ? "מלא" : "חלקי"}
                              </Badge>
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span>{update.totalCustomers} לקוחות סה&quot;כ</span>
                              <span className="text-green-600">{update.sentCount} נשלחו</span>
                              {update.pendingCount > 0 && (
                                <span className="text-orange-600 font-medium">{update.pendingCount} ממתינים</span>
                              )}
                            </div>
                            {update.description && (
                              <p className="text-xs text-muted-foreground mt-1 max-w-md truncate">{update.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={update.status === "READY" ? "default" : "secondary"}
                            className={update.status === "READY" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                          >
                            {update.status === "READY" ? "מוכן לשליחה" : "בשליחה"}
                          </Badge>
                          <Button
                            onClick={() => router.push(`/updates/${update.id}/wizard`)}
                            className="gap-2 bg-green-600 hover:bg-green-700"
                          >
                            <Send className="h-4 w-4" />
                            שלח עדכון
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* שליחה קבוצתית */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <h3 className="font-semibold text-lg">שליחה קבוצתית</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-r-4 border-r-red-400 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openBulkWizard("not_updated")}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">שלח למי שלא מעודכן</p>
                      <p className="text-xs text-muted-foreground">מייל עם הצעת מחיר לעדכון</p>
                    </div>
                  </div>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
              <Card className="border-r-4 border-r-amber-400 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openBulkWizard("half_set")}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Users className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">שלח לחצאי סטים</p>
                      <p className="text-xs text-muted-foreground">הצעה לשדרוג לסט שלם</p>
                    </div>
                  </div>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* שליחת מייל מותאם */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <h3 className="font-semibold text-lg">שליחת מייל מותאם</h3>
            </div>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/emails/send")}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">שלח מייל מותאם אישית</p>
                    <p className="text-xs text-muted-foreground">בחר תבנית, נמענים, ושלח מייל</p>
                  </div>
                </div>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <BulkQuoteWizardDialog
        open={bulkWizardOpen}
        onOpenChange={setBulkWizardOpen}
        initialType={bulkWizardType}
      />

      {/* Dialog — תצוגה מקדימה של תבנית */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              תצוגה מקדימה — {previewTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <EmailPreview
              subject={previewTemplate.subject}
              body={previewTemplate.body}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog — יצירה/עריכת תיקייה */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? "עריכת תיקייה" : "תיקייה חדשה"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">שם התיקייה</label>
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="לדוגמה: מיילים של חגים"
                dir="rtl"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">צבע</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_COLORS.map((c) => {
                  const cls = getColorClasses(c)
                  return (
                    <button
                      key={c}
                      className={`w-8 h-8 rounded-full border-2 ${cls.bg} ${
                        folderColor === c ? "ring-2 ring-offset-2 ring-blue-500" : ""
                      }`}
                      onClick={() => setFolderColor(c)}
                    />
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveFolder} disabled={folderSaving || !folderName.trim()}>
              {folderSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              {editingFolder ? "שמור" : "צור תיקייה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — שכפול תבנית לתיקייה */}
      <Dialog open={dupDialogOpen} onOpenChange={setDupDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>שכפול תבנית</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              שכפול &quot;{dupTemplate?.name}&quot; — בחר תיקיית יעד:
            </p>
            <select
              value={dupFolderId}
              onChange={(e) => setDupFolderId(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">ללא תיקייה</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupDialogOpen(false)}>ביטול</Button>
            <Button onClick={confirmDuplicate}>שכפל</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — תבנית חדשה עם בחירת תיקייה */}
      <Dialog open={newTemplateDialogOpen} onOpenChange={setNewTemplateDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>תבנית חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">בחר תיקייה לתבנית החדשה:</p>
            <select
              value={newTemplateFolderId}
              onChange={(e) => setNewTemplateFolderId(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">ללא תיקייה</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTemplateDialogOpen(false)}>ביטול</Button>
            <Button onClick={() => {
              setNewTemplateDialogOpen(false)
              const params = newTemplateFolderId ? `?folderId=${newTemplateFolderId}` : ""
              router.push(`/emails/templates/new${params}`)
            }}>
              צור תבנית
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — העברת תבנית לתיקייה */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>העברת תבנית לתיקייה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              העברת &quot;{moveTemplate?.name}&quot; — בחר תיקיית יעד:
            </p>
            <select
              value={moveFolderId}
              onChange={(e) => setMoveFolderId(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">ללא תיקייה</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>ביטול</Button>
            <Button onClick={confirmMove}>העבר</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
