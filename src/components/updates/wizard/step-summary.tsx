"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  FolderOpen,
  Music,
  Users,
} from "lucide-react"

interface Segment {
  key: string
  label: string
  count: number
  canSend: boolean
  color: string
}

interface StepSummaryProps {
  updateId: string
  version: string
  segments: Segment[]
  cpiStatus: { ready: number; total: number }
  foldersReady: boolean
  alreadySent: number
}

export function StepSummary({
  updateId,
  version,
  segments,
  cpiStatus,
  foldersReady,
  alreadySent,
}: StepSummaryProps) {
  const router = useRouter()
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState("")

  const eligibleSegment = segments.find((s) => s.key === "eligible")
  const eligibleCount = eligibleSegment?.count || 0
  const totalCustomers = segments.reduce((sum, s) => sum + s.count, 0)

  const handleFinish = async () => {
    setFinishing(true)
    setError("")

    try {
      const res = await fetch(`/api/updates/${updateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READY" }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "שגיאה בעדכון הסטטוס")
      }

      router.push(`/updates/${updateId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון הסטטוס")
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-blue-800 mb-2">
            <Info className="h-4 w-4" />
            <span className="font-medium">סיכום הכנת עדכון {version}</span>
          </div>
          {alreadySent > 0 && (
            <p className="text-xs text-blue-600">
              {alreadySent} לקוחות כבר קיבלו את העדכון הזה בעבר.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Readiness Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">בדיקת מוכנות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Folders */}
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className={`p-2 rounded-lg ${foldersReady ? "bg-green-100" : "bg-red-100"}`}>
              <FolderOpen className={`h-4 w-4 ${foldersReady ? "text-green-600" : "text-red-600"}`} />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium">תיקיות מקצבים</span>
              <span className="text-xs text-muted-foreground block">
                {foldersReady ? "כל התיקיות מכילות קבצים" : "יש תיקיות ריקות — חזור לשלב המקצבים"}
              </span>
            </div>
            {foldersReady ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
          </div>

          {/* CPI Files */}
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className={`p-2 rounded-lg ${cpiStatus.ready >= cpiStatus.total ? "bg-green-100" : "bg-yellow-100"}`}>
              <Music className={`h-4 w-4 ${cpiStatus.ready >= cpiStatus.total ? "text-green-600" : "text-yellow-600"}`} />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium">קבצי דגימות CPI</span>
              <span className="text-xs text-muted-foreground block">
                {cpiStatus.ready} מתוך {cpiStatus.total} מוכנים
              </span>
            </div>
            {cpiStatus.ready >= cpiStatus.total ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
          </div>

          {/* Eligible Customers */}
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium">לקוחות זכאים</span>
              <span className="text-xs text-muted-foreground block">
                {eligibleCount} מתוך {totalCustomers} לקוחות
              </span>
            </div>
            <Badge variant="outline">{eligibleCount}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Segments Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">סגמנטים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {segments.map((seg) => (
            <div
              key={seg.key}
              className="flex items-center justify-between p-2 rounded-lg border text-sm"
            >
              <span className="font-medium">{seg.label}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{seg.count} לקוחות</Badge>
                {seg.canSend ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Finish Button */}
      <div className="border-t pt-4">
        <Button
          onClick={handleFinish}
          disabled={finishing}
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
        >
          {finishing ? (
            <Loader2 className="h-5 w-5 animate-spin ml-2" />
          ) : (
            <CheckCircle2 className="h-5 w-5 ml-2" />
          )}
          {finishing ? "מסיים..." : "סיום הכנת העדכון"}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          לאחר סיום ההכנה, ניתן לשלוח את העדכון מדף פרטי העדכון
        </p>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="p-4 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
