"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Upload, Loader2, CheckCircle, AlertTriangle, FileArchive } from "lucide-react"

interface MatchedFile {
  setType: string
  organ: string
  fileSize: number
  originalPath: string
}

interface UploadResult {
  message: string
  matched: MatchedFile[]
  unmatchedFolders: string[]
  totalFiles: number
}

interface ZipUploadDialogProps {
  updateId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function ZipUploadDialog({
  updateId,
  open,
  onOpenChange,
  onUploadComplete,
}: ZipUploadDialogProps) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const res = await fetch(`/api/updates/${updateId}/upload-zip`, {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "שגיאה בהעלאה")
        return
      }

      setResult(data)
      onUploadComplete()
    } catch {
      setError("שגיאה בהעלאת הקובץ")
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setSelectedFile(null)
      setResult(null)
      setError(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            העלאת ZIP ראשי
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File selection */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleFileSelect}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileArchive className="h-8 w-8 text-blue-500" />
                <div className="text-right">
                  <p className="font-medium" dir="ltr">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">לחץ לבחירת קובץ ZIP</p>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            מבנה ZIP נדרש: תיקיית סוג סט → תיקיית אורגן → קבצים.
            המערכת תזהה אוטומטית את התיקיות לפי כינוי התיקייה (folderAlias) שהוגדר בניהול הנתונים.
          </p>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {result.message}
              </div>

              {result.matched.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">שילובים שנוצרו:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.matched.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                        <span>{m.setType} × {m.organ}</span>
                        <Badge variant="outline" className="text-xs">
                          {formatFileSize(m.fileSize)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.unmatchedFolders.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-orange-600 mb-2">
                    <AlertTriangle className="h-3 w-3 inline ml-1" />
                    תיקיות שלא זוהו:
                  </p>
                  <div className="text-xs text-orange-600 space-y-1">
                    {result.unmatchedFolders.map((f, i) => (
                      <div key={i} className="bg-orange-50 p-2 rounded" dir="ltr">{f}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            {result ? "סגור" : "ביטול"}
          </Button>
          {!result && (
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  מעבד...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 ml-2" />
                  העלה ועבד
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
