"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, UserCheck, ShieldOff, TrendingUp, Wallet, AlertCircle, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface DashboardStats {
  totalCustomers: number
  totalRevenue: number
  activeLeadsCount: number
  customersByStatus: {
    ACTIVE: number
    BLOCKED: number
    FROZEN: number
    EXCEPTION: number
  }
}

interface StatCardConfig {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  borderColor: string
  iconBg: string
  iconColor: string
  getValue: (s: DashboardStats) => string
  getSubtext?: (s: DashboardStats) => string
}

const TOP_ROW: StatCardConfig[] = [
  {
    key: "totalCustomers",
    label: "סה\"כ לקוחות",
    icon: Users,
    borderColor: "border-r-blue-500",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    getValue: (s) => String(s.totalCustomers),
    getSubtext: (s) => `${s.customersByStatus.ACTIVE} פעילים`,
  },
  {
    key: "activeCustomers",
    label: "לקוחות פעילים",
    icon: UserCheck,
    borderColor: "border-r-green-500",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    getValue: (s) => String(s.customersByStatus.ACTIVE),
  },
  {
    key: "blockedCustomers",
    label: "לקוחות חסומים",
    icon: ShieldOff,
    borderColor: "border-r-red-500",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    getValue: (s) => String(s.customersByStatus.BLOCKED),
  },
]

const BOTTOM_ROW: StatCardConfig[] = [
  {
    key: "totalRevenue",
    label: "סה\"כ הכנסות",
    icon: TrendingUp,
    borderColor: "border-r-blue-400",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    getValue: (s) => formatCurrency(s.totalRevenue),
  },
  {
    key: "totalPaid",
    label: "סה\"כ שולם",
    icon: Wallet,
    borderColor: "border-r-yellow-500",
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-600",
    getValue: (s) => formatCurrency(s.totalRevenue),
  },
  {
    key: "balance",
    label: "יתרה לגבייה",
    icon: AlertCircle,
    borderColor: "border-r-purple-500",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    getValue: () => formatCurrency(0),
    getSubtext: () => "0 לקוחות עם חוב",
  },
]

function StatCard({ config, stats }: { config: StatCardConfig; stats: DashboardStats }) {
  const Icon = config.icon
  return (
    <Card className={`border-r-4 ${config.borderColor}`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.iconBg}`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div>
            <p className="text-sm text-gray-600">{config.label}</p>
            <p className="text-2xl font-bold text-gray-800">{config.getValue(stats)}</p>
            {config.getSubtext && (
              <p className="text-xs text-muted-foreground">{config.getSubtext(stats)}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatsCards() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalRevenue: 0,
    activeLeadsCount: 0,
    customersByStatus: { ACTIVE: 0, BLOCKED: 0, FROZEN: 0, EXCEPTION: 0 },
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/dashboard/stats")
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error("Error fetching stats:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-r-4 border-r-gray-200">
              <CardContent className="p-4 sm:p-6 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-r-4 border-r-gray-200">
              <CardContent className="p-4 sm:p-6 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* שורה עליונה — לקוחות */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TOP_ROW.map((config) => (
          <StatCard key={config.key} config={config} stats={stats} />
        ))}
      </div>

      {/* שורה תחתונה — כספי */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {BOTTOM_ROW.map((config) => (
          <StatCard key={config.key} config={config} stats={stats} />
        ))}
      </div>
    </div>
  )
}
