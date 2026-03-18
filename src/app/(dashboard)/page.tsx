"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw, AlertTriangle, UserPlus, UserCog, Users,
  Mail, Tags, LayoutDashboard, Settings, Download, Loader2,
  ClipboardList, CheckCircle2, Upload, FileText, ChevronDown, ChevronUp
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect } from "react"

interface MissingInfoCustomer {
  id: number
  fullName: string
  organName: string
  phone: string
}

export default function HomePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [isDownloading, setIsDownloading] = useState(false)
  const [taskCounts, setTaskCounts] = useState<{ DONE: number; total: number } | null>(null)
  const [missingInfo, setMissingInfo] = useState<MissingInfoCustomer[]>([])
  const [missingInfoExpanded, setMissingInfoExpanded] = useState(false)
  const [uploadingId, setUploadingId] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/tasks?limit=0")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.counts) {
          const total = data.counts.IDEA + data.counts.PLANNING + data.counts.IN_PROGRESS + data.counts.DONE
          setTaskCounts({ DONE: data.counts.DONE, total })
        }
      })
      .catch(() => {})

    // טעינת לקוחות חסרי אינפו
    fetch("/api/customers/missing-info")
      .then((r) => r.ok ? r.json() : { customers: [] })
      .then((data) => setMissingInfo(data.customers || []))
      .catch(() => {})
  }, [])

  const handleUploadInfoFor = (customerId: number) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".n27"
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0]
      if (!file) return
      setUploadingId(customerId)
      try {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch(`/api/customers/${customerId}/upload-info`, {
          method: "POST",
          body: fd,
        })
        if (res.ok) {
          toast({ title: "הקובץ הועלה בהצלחה", variant: "success" as "default" })
          setMissingInfo(prev => prev.filter(c => c.id !== customerId))
        } else {
          const data = await res.json()
          toast({ title: "שגיאה", description: data.error, variant: "destructive" })
        }
      } catch {
        toast({ title: "שגיאה בהעלאה", variant: "destructive" })
      } finally {
        setUploadingId(null)
      }
    }
    input.click()
  }

  const handleDownloadInfoFiles = async () => {
    setIsDownloading(true)
    try {
      const res = await fetch("/api/customers/download-info")
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "שגיאה בהורדה")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "info-files.zip"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("שגיאה בהורדת קבצי האינפו")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-white">
        שלום, {session?.user?.name || "admin"}
      </h2>

      {/* קוביות קיצורי דרך */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "הוספת לקוח חדש", icon: UserPlus, href: "/customers/new", bg: "bg-green-50 border-green-200", color: "text-green-600" },
          { label: "עריכת לקוח", icon: UserCog, href: "/customers", bg: "bg-blue-50 border-blue-200", color: "text-blue-600" },
          { label: "רשימת לקוחות", icon: Users, href: "/customers", bg: "bg-purple-50 border-purple-200", color: "text-purple-600" },
          { label: "שליחת מיילים", icon: Mail, href: "/emails", bg: "bg-pink-50 border-pink-200", color: "text-pink-600" },
          { label: "עדכונים", icon: RefreshCw, href: "/updates", bg: "bg-orange-50 border-orange-200", color: "text-orange-600" },
          { label: "מבצעים", icon: Tags, href: "/promotions", bg: "bg-red-50 border-red-200", color: "text-red-600" },
          { label: "לוח בקרה", icon: LayoutDashboard, href: "/dashboard", bg: "bg-cyan-50 border-cyan-200", color: "text-cyan-600" },
          { label: "משימות", icon: ClipboardList, href: "/tasks", bg: "bg-indigo-50 border-indigo-200", color: "text-indigo-600" },
          { label: "הגדרות", icon: Settings, href: "/settings", bg: "bg-gray-100 border-white/10", color: "text-gray-600" },
        ].map((item) => (
          <Card
            key={item.label}
            className={`${item.bg} cursor-pointer hover:shadow-md transition-shadow`}
            onClick={() => router.push(item.href)}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center">
              <item.icon className={`h-8 w-8 ${item.color}`} />
              <span className="font-medium text-white text-sm">{item.label}</span>
            </CardContent>
          </Card>
        ))}
        {/* כפתור הורדת קבצי אינפו */}
        <Card
          className="bg-teal-50 border-teal-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={handleDownloadInfoFiles}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center">
            {isDownloading ? (
              <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
            ) : (
              <Download className="h-8 w-8 text-teal-600" />
            )}
            <span className="font-medium text-white text-sm">
              {isDownloading ? "מוריד..." : "הורד קבצי אינפו"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* כרטיס משימות */}
      {taskCounts && taskCounts.total > 0 && (
        <Card
          className="bg-indigo-50 border-indigo-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/tasks")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-6 w-6 text-indigo-600" />
              <div>
                <p className="font-bold text-white">התקדמות המערכת</p>
                <p className="text-sm text-muted-foreground">
                  {taskCounts.DONE} מתוך {taskCounts.total} משימות הושלמו ({Math.round((taskCounts.DONE / taskCounts.total) * 100)}%)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${(taskCounts.DONE / taskCounts.total) * 100}%` }}
                />
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* כפתור רשימת עבודה */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-6 w-6 text-blue-600" />
            <div>
              <p className="font-bold text-white">לקוחות צריכים עדכון</p>
              <p className="text-sm text-muted-foreground">עברה שנה מאז הקנייה - הגיע זמן עדכון</p>
            </div>
          </div>
          <Button onClick={() => router.push("/updates")}>
            לרשימת עבודה
          </Button>
        </CardContent>
      </Card>

      {/* התראת לקוחות חסרי אינפו */}
      <Card className={missingInfo.length > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
        <CardContent className="p-4">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setMissingInfoExpanded(!missingInfoExpanded)}
          >
            <h3 className="font-bold text-white flex items-center gap-2">
              {missingInfo.length > 0 ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              לקוחות חסרי אינפו
              {missingInfo.length > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 mr-2">
                  {missingInfo.length}
                </Badge>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {missingInfo.length === 0 && (
                <span className="text-sm text-green-600">לכל הלקוחות יש אינפו</span>
              )}
              {missingInfo.length > 0 && (
                missingInfoExpanded
                  ? <ChevronUp className="h-5 w-5 text-gray-400" />
                  : <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>

          {missingInfoExpanded && missingInfo.length > 0 && (
            <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
              {missingInfo.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between bg-white rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">{customer.id}</span>
                    <span className="font-medium truncate">{customer.fullName}</span>
                    <span className="text-xs text-muted-foreground">{customer.organName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUploadInfoFor(customer.id)
                      }}
                      disabled={uploadingId === customer.id}
                    >
                      {uploadingId === customer.id ? (
                        <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3 ml-1" />
                      )}
                      העלה אינפו
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/customers/${customer.id}`)
                      }}
                    >
                      <FileText className="h-3 w-3 ml-1" />
                      פרטים
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
