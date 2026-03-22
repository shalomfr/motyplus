"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

type PageState = "loading" | "ready" | "uploading" | "success" | "error" | "expired" | "invalid"

export default function UploadInfoPage() {
  const params = useParams()
  const token = params.token as string

  const [state, setState] = useState<PageState>("loading")
  const [customerName, setCustomerName] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [fileName, setFileName] = useState("")

  useEffect(() => {
    if (!token) {
      setState("invalid")
      return
    }
    fetch(`/api/public/upload-info?token=${token}`)
      .then(async (res) => {
        const data = await res.json()
        if (res.ok) {
          setCustomerName(data.customerName)
          setState("ready")
        } else if (res.status === 410) {
          setState("expired")
        } else {
          setState("invalid")
          setErrorMessage(data.error || "קישור לא תקין")
        }
      })
      .catch(() => {
        setState("invalid")
        setErrorMessage("שגיאה בטעינת הקישור")
      })
  }, [token])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setState("uploading")

    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch(`/api/public/upload-info?token=${token}`, {
        method: "POST",
        body: fd,
      })

      const data = await res.json()

      if (res.ok) {
        setState("success")
      } else {
        setState("error")
        setErrorMessage(data.error || "שגיאה בהעלאה")
      }
    } catch {
      setState("error")
      setErrorMessage("שגיאה בהעלאת הקובץ")
    }
  }

  return (
    <div dir="rtl">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">העלאת קובץ אינפו</CardTitle>
          {state === "ready" && (
            <CardDescription className="text-base">
              שלום {customerName}, העלה את קובץ האינפו של האורגן
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {state === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-muted-foreground">טוען...</p>
            </div>
          )}

          {state === "ready" && (
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-blue-50 transition-colors">
              <Upload className="h-10 w-10 text-gray-400 mb-3" />
              <span className="text-sm text-gray-600 font-medium">לחץ לבחירת קובץ .n27</span>
              <span className="text-xs text-gray-400 mt-1">מקסימום 10MB</span>
              <input
                type="file"
                accept=".n27"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          )}

          {state === "uploading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-sm text-gray-600">מעלה את {fileName}...</p>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium text-green-700">הקובץ הועלה בהצלחה!</p>
              <p className="text-sm text-muted-foreground">תודה רבה, {customerName}.</p>
            </div>
          )}

          {state === "expired" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <p className="text-lg font-medium text-amber-700">הקישור פג תוקף</p>
              <p className="text-sm text-muted-foreground">בקש קישור חדש מ-Motty Beats.</p>
            </div>
          )}

          {state === "invalid" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-lg font-medium text-red-700">קישור לא תקין</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-lg font-medium text-red-700">שגיאה</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <Button
                variant="outline"
                onClick={() => setState("ready")}
                className="mt-2"
              >
                נסה שוב
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
