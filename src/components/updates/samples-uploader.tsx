"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileUploadProgress, type UploadStatus } from "@/components/ui/file-upload-progress"
import { Progress } from "@/components/ui/progress"
import { uploadWithProgress } from "@/lib/upload-with-progress"
import { Upload, Trash2, Loader2, Music, Users, FileText } from "lucide-react"

interface SampleFile {
  path: string
  name: string
  size: number
  customerId: number | null
  isAdditional: boolean
}

interface UploadItem {
  file: File
  progress: number
  status: UploadStatus
  error: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function SamplesUploader({ updateId }: { updateId: string }) {
  const [files, setFiles] = useState<SampleFile[]>([])
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/updates/${updateId}/upload-samples`)
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files)
        setTotalCustomers(data.totalCustomers)
      }
    } catch (err) {
      console.error("Error fetching samples:", err)
    } finally {
      setLoading(false)
    }
  }, [updateId])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    setIsUploading(true)

    // Initialize upload items
    const items: UploadItem[] = selectedFiles.map((f) => ({
      file: f,
      progress: 0,
      status: "uploading" as UploadStatus,
      error: "",
    }))
    setUploads(items)

    // Upload files sequentially
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      try {
        const fd = new FormData()
        fd.append("file", file)

        const res = await uploadWithProgress(
          `/api/updates/${updateId}/upload-samples`,
          fd,
          (percent) => {
            setUploads((prev) =>
              prev.map((u, idx) =>
                idx === i ? { ...u, progress: percent } : u
              )
            )
          }
        )

        if (!res.ok) {
          const err = (res.data as { error?: string }).error || "שגיאה בהעלאה"
          setUploads((prev) =>
            prev.map((u, idx) =>
              idx === i ? { ...u, status: "error", error: err } : u
            )
          )
        } else {
          setUploads((prev) =>
            prev.map((u, idx) =>
              idx === i ? { ...u, status: "success", progress: 100 } : u
            )
          )
        }
      } catch {
        setUploads((prev) =>
          prev.map((u, idx) =>
            idx === i ? { ...u, status: "error", error: "שגיאת רשת" } : u
          )
        )
      }
    }

    setIsUploading(false)
    fetchFiles()

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ""

    // Clear upload items after a delay
    setTimeout(() => setUploads([]), 3000)
  }

  const handleDelete = async (fileName: string) => {
    if (!confirm(`למחוק את הקובץ ${fileName}?`)) return
    setDeletingFile(fileName)
    try {
      await fetch(`/api/updates/${updateId}/upload-samples`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      })
      fetchFiles()
    } catch (err) {
      console.error("Error deleting file:", err)
    } finally {
      setDeletingFile(null)
    }
  }

  const completedCount = uploads.filter((u) => u.status === "success").length
  const totalUploads = uploads.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Music className="h-5 w-5" />
            קבצי דגימות CPI
          </CardTitle>
          <label>
            <Button
              asChild
              disabled={isUploading}
            >
              <span className="cursor-pointer">
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Upload className="h-4 w-4 ml-2" />
                )}
                {isUploading ? "מעלה..." : "בחר קבצי CPI"}
              </span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".cpi"
              multiple
              className="hidden"
              disabled={isUploading}
              onChange={handleFilesSelected}
            />
          </label>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>{files.length} קבצים</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{totalCustomers} לקוחות מכוסים</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Upload Progress */}
        {uploads.length > 0 && (
          <div className="space-y-3">
            {/* Overall progress */}
            <div className="flex items-center gap-3">
              <Progress
                value={totalUploads > 0 ? (completedCount / totalUploads) * 100 : 0}
                className="h-2 flex-1"
                indicatorClassName="bg-blue-500"
              />
              <span className="text-sm font-medium tabular-nums whitespace-nowrap" dir="ltr">
                {completedCount}/{totalUploads}
              </span>
            </div>

            {/* Per-file progress */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {uploads.map((u, i) => (
                <FileUploadProgress
                  key={i}
                  fileName={u.file.name}
                  progress={u.progress}
                  status={u.status}
                  errorMessage={u.error}
                  colorScheme={i % 2 === 0 ? "blue" : "green"}
                />
              ))}
            </div>
          </div>
        )}

        {/* Files table */}
        {files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>טרם הועלו קבצי דגימות</p>
            <p className="text-xs mt-1">
              העלה קבצי CPI ששמותם לפי מזהה הלקוח (למשל: 32.cpi, 32_02.cpi)
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם קובץ</TableHead>
                  <TableHead>מזהה לקוח</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead>גודל</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.path}>
                    <TableCell className="font-mono text-sm" dir="ltr">
                      {f.name}
                    </TableCell>
                    <TableCell>
                      {f.customerId !== null ? (
                        <span className="font-medium">{f.customerId}</span>
                      ) : (
                        <span className="text-muted-foreground">לא מזוהה</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {f.isAdditional ? (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          אורגן נוסף
                        </span>
                      ) : (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          ראשי
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm" dir="ltr">
                      {formatFileSize(f.size)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={deletingFile === f.name}
                        onClick={() => handleDelete(f.name)}
                      >
                        {deletingFile === f.name ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
