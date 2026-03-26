"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Loader2, FolderOpen, CheckCircle2, XCircle, FolderPlus, AlertTriangle, ChevronDown, FileText } from "lucide-react"

interface FolderStatus {
  organ: string
  organAlias: string
  packageTypes: {
    name: string
    alias: string
    hasFiles: boolean
    fileCount: number
    fileNames?: string[]
  }[]
}

interface DebugInfo {
  baseFolderFound: boolean
  basePath: string
  updateType?: string
  organCount?: number
  packageTypeCount?: number
  beatsChildren?: string[]
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
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null)

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

  const totalCells = folders.reduce((sum, f) => sum + f.packageTypes.length, 0)
  const filledCells = folders.reduce(
    (sum, f) => sum + f.packageTypes.filter((p) => p.hasFiles).length,
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

        {debug && debug.baseFolderFound && (
          <div className="mb-4 text-xs text-muted-foreground">
            <span>סוג עדכון: {debug.updateType === "PARTIAL" ? "חלקי (מקצבים בלבד)" : "מלא (מקצבים + דגימות)"}</span>
          </div>
        )}

        {folders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>לא נמצאו תיקיות. ודא שהעדכון נוצר כראוי.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {folders.map((organEntry) => (
              <div key={organEntry.organAlias} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 font-medium text-sm border-b flex items-center justify-between">
                  <span>{organEntry.organ} ({organEntry.organAlias})</span>
                  <Badge variant="secondary" className="text-xs">
                    {organEntry.packageTypes.filter((p) => p.hasFiles).length}/{organEntry.packageTypes.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-3">
                  {organEntry.packageTypes.map((pkg) => {
                    const folderKey = `${organEntry.organAlias}/${pkg.alias}`
                    const isExpanded = expandedFolder === folderKey
                    return (
                      <div key={pkg.alias}>
                        <button
                          onClick={() => setExpandedFolder(isExpanded ? null : folderKey)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                            pkg.hasFiles
                              ? "bg-green-50 border-green-200 text-green-800 hover:bg-green-100"
                              : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                          }`}
                        >
                          {pkg.hasFiles ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0" />
                          )}
                          <span className="truncate">{pkg.alias}</span>
                          {pkg.hasFiles && pkg.fileCount > 0 && (
                            <span className="text-xs text-green-600 mr-auto">
                              ({pkg.fileCount})
                            </span>
                          )}
                          {pkg.hasFiles && <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />}
                        </button>
                        {isExpanded && pkg.fileNames && pkg.fileNames.length > 0 && (
                          <div className="mt-1 p-2 bg-white border rounded-lg text-xs space-y-1 max-h-40 overflow-y-auto">
                            {pkg.fileNames.map((name, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-gray-600">
                                <FileText className="h-3 w-3 shrink-0 text-gray-400" />
                                <span className="truncate" dir="ltr">{name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
