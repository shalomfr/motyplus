"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Loader2, FolderOpen, CheckCircle2, XCircle, FolderPlus, AlertTriangle } from "lucide-react"

interface FolderStatus {
  setType: string
  setTypeAlias: string
  organs: {
    name: string
    alias: string
    hasFiles: boolean
    fileCount: number
  }[]
}

interface DebugInfo {
  baseFolderFound: boolean
  basePath: string
  failedAt: string | null
  resolvedParts: string[]
  rootFolderChildren?: string[]
  updatesChildren?: string[]
  beatsChildren?: string[]
  versionFolderChildren?: string[]
  setTypes?: Array<{ name: string; alias: string; found: boolean }>
  organCount?: number
  setTypeCount?: number
}

interface StepRhythmsProps {
  updateId: string
  version: string
}

export function StepRhythms({ updateId, version }: StepRhythmsProps) {
  const [folders, setFolders] = useState<FolderStatus[]>([])
  const [debug, setDebug] = useState<DebugInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  const fetchFolders = useCallback(async () => {
    try {
      setError("")
      const res = await fetch(`/api/updates/${updateId}/folders`)
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders || [])
        setDebug(data.debug || null)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `שגיאה ${res.status}`)
      }
    } catch (err) {
      console.error("Error fetching folder status:", err)
      setError("שגיאה בטעינת מצב תיקיות")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [updateId])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchFolders()
  }

  const handleCreateFolders = async () => {
    setCreating(true)
    setError("")
    try {
      const res = await fetch(`/api/updates/${updateId}/folders`, { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        // Refresh after creation
        await fetchFolders()
      } else {
        setError(data.error || "שגיאה ביצירת תיקיות")
      }
    } catch {
      setError("שגיאה ביצירת תיקיות")
    } finally {
      setCreating(false)
    }
  }

  const totalCells = folders.reduce((sum, f) => sum + f.organs.length, 0)
  const filledCells = folders.reduce(
    (sum, f) => sum + f.organs.filter((o) => o.hasFiles).length,
    0
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            מטריצת תיקיות — {version}
          </CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm">
              {filledCells}/{totalCells} מוכנים
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateFolders}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <FolderPlus className="h-4 w-4 ml-1" />
              )}
              צור תיקיות
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <RefreshCw className="h-4 w-4 ml-1" />
              )}
              רענן
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          העלה את קבצי המקצבים ידנית לתיקיות ב-Google Drive ולחץ &quot;רענן&quot; לראות את המצב.
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {debug && !debug.baseFolderFound && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
            <div className="flex items-center gap-2 font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              תיקיית הבסיס לא נמצאה ב-Drive
            </div>
            <div className="text-sm text-amber-700 space-y-1">
              <p>נתיב מבוקש: <code className="bg-amber-100 px-1 rounded">{debug.basePath}</code></p>
              {debug.failedAt && (
                <p>נכשל בחיפוש: <code className="bg-amber-100 px-1 rounded">{debug.failedAt}</code></p>
              )}
              {debug.resolvedParts.length > 0 && (
                <p>נמצאו: {debug.resolvedParts.join(" → ")}</p>
              )}
              {debug.rootFolderChildren && (
                <p>תיקיות בשורש: {debug.rootFolderChildren.join(", ") || "(ריק)"}</p>
              )}
              {debug.updatesChildren && (
                <p>תיקיות ב-updates: {debug.updatesChildren.join(", ") || "(ריק)"}</p>
              )}
              {debug.beatsChildren && (
                <p>תיקיות ב-beats: {debug.beatsChildren.join(", ") || "(ריק)"}</p>
              )}
            </div>
            <Button size="sm" onClick={handleCreateFolders} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <FolderPlus className="h-4 w-4 ml-1" />}
              צור את כל התיקיות עכשיו
            </Button>
          </div>
        )}

        {debug && debug.baseFolderFound && debug.setTypes && (
          <div className="mb-4 text-xs text-muted-foreground">
            {debug.versionFolderChildren && (
              <span>תיקיות ב-{version}: {debug.versionFolderChildren.join(", ")}</span>
            )}
          </div>
        )}

        {folders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>לא נמצאו תיקיות. ודא שהעדכון נוצר כראוי.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {folders.map((setType) => (
              <div key={setType.setType} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 font-medium text-sm border-b flex items-center justify-between">
                  <span>{setType.setType}</span>
                  <Badge variant="secondary" className="text-xs">
                    {setType.organs.filter((o) => o.hasFiles).length}/{setType.organs.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-3">
                  {setType.organs.map((organ) => (
                    <div
                      key={organ.alias}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                        organ.hasFiles
                          ? "bg-green-50 border-green-200 text-green-800"
                          : "bg-red-50 border-red-200 text-red-700"
                      }`}
                    >
                      {organ.hasFiles ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">{organ.name}</span>
                      {organ.hasFiles && organ.fileCount > 0 && (
                        <span className="text-xs text-green-600 mr-auto">
                          ({organ.fileCount})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
