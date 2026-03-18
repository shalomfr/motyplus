"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, RefreshCw, Loader2, Trash2 } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface UpdateVersion {
  id: string
  version: string
  price: number
  status: string
  releaseDate: string | null
  createdAt: string
  _count?: {
    customerUpdates: number
  }
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "טיוטה", className: "bg-gray-100 text-white border-white/10" },
  PREPARING: { label: "בהכנה", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  READY: { label: "מוכן", className: "bg-blue-100 text-blue-800 border-blue-200" },
  SENDING: { label: "בשליחה", className: "bg-orange-100 text-orange-800 border-orange-200" },
  COMPLETED: { label: "הושלם", className: "bg-green-100 text-green-800 border-green-200" },
}

export default function UpdatesPage() {
  const router = useRouter()
  const [updates, setUpdates] = useState<UpdateVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<UpdateVersion | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchUpdates = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/updates")
      if (res.ok) {
        const data = await res.json()
        setUpdates(data.updates || data)
      }
    } catch (err) {
      console.error("Error fetching updates:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/updates/${deleteTarget.id}`, { method: "DELETE" })
      if (res.ok) {
        setDeleteTarget(null)
        fetchUpdates()
      } else {
        const data = await res.json()
        alert(data.error || "שגיאה במחיקת העדכון")
      }
    } catch (err) {
      console.error("Error deleting update:", err)
      alert("שגיאה במחיקת העדכון")
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    fetchUpdates()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">עדכונים</h2>
        <Button onClick={() => router.push("/updates/new")}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף עדכון
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            רשימת גרסאות עדכון
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : updates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              אין עדכונים עדיין. צור עדכון חדש כדי להתחיל.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>גרסה</TableHead>
                  <TableHead>מחיר</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>תאריך שחרור</TableHead>
                  <TableHead>לקוחות</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {updates.map((update) => {
                  const statusConfig = STATUS_CONFIG[update.status] || STATUS_CONFIG.DRAFT
                  return (
                    <TableRow
                      key={update.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/updates/${update.id}`)}
                    >
                      <TableCell className="font-medium">{update.version}</TableCell>
                      <TableCell>{formatCurrency(Number(update.price))}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig.className}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {update.releaseDate ? formatDate(update.releaseDate) : "לא נקבע"}
                      </TableCell>
                      <TableCell>{update._count?.customerUpdates ?? 0}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(update)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>מחיקת עדכון</DialogTitle>
            <DialogDescription>
              האם למחוק את עדכון {deleteTarget?.version}? פעולה זו תמחק את כל הקבצים ורשומות הלקוחות המשויכים ולא ניתנת לביטול.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-start">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              מחק
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
