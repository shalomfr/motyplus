"use client"

import { useRouter } from "next/navigation"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertTriangle } from "lucide-react"
import { useSession } from "next-auth/react"

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()

  return (
    <div className="space-y-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
        שלום, {session?.user?.name || "admin"}
      </h2>
      <h3 className="text-xl font-bold text-gray-700 -mt-4">לוח בקרה</h3>

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
