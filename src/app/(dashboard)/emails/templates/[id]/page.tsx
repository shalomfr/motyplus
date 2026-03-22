"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
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
import { ArrowRight, Save, Loader2 } from "lucide-react"

interface TemplateData {
  name: string
  subject: string
  body: string
  category: string
  variables: string[]
  blocks: EmailBlock[]
}

const CATEGORIES = [
  { value: "update", label: "מיילים של עדכון" },
  { value: "after_purchase", label: "אחרי רכישה" },
  { value: "welcome", label: "לקוח חדש" },
  { value: "promotion", label: "מבצעים והצעות מחיר" },
  { value: "greeting", label: "ברכות וחגים" },
  { value: "reminder", label: "תזכורות" },
]

export default function EditTemplatePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const isNew = id === "new"

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState<TemplateData>({
    name: "",
    subject: "",
    body: "",
    category: "general",
    variables: [],
    blocks: [],
  })

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
            category: data.category || "general",
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

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
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
        <CardHeader>
          <CardTitle className="text-lg">פרטי תבנית</CardTitle>
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
              <Label>קטגוריה</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">נושא</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="נושא המייל"
              required
            />
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
    </div>
  )
}
