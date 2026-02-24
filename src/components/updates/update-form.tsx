"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, Loader2 } from "lucide-react"

interface UpdateFormData {
  version: string
  price: number
  description: string
  driveRhythmsFolder: string
  driveSamplesFolder: string
  emailSubject: string
  emailBody: string
  releaseDate: string
}

interface UpdateFormProps {
  initialData?: Partial<UpdateFormData>
  updateId?: string
  mode: "create" | "edit"
}

export function UpdateForm({ initialData, updateId, mode }: UpdateFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState<UpdateFormData>({
    version: initialData?.version || "",
    price: initialData?.price || 0,
    description: initialData?.description || "",
    driveRhythmsFolder: initialData?.driveRhythmsFolder || "",
    driveSamplesFolder: initialData?.driveSamplesFolder || "",
    emailSubject: initialData?.emailSubject || "",
    emailBody: initialData?.emailBody || "",
    releaseDate: initialData?.releaseDate || "",
  })

  const handleChange = (field: keyof UpdateFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const url = mode === "create" ? "/api/updates" : `/api/updates/${updateId}`
      const method = mode === "create" ? "POST" : "PATCH"

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
          <CardTitle className="text-lg">קישורי Drive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driveRhythmsFolder">תיקיית ריתמוסים</Label>
            <Input
              id="driveRhythmsFolder"
              value={form.driveRhythmsFolder}
              onChange={(e) => handleChange("driveRhythmsFolder", e.target.value)}
              placeholder="קישור לתיקייה ב-Google Drive"
              dir="ltr"
              className="text-left"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="driveSamplesFolder">תיקיית דגימות</Label>
            <Input
              id="driveSamplesFolder"
              value={form.driveSamplesFolder}
              onChange={(e) => handleChange("driveSamplesFolder", e.target.value)}
              placeholder="קישור לתיקייה ב-Google Drive"
              dir="ltr"
              className="text-left"
            />
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
              משתנים זמינים: {"{{customerName}}"}, {"{{version}}"}, {"{{downloadLink}}"}
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
