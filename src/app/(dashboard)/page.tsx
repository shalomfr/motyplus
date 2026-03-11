"use client"

import { useRouter } from "next/navigation"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  RefreshCw, AlertTriangle, UserPlus, UserCog, Users,
  Mail, Tags, LayoutDashboard, Settings, Download, Loader2
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useState } from "react"

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isDownloading, setIsDownloading] = useState(false)

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
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
        שלום, {session?.user?.name || "admin"}
      </h2>
      <h3 className="text-xl font-bold text-gray-700 -mt-4">לוח בקרה</h3>

      {/* קוביות קיצורי דרך */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { label: "הוספת לקוח חדש", icon: UserPlus, href: "/customers/new", bg: "bg-green-50 border-green-200", color: "text-green-600" },
          { label: "עריכת לקוח", icon: UserCog, href: "/customers", bg: "bg-blue-50 border-blue-200", color: "text-blue-600" },
          { label: "רשימת לקוחות", icon: Users, href: "/customers", bg: "bg-purple-50 border-purple-200", color: "text-purple-600" },
          { label: "שליחת מיילים", icon: Mail, href: "/emails", bg: "bg-pink-50 border-pink-200", color: "text-pink-600" },
          { label: "עדכונים", icon: RefreshCw, href: "/updates", bg: "bg-orange-50 border-orange-200", color: "text-orange-600" },
          { label: "מבצעים", icon: Tags, href: "/promotions", bg: "bg-red-50 border-red-200", color: "text-red-600" },
          { label: "לוח בקרה", icon: LayoutDashboard, href: "/", bg: "bg-indigo-50 border-indigo-200", color: "text-indigo-600" },
          { label: "הגדרות", icon: Settings, href: "/settings", bg: "bg-gray-100 border-gray-200", color: "text-gray-600" },
        ].map((item) => (
          <Card
            key={item.label}
            className={`${item.bg} cursor-pointer hover:shadow-md transition-shadow`}
            onClick={() => router.push(item.href)}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center">
              <item.icon className={`h-8 w-8 ${item.color}`} />
              <span className="font-medium text-gray-800 text-sm">{item.label}</span>
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
            <span className="font-medium text-gray-800 text-sm">
              {isDownloading ? "מוריד..." : "הורד קבצי אינפו"}
            </span>
          </CardContent>
        </Card>
      </div>

      <StatsCards />

      {/* כפתור רשימת עבודה */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-6 w-6 text-blue-600" />
            <div>
              <p className="font-bold text-gray-800">לקוחות צריכים עדכון</p>
              <p className="text-sm text-muted-foreground">עברה שנה מאז הקנייה - הגיע זמן עדכון</p>
            </div>
          </div>
          <Button onClick={() => router.push("/updates")}>
            לרשימת עבודה
          </Button>
        </CardContent>
      </Card>

      {/* התראות */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            התראות חוסרים
          </h3>
          <p className="text-sm text-muted-foreground">
            הנתונים ייטענו ממסד הנתונים כשיהיו לקוחות במערכת
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart />
        <RecentActivity />
      </div>
    </div>
  )
}
