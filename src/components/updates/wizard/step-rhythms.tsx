"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Loader2, FolderOpen, CheckCircle2, XCircle, ExternalLink } from "lucide-react"

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

interface StepRhythmsProps {
  updateId: string
  version: string
}

export function StepRhythms({ updateId, version }: StepRhythmsProps) {
  const [folders, setFolders] = useState<FolderStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch(`/api/updates/${updateId}/folders`)
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders || [])
      }
    } catch (err) {
      console.error("Error fetching folder status:", err)
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
