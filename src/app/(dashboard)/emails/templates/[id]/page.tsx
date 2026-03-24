"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
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
import { EmailEditor } from "@/components/emails/email-editor"
import type { EmailBlock } from "@/components/emails/block-editor/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ArrowRight, Save, Loader2, Import } from "lucide-react"

interface TemplateData {
  name: string
  subject: string
  body: string
  category: string
  folderId: string
  variables: string[]
  blocks: EmailBlock[]
}

interface EmailFolder {
  id: string
  name: string
  key: string
}

export default function EditTemplatePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string
  const isNew = id === "new"

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [allTemplates, setAllTemplates] = useState<Array<{ id: string; name: string; folderId: string | null }>>([])
  const [importLoading, setImportLoading] = useState(false)

  const [form, setForm] = useState<TemplateData>({
    name: "",
    subject: "",
    body: "",
    category: "",
    folderId: searchParams.get("folderId") || "",
    variables: [],
    blocks: [],
  })

  // Fetch folders
  useEffect(() => {
    fetch("/api/emails/folders")
      .then((res) => res.json())
      .then((data) => setFolders(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (isNew) return

    const fetchTemplate = async () => {
      try {
        const res = await fetch(`/api/emails/templates/${id}`)
        if (res.ok) {
          const data = await res.json()
          setForm({
            name: data.name || "",
            subject: data.subject || "",
            body: data.body || "",
            category: data.category || "",
            folderId: data.folderId || "",
            variables: data.variables || [],
            blocks: (data.blocks as EmailBlock[]) || [],
          })
        }
      } catch (err) {
        console.error("Error fetching template:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchTemplate()
  }, [id, isNew])

  useEffect(() => {
    const matches = form.body.match(/\{\{(\w+)\}\}/g) || []
    const vars = [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))]
    setForm((prev) => ({ ...prev, variables: vars }))
  }, [form.body])

  const handleBlocksChange = useCallback((blocks: EmailBlock[]) => {
    setForm((prev) => ({ ...prev, blocks }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError("")

    try {
      const url = isNew ? "/api/emails/templates" : `/api/emails/templates/${id}`
      const method = isNew ? "POST" : "PATCH"

      // Find folder key for backward compat category field
      const matchedFolder = folders.find((f) => f.id === form.folderId)

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          category: matchedFolder?.key || form.category || null,
          folderId: form.folderId || null,
          blocks: form.blocks.length > 0 ? form.blocks : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "שגיאה בשמירה")
      }

      const data = await res.json()
      if (isNew) {
        router.push(`/emails/templates/${data.id}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה")
    } finally {
      setSaving(false)
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/emails")}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
            {isNew ? "תבנית חדשה" : "עריכת תבנית"}
          </h2>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
          ) : (
            <Save className="h-4 w-4 ml-2" />
          )}
          שמור
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">פרטי תבנית</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={async () => {
              setImportDialogOpen(true)
              if (allTemplates.length === 0) {
                setImportLoading(true)
                try {
                  const res = await fetch("/api/emails/templates")
                  const data = await res.json()
                  setAllTemplates((data.templates || data || []).map((t: { id: string; name: string; folderId: string | null }) => ({ id: t.id, name: t.name, folderId: t.folderId })))
                } catch { /* */ }
                setImportLoading(false)
              }
            }}
          >
            <Import className="h-4 w-4" />
            ייבא מתבנית
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם התבנית</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="שם התבנית"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>תיקייה</Label>
              <Select
                value={form.folderId || "_none"}
                onValueChange={(v) => setForm({ ...form, folderId: v === "_none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר תיקייה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">ללא תיקייה</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">נושא</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="נושא המייל"
                required
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="whitespace-nowrap text-xs"
                onClick={() => {
                  const input = document.getElementById("subject") as HTMLInputElement
                  const start = input.selectionStart ?? form.subject.length
                  const end = input.selectionEnd ?? form.subject.length
                  const newSubject = form.subject.slice(0, start) + "{{גרסת_עדכון}}" + form.subject.slice(end)
                  setForm({ ...form, subject: newSubject })
                  setTimeout(() => { input.focus(); input.setSelectionRange(start + 14, start + 14) }, 0)
                }}
              >
                גרסת עדכון
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="whitespace-nowrap text-xs"
                onClick={() => {
                  const input = document.getElementById("subject") as HTMLInputElement
                  const start = input.selectionStart ?? form.subject.length
                  const end = input.selectionEnd ?? form.subject.length
                  const newSubject = form.subject.slice(0, start) + "{{תאריך}}" + form.subject.slice(end)
                  setForm({ ...form, subject: newSubject })
                  setTimeout(() => { input.focus(); input.setSelectionRange(start + 9, start + 9) }, 0)
                }}
              >
                תאריך
              </Button>
            </div>
          </div>

          <EmailEditor
            value={form.body}
            onChange={(body) => setForm((prev) => ({ ...prev, body }))}
            initialBlocks={form.blocks}
            onBlocksChange={handleBlocksChange}
          />

          {form.variables.length > 0 && (
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-sm font-medium mb-2">משתנים בשימוש בתבנית:</p>
              <div className="flex flex-wrap gap-1">
                {form.variables.map((v) => (
                  <code
                    key={v}
                    className="text-xs bg-background px-2 py-1 rounded border"
                  >
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog — ייבוא מתבנית קיימת */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>ייבוא תוכן מתבנית קיימת</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {importLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : allTemplates.filter(t => t.id !== id).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">אין תבניות זמינות</p>
            ) : (
              allTemplates.filter(t => t.id !== id).map((t) => (
                <button
                  key={t.id}
                  className="w-full text-right p-3 rounded-md border hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/emails/templates/${t.id}`)
                      if (res.ok) {
                        const data = await res.json()
                        setForm((prev) => ({
                          ...prev,
                          subject: data.subject || prev.subject,
                          body: data.body || prev.body,
                          blocks: data.blocks || prev.blocks,
                        }))
                        setImportDialogOpen(false)
                      }
                    } catch { /* */ }
                  }}
                >
                  <span className="font-medium text-sm">{t.name}</span>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
