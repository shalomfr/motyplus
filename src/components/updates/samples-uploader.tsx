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
import { Upload, Trash2, Loader2, Music, Users, FileText, Send, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"

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

export function SamplesUploader({ updateId, hideSendButton = false }: { updateId: string; hideSendButton?: boolean }) {
  const [files, setFiles] = useState<SampleFile[]>([])
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<{
    sent: number
    skippedNoFile: number
    failed: number
    alreadyReceived: number
  } | null>(null)
  const [sendError, setSendError] = useState("")
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

  const handleSendUpdate = async () => {
    if (!confirm(`לשלוח את העדכון ל-${totalCustomers} לקוחות?`)) return
    setIsSending(true)
    setSendResult(null)
    setSendError("")

    try {
      // First get eligible customer IDs from work-list
      const workRes = await fetch(`/api/updates/${updateId}/work-list`)
      if (!workRes.ok) throw new Error("שגיאה בטעינת רשימת לקוחות")
      const workData = await workRes.json()
      const customerIds = workData.customers.map((c: { id: number }) => c.id)

      if (customerIds.length === 0) {
        setSendError("אין לקוחות זכאים לשליחה")
        setIsSending(false)
        return
      }

      const res = await fetch(`/api/updates/${updateId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "שגיאה בשליחה")

      setSendResult({
        sent: data.sent,
        skippedNoFile: data.skippedNoFile,
        failed: data.failed,
        alreadyReceived: data.alreadyReceived,
      })
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "שגיאה בשליחת העדכון")
    } finally {
      setIsSending(false)
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={isSyncing || isUploading}
              onClick={async () => {
                setIsSyncing(true)
                setLoading(true)
                await fetchFiles()
                setIsSyncing(false)
              }}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <RefreshCw className="h-4 w-4 ml-2" />
              )}
              סנכרן מ-Drive
            </Button>
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
                indicatorClassName="bg-orange-500"
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
                        <span className="text-xs bg-orange-100 text-blue-700 px-2 py-0.5 rounded">
                          אורגן נוסף
                        </span>
                      ) : (
                        <span className="text-xs bg-orange-100 text-blue-700 px-2 py-0.5 rounded">
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

        {/* Send Update Button — only when files exist, not uploading, and not hidden */}
        {files.length > 0 && !isUploading && !hideSendButton && (
          <div className="border-t pt-4 space-y-3">
            <Button
              onClick={handleSendUpdate}
              disabled={isSending}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin ml-2" />
              ) : (
                <Send className="h-5 w-5 ml-2" />
              )}
              {isSending ? "שולח עדכון ללקוחות..." : `שלח עדכון ל-${totalCustomers} לקוחות`}
            </Button>

            {/* Send Result */}
            {sendResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-green-700 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>השליחה הושלמה</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-green-700">נשלחו בהצלחה: <strong>{sendResult.sent}</strong></div>
                  {sendResult.skippedNoFile > 0 && (
                    <div className="text-yellow-700">דולגו (אין קובץ): <strong>{sendResult.skippedNoFile}</strong></div>
                  )}
                  {sendResult.failed > 0 && (
                    <div className="text-red-700">נכשלו: <strong>{sendResult.failed}</strong></div>
                  )}
                  {sendResult.alreadyReceived > 0 && (
                    <div className="text-gray-600">כבר קיבלו: <strong>{sendResult.alreadyReceived}</strong></div>
                  )}
                </div>
              </div>
            )}

            {/* Send Error */}
            {sendError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
