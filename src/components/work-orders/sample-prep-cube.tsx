"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  Check,
  Copy,
  RefreshCw,
  Loader2,
  Search,
  AlertTriangle,
  Music,
} from "lucide-react"

interface SampleCustomer {
  id: number
  fullName: string
  email: string
  phone: string
  customerId: string | null
  organName: string
  currentUpdateVersion: string | null
  markedDoneAt: string | null
  driveFileExists: boolean
}

interface SamplePrepCubeProps {
  customers: SampleCustomer[]
  activeUpdate: { id: string; version: string } | null
  onRefresh: () => void
}

export function SamplePrepCube({
  customers,
  activeUpdate,
  onRefresh,
}: SamplePrepCubeProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [markingId, setMarkingId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/work-orders/sync-samples", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        toast({
          title: "סנכרון הושלם",
          description: `${data.synced} לקוחות נסרקו, ${data.withCpi} עם דגימות`,
          variant: "success" as "default",
        })
        onRefresh()
      } else {
        toast({ title: "שגיאה בסנכרון", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "שגיאה בסנכרון", variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  const handleMarkDone = useCallback(
    async (customerId: number, done: boolean) => {
      if (!activeUpdate) return
      setMarkingId(customerId)
      try {
        const res = await fetch("/api/work-orders/sample-prep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            updateVersionId: activeUpdate.id,
            done,
          }),
        })
        if (res.ok) {
          toast({
            title: done ? "סומן כמוכן" : "הסימון בוטל",
            variant: "success" as "default",
          })
          onRefresh()
        }
      } catch {
        toast({ title: "שגיאה", variant: "destructive" })
      } finally {
        setMarkingId(null)
      }
    },
    [activeUpdate, onRefresh, toast]
  )

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(label)
    setTimeout(() => setCopiedId(null), 1500)
    toast({ title: `${label} הועתק`, variant: "success" as "default" })
  }

  // Filter: show only those WITHOUT drive file (pending)
  const pending = customers.filter((c) => !c.driveFileExists)
  const filtered = pending.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.fullName.toLowerCase().includes(q) ||
      String(c.id).includes(q) ||
      (c.customerId && c.customerId.includes(q))
    )
  })

  if (!activeUpdate) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Music className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>אין עדכון FULL פעיל כרגע</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              הכנת דגימות לעדכון
              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                {activeUpdate.version}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {pending.length} לקוחות ממתינים מתוך {customers.length} זכאים
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-1.5"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            סנכרון דרייב
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {pending.length > 5 && (
          <div className="relative mb-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי שם או מזהה..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {pending.length === 0 ? (
              <>
                <Check className="h-10 w-10 mx-auto mb-2 text-green-500" />
                <p>כל הדגימות מוכנות!</p>
              </>
            ) : (
              <p>לא נמצאו תוצאות</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filtered.map((c) => {
              const displayId = c.customerId || String(c.id)
              const isMarkedButMissing = c.markedDoneAt && !c.driveFileExists

              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                    isMarkedButMissing
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-white border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isMarkedButMissing && (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                    )}
                    <span className="font-mono text-xs text-gray-400">
                      {displayId}
                    </span>
                    <span className="font-medium truncate">{c.fullName}</span>
                    <span className="text-xs text-gray-400">{c.organName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Copy ID */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => copyToClipboard(displayId, `מזהה ${displayId}`)}
                    >
                      {copiedId === `מזהה ${displayId}` ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span className="mr-1">מזהה</span>
                    </Button>

                    {/* Copy ID + Version */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        copyToClipboard(
                          `${displayId}_${activeUpdate.version}`,
                          `מזהה+גירסה ${displayId}`
                        )
                      }
                    >
                      {copiedId === `מזהה+גירסה ${displayId}` ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span className="mr-1">מזהה+גירסה</span>
                    </Button>

                    {/* Mark done */}
                    <Button
                      variant={c.markedDoneAt ? "default" : "outline"}
                      size="sm"
                      className={`h-7 px-2 text-xs ${
                        c.markedDoneAt
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "text-green-700 border-green-200 hover:bg-green-50"
                      }`}
                      onClick={() => handleMarkDone(c.id, !c.markedDoneAt)}
                      disabled={markingId === c.id}
                    >
                      {markingId === c.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
