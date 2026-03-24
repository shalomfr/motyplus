import Link from "next/link"
import { Button } from "@/components/ui/button"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { ArrowRight } from "lucide-react"
import { getDashboardStats, getMonthlyRevenue } from "@/lib/services/dashboard.service"

export default async function DashboardPage() {
  const [stats, months] = await Promise.all([
    getDashboardStats(),
    getMonthlyRevenue(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">לוח בקרה</h2>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={months} />
        <RecentActivity activities={stats.recentActivity} />
      </div>
    </div>
  )
}
