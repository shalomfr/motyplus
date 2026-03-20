"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react"

interface Segment {
  key: string
  label: string
  count: number
  canSend: boolean
  color: string
  templateName: string | null
}

interface SendResults {
  [key: string]: {
    sent: number
    failed: number
    skippedNoFile?: number
  }
}

interface StepSendProps {
  updateId: string
  version: string
  segments: Segment[]
  alreadySent: number
}

export function StepSend({ updateId, version, segments, alreadySent }: StepSendProps) {
  const sendableSegments = segments.filter((s) => s.canSend && s.count > 0)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(sendableSegments.length > 0 ? ["eligible"] : [])
  )
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<SendResults | null>(null)
  const [error, setError] = useState("")

  const toggleSegment = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalSelected = sendableSegments
    .filter((s) => selected.has(s.key))
    .reduce((sum, s) => sum + s.count, 0)

  const handleSend = async () => {
    if (selected.size === 0) return
    if (!confirm(`לשלוח מיילים ל-${totalSelected} לקוחות? פעולה זו לא ניתנת לביטול.`)) return

    setSending(true)
    setError("")
    setResults(null)

    try {
      const res = await fetch(`/api/updates/${updateId}/wizard/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: [...selected] }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "שגיאה בשליחה")

      setResults(data.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחה")
    } finally {
      setSending(false)
    }
  }

  const totalSent = results
    ? Object.values(results).reduce((sum, r) => sum + r.sent, 0)
    : 0
  const totalFailed = results
    ? Object.values(results).reduce((sum, r) => sum + r.failed, 0)
    : 0

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-blue-800 mb-2">
            <Info className="h-4 w-4" />
            <span className="font-medium">סיכום עדכון {version}</span>
          </div>
          {alreadySent > 0 && (
            <p className="text-xs text-blue-600">
              {alreadySent} לקוחות כבר קיבלו את העדכון הזה בעבר.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Segment Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">בחר סגמנטים לשליחה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sendableSegments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              אין סגמנטים זמינים לשליחה.
            </p>
          ) : (
            sendableSegments.map((seg) => (
              <label
                key={seg.key}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selected.has(seg.key)}
                  onCheckedChange={() => toggleSegment(seg.key)}
                  disabled={sending}
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">{seg.label}</span>
                  {seg.templateName && (
                    <span className="text-xs text-muted-foreground block">
                      תבנית: {seg.templateName}
                    </span>
                  )}
                </div>
                <Badge variant="outline">{seg.count} לקוחות</Badge>
              </label>
            ))
          )}

          {sendableSegments.length > 0 && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">סה&quot;כ לשליחה:</span>
                <span className="font-bold text-lg">{totalSelected} לקוחות</span>
              </div>

              <Button
                onClick={handleSend}
                disabled={sending || selected.size === 0}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin ml-2" />
                ) : (
                  <Send className="h-5 w-5 ml-2" />
                )}
                {sending ? "שולח מיילים..." : `שלח ל-${totalSelected} לקוחות`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sending Progress */}
      {sending && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium">שולח מיילים...</span>
            </div>
            <Progress value={50} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              התהליך עשוי להימשך מספר דקות. אנא המתן.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card className="border-green-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              <span>השליחה הושלמה</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{totalSent}</div>
                <div className="text-green-600 text-xs">נשלחו בהצלחה</div>
              </div>
              {totalFailed > 0 && (
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">{totalFailed}</div>
                  <div className="text-red-600 text-xs">נכשלו</div>
                </div>
              )}
            </div>

            {Object.entries(results).map(([key, r]) => (
              <div key={key} className="text-xs text-muted-foreground">
                {key}: {r.sent} נשלחו
                {r.failed > 0 && `, ${r.failed} נכשלו`}
                {r.skippedNoFile && r.skippedNoFile > 0 && `, ${r.skippedNoFile} דולגו (חסר CPI)`}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
