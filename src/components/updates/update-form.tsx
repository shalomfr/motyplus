"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, Loader2, Upload, FileText, X as XIcon, Disc, Music } from "lucide-react"
import { cn } from "@/lib/utils"
import { SamplesUploader } from "@/components/updates/samples-uploader"

interface UpdateFormData {
  version: string
  price: number
  updateType: "FULL" | "PARTIAL"
  description: string
  rhythmsFileUrl: string
  emailSubject: string
  emailBody: string
  releaseDate: string
}

interface UpdateFormProps {
  initialData?: Partial<UpdateFormData>
  updateId?: string
  mode: "create" | "edit"
}

// זיהוי אוטומטי: מספר עגול (V5, 5, V7.0) = FULL, עם נקודה (V5.1, 5.2) = PARTIAL
function detectUpdateType(version: string): "FULL" | "PARTIAL" {
  const cleaned = version.replace(/^V/i, "").trim()
  if (/^\d+$/.test(cleaned) || /^\d+\.0$/.test(cleaned)) return "FULL"
  if (/^\d+\.\d+$/.test(cleaned)) return "PARTIAL"
  return "FULL"
}

function extractFilename(url: string): string {
  const parts = url.split("/")
  const raw = parts[parts.length - 1]
  const match = raw.match(/^\d+-(.+)$/)
  return match ? match[1] : raw
}

export function UpdateForm({ initialData, updateId, mode }: UpdateFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState<UpdateFormData>({
    version: initialData?.version || "",
    price: initialData?.price || 0,
    updateType: (initialData as { updateType?: "FULL" | "PARTIAL" })?.updateType || "FULL",
    description: initialData?.description || "",
    rhythmsFileUrl: initialData?.rhythmsFileUrl || "",
    emailSubject: initialData?.emailSubject || "",
    emailBody: initialData?.emailBody || "",
    releaseDate: initialData?.releaseDate || "",
  })

  // Load email template on create mode
  useEffect(() => {
    if (mode !== "create" || form.emailSubject || form.emailBody) return
    fetch("/api/emails/templates")
      .then((r) => r.ok ? r.json() : [])
      .then((templates: { name: string; subject: string; body: string }[]) => {
        const tpl = templates.find((t) => t.name === "שליחת עדכון")
        if (tpl) {
          setForm((prev) => ({
            ...prev,
            emailSubject: prev.emailSubject || tpl.subject,
            emailBody: prev.emailBody || tpl.body,
          }))
        }
      })
      .catch(() => {})
  }, [mode])

  const [isUploadingRhythms, setIsUploadingRhythms] = useState(false)
  const [rhythmsFileName, setRhythmsFileName] = useState(
    initialData?.rhythmsFileUrl ? extractFilename(initialData.rhythmsFileUrl) : ""
  )

  const handleChange = (field: keyof UpdateFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleVersionChange = (version: string) => {
    const updateType = detectUpdateType(version)
    setForm((prev) => ({ ...prev, version, updateType }))
  }

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "rhythmsFileUrl",
    setUploading: (v: boolean) => void,
    setFileName: (v: string) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "updates")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "שגיאה בהעלאה")
      setForm((prev) => ({ ...prev, [field]: data.url }))
      setFileName(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const url = mode === "create" ? "/api/updates" : `/api/updates/${updateId}`
      const method = mode === "create" ? "POST" : "PUT"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          releaseDate: form.releaseDate || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "שגיאה בשמירה")
      }

      const data = await res.json()
      router.push(`/updates/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">פרטי עדכון</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="version">שם גרסה</Label>
              <Input
                id="version"
                value={form.version}
                onChange={(e) => handleVersionChange(e.target.value)}
                placeholder="לדוגמה: V5, V5.1, V7"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">מחיר</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => handleChange("price", parseFloat(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>סוג עדכון</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChange("updateType", "FULL")}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-right ${
                  form.updateType === "FULL"
                    ? "border-blue-500 bg-orange-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Disc className="h-5 w-5 shrink-0" />
                <div>
                  <div className="font-medium text-sm">עדכון מלא</div>
                  <div className="text-xs text-muted-foreground">מקצבים + דגימות</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleChange("updateType", "PARTIAL")}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-right ${
                  form.updateType === "PARTIAL"
                    ? "border-blue-500 bg-orange-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Music className="h-5 w-5 shrink-0" />
                <div>
                  <div className="font-medium text-sm">עדכון חלקי</div>
                  <div className="text-xs text-muted-foreground">מקצבים בלבד</div>
                </div>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {form.updateType === "FULL"
                ? "תיקיות ייווצרו ב-5 חבילות: Basic, Full set, Half set, ketron&motif, Live"
                : "תיקיות ייווצרו רק ב-Full set"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="releaseDate">תאריך שחרור</Label>
            <Input
              id="releaseDate"
              type="date"
              value={form.releaseDate}
              onChange={(e) => handleChange("releaseDate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">תיאור</Label>
              {form.description && (
                <button
                  type="button"
                  onClick={() => handleChange("description", "")}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  נקה תיאור
                </button>
              )}
            </div>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="תיאור העדכון..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">קבצי עדכון</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rhythms ZIP */}
          <div className="space-y-2">
            <Label>קובץ ריתמוסים (ZIP)</Label>
            <div className="flex items-center gap-2">
              {rhythmsFileName ? (
                <div className="flex items-center gap-2 flex-1 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm">
                  <FileText className="h-4 w-4 text-orange-500 shrink-0" />
                  <span className="truncate">{rhythmsFileName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, rhythmsFileUrl: "" }))
                      setRhythmsFileName("")
                    }}
                    className="mr-auto text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className={cn(
                  "flex items-center gap-2 cursor-pointer px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-orange-400 hover:text-blue-600 transition-colors flex-1",
                  isUploadingRhythms && "opacity-50 cursor-not-allowed"
                )}>
                  {isUploadingRhythms ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span>{isUploadingRhythms ? "מעלה קובץ..." : "העלה קובץ ריתמוסים (.zip)"}</span>
                  <input
                    type="file"
                    accept=".zip"
                    className="hidden"
                    disabled={isUploadingRhythms}
                    onChange={(e) => handleFileUpload(e, "rhythmsFileUrl", setIsUploadingRhythms, setRhythmsFileName)}
                  />
                </label>
              )}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* CPI Samples — only in edit mode (update must exist first) */}
      {mode === "edit" && updateId && (
        <SamplesUploader updateId={updateId} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">תבנית מייל</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emailSubject">נושא המייל</Label>
            <Input
              id="emailSubject"
              value={form.emailSubject}
              onChange={(e) => handleChange("emailSubject", e.target.value)}
              placeholder="נושא המייל שישלח ללקוחות"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emailBody">תוכן המייל</Label>
            <Textarea
              id="emailBody"
              value={form.emailBody}
              onChange={(e) => handleChange("emailBody", e.target.value)}
              placeholder="תוכן המייל (ניתן להשתמש ב-HTML)..."
              rows={8}
              dir="rtl"
            />
            <p className="text-xs text-muted-foreground">
              משתנים זמינים: {"{{customerName}}"}, {"{{version}}"}, {"{{downloadLink}}"}, {"{{downloadLink2}}"}, {"{{rhythmsLink}}"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
          ) : (
            <Save className="h-4 w-4 ml-2" />
          )}
          {mode === "create" ? "צור עדכון" : "שמור שינויים"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          ביטול
        </Button>
      </div>
    </form>
  )
}
