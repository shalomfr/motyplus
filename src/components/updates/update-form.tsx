"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, Loader2, Upload, FileText, X as XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface UpdateFormData {
  version: string
  price: number
  description: string
  rhythmsFileUrl: string
  samplesFileUrl: string
  emailSubject: string
  emailBody: string
  releaseDate: string
}

interface UpdateFormProps {
  initialData?: Partial<UpdateFormData>
  updateId?: string
  mode: "create" | "edit"
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
    description: initialData?.description || "",
    rhythmsFileUrl: initialData?.rhythmsFileUrl || "",
    samplesFileUrl: initialData?.samplesFileUrl || "",
    emailSubject: initialData?.emailSubject || "",
    emailBody: initialData?.emailBody || "",
    releaseDate: initialData?.releaseDate || "",
  })

  const [isUploadingRhythms, setIsUploadingRhythms] = useState(false)
  const [isUploadingSamples, setIsUploadingSamples] = useState(false)
  const [rhythmsFileName, setRhythmsFileName] = useState(
    initialData?.rhythmsFileUrl ? extractFilename(initialData.rhythmsFileUrl) : ""
  )
  const [samplesFileName, setSamplesFileName] = useState(
    initialData?.samplesFileUrl ? extractFilename(initialData.samplesFileUrl) : ""
  )

  const handleChange = (field: keyof UpdateFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "rhythmsFileUrl" | "samplesFileUrl",
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
                onChange={(e) => handleChange("version", e.target.value)}
                placeholder="לדוגמה: V4.0"
                required
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
            <Label htmlFor="releaseDate">תאריך שחרור</Label>
            <Input
              id="releaseDate"
              type="date"
              value={form.releaseDate}
              onChange={(e) => handleChange("releaseDate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור</Label>
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
                  <FileText className="h-4 w-4 text-blue-500 shrink-0" />
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
                  "flex items-center gap-2 cursor-pointer px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex-1",
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

          {/* Samples ZIP */}
          <div className="space-y-2">
            <Label>קובץ דגימות (ZIP)</Label>
            <div className="flex items-center gap-2">
              {samplesFileName ? (
                <div className="flex items-center gap-2 flex-1 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm">
                  <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="truncate">{samplesFileName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, samplesFileUrl: "" }))
                      setSamplesFileName("")
                    }}
                    className="mr-auto text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className={cn(
                  "flex items-center gap-2 cursor-pointer px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex-1",
                  isUploadingSamples && "opacity-50 cursor-not-allowed"
                )}>
                  {isUploadingSamples ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span>{isUploadingSamples ? "מעלה קובץ..." : "העלה קובץ דגימות (.zip)"}</span>
                  <input
                    type="file"
                    accept=".zip"
                    className="hidden"
                    disabled={isUploadingSamples}
                    onChange={(e) => handleFileUpload(e, "samplesFileUrl", setIsUploadingSamples, setSamplesFileName)}
                  />
                </label>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
              משתנים זמינים: {"{{customerName}}"}, {"{{version}}"}, {"{{downloadLink}}"}, {"{{rhythmsLink}}"}, {"{{samplesLink}}"}, {"{{infoLink}}"}, {"{{organInfoLink}}"}
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
