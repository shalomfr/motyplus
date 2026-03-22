"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { List, Plus, Send, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface UpdateVersion {
  id: string
  version: string
  status: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "טיוטה", className: "bg-gray-100 text-gray-800 border-gray-200" },
  PREPARING: { label: "בהכנה", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  READY: { label: "מוכן", className: "bg-orange-100 text-blue-800 border-blue-200" },
  SENDING: { label: "בשליחה", className: "bg-orange-100 text-blue-800 border-blue-200" },
  COMPLETED: { label: "הושלם", className: "bg-green-100 text-green-800 border-green-200" },
}

export default function UpdatesPage() {
  const router = useRouter()
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [updates, setUpdates] = useState<UpdateVersion[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(false)

  const fetchUpdates = async () => {
    setLoadingUpdates(true)
    try {
      const res = await fetch("/api/updates")
      if (res.ok) {
        const data = await res.json()
        setUpdates(data.updates || data)
      }
    } catch (err) {
      console.error("Error fetching updates:", err)
    } finally {
      setLoadingUpdates(false)
    }
  }

  const handleSendClick = () => {
    setShowSendDialog(true)
    fetchUpdates()
  }

  const handleSelectUpdate = (id: string) => {
    setShowSendDialog(false)
    router.push(`/updates/${id}/work`)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">עדכונים</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* רשימת עדכונים */}
        <button
          onClick={() => router.push("/updates/list")}
          className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-400 hover:shadow-lg transition-all text-center"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 group-hover:bg-gray-200 transition-colors">
            <List className="h-8 w-8 text-gray-600" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-800">רשימת עדכונים</div>
            <div className="text-sm text-muted-foreground mt-1">צפה בכל העדכונים שנוצרו</div>
          </div>
        </button>

        {/* צור עדכון חדש */}
        <button
          onClick={() => router.push("/updates/wizard")}
          className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-blue-200 bg-white hover:border-orange-400 hover:shadow-lg transition-all text-center"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 group-hover:bg-blue-200 transition-colors">
            <Plus className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <div className="text-lg font-semibold text-blue-800">צור עדכון חדש</div>
            <div className="text-sm text-muted-foreground mt-1">אשף יצירת עדכון חדש</div>
          </div>
        </button>

        {/* שלח עדכון ללקוח */}
        <button
          onClick={handleSendClick}
          className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-green-200 bg-white hover:border-green-400 hover:shadow-lg transition-all text-center"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 group-hover:bg-green-200 transition-colors">
            <Send className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <div className="text-lg font-semibold text-green-800">שלח עדכון ללקוח</div>
            <div className="text-sm text-muted-foreground mt-1">בחר עדכון ושלח ללקוח ספציפי</div>
          </div>
        </button>
      </div>

      {/* Dialog לבחירת עדכון לשליחה */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>בחר עדכון לשליחה</DialogTitle>
          </DialogHeader>
          {loadingUpdates ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : updates.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              אין עדכונים. צור עדכון חדש קודם.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {updates.map((update) => {
                const statusConfig = STATUS_CONFIG[update.status] || STATUS_CONFIG.DRAFT
                return (
                  <button
                    key={update.id}
                    onClick={() => handleSelectUpdate(update.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 hover:border-gray-300 transition-colors text-right"
                  >
                    <span className="font-medium">{update.version}</span>
                    <Badge className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                  </button>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
