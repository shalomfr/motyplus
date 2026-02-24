"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Upload, Loader2, Trash2, FileArchive, CheckCircle, XCircle } from "lucide-react"
import { ZipUploadDialog } from "./zip-upload-dialog"

interface UpdateFileData {
  id: string
  setTypeId: string
  organId: string
  fileUrl: string
  fileSize: number | null
  originalPath: string | null
  setType: { id: string; name: string; folderAlias: string | null }
  organ: { id: string; name: string; folderAlias: string | null }
}

interface SetTypeInfo {
  id: string
  name: string
  folderAlias: string | null
}

interface OrganInfo {
  id: string
  name: string
  folderAlias: string | null
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function UpdateFilesMatrix({ updateId }: { updateId: string }) {
  const [files, setFiles] = useState<UpdateFileData[]>([])
  const [setTypes, setSetTypes] = useState<SetTypeInfo[]>([])
  const [organs, setOrgans] = useState<OrganInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showZipDialog, setShowZipDialog] = useState(false)
  const [uploadingSingle, setUploadingSingle] = useState<string | null>(null)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{ setTypeId: string; organId: string } | null>(null)

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/updates/${updateId}/files`)
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files)
        setSetTypes(data.setTypes)
        setOrgans(data.organs)
      }
    } catch (err) {
      console.error("Error fetching files:", err)
    } finally {
      setLoading(false)
    }
  }, [updateId])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // Build a lookup map: "setTypeId_organId" → file
  const fileMap = new Map<string, UpdateFileData>()
  for (const f of files) {
    fileMap.set(`${f.setTypeId}_${f.organId}`, f)
  }

  const handleSingleUploadClick = (setTypeId: string, organId: string) => {
    setPendingUpload({ setTypeId, organId })
    fileInputRef.current?.click()
  }

  const handleSingleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingUpload) return

    const key = `${pendingUpload.setTypeId}_${pendingUpload.organId}`
    setUploadingSingle(key)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("setTypeId", pendingUpload.setTypeId)
      formData.append("organId", pendingUpload.organId)

      const res = await fetch(`/api/updates/${updateId}/files/upload-single`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        fetchFiles()
      }
    } catch (err) {
      console.error("Error uploading single file:", err)
    } finally {
      setUploadingSingle(null)
      setPendingUpload(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!confirm("האם למחוק את הקובץ?")) return
    setDeletingFile(fileId)
    try {
      await fetch(`/api/updates/${updateId}/files/${fileId}`, {
        method: "DELETE",
      })
      fetchFiles()
    } catch (err) {
      console.error("Error deleting file:", err)
    } finally {
      setDeletingFile(null)
    }
  }

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
            <FileArchive className="h-5 w-5" />
            קבצי עדכון — מטריצת סט × אורגן
          </CardTitle>
          <Button onClick={() => setShowZipDialog(true)}>
            <Upload className="h-4 w-4 ml-2" />
            העלה ZIP ראשי
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {files.length} קבצים מתוך {setTypes.length * organs.length} שילובים אפשריים
        </p>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleSingleFileSelect}
        />

        <div className="overflow-x-auto">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky right-0 bg-white z-10">סוג סט</TableHead>
                  {organs.map((organ) => (
                    <TableHead key={organ.id} className="text-center min-w-[100px]">
                      <div>{organ.name}</div>
                      {organ.folderAlias && (
                        <div className="text-xs font-normal text-muted-foreground" dir="ltr">
                          {organ.folderAlias}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {setTypes.map((setType) => (
                  <TableRow key={setType.id}>
                    <TableCell className="sticky right-0 bg-white z-10 font-medium">
                      <div>{setType.name}</div>
                      {setType.folderAlias && (
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {setType.folderAlias}
                        </div>
                      )}
                    </TableCell>
                    {organs.map((organ) => {
                      const key = `${setType.id}_${organ.id}`
                      const file = fileMap.get(key)
                      const isUploading = uploadingSingle === key
                      const isDeleting = file && deletingFile === file.id

                      return (
                        <TableCell key={organ.id} className="text-center">
                          {isUploading || isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                          ) : file ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-center gap-1">
                                  <Badge className="bg-green-100 text-green-800 border-green-200 cursor-pointer">
                                    <CheckCircle className="h-3 w-3 ml-1" />
                                    {formatFileSize(file.fileSize)}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleDelete(file.id)}
                                  >
                                    <Trash2 className="h-3 w-3 text-red-400" />
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent dir="ltr">
                                {file.originalPath || "uploaded file"}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-blue-500"
                                  onClick={() => handleSingleUploadClick(setType.id, organ.id)}
                                >
                                  <XCircle className="h-4 w-4 text-gray-300" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>לחץ להעלאה ידנית</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      </CardContent>

      <ZipUploadDialog
        updateId={updateId}
        open={showZipDialog}
        onOpenChange={setShowZipDialog}
        onUploadComplete={fetchFiles}
      />
    </Card>
  )
}
