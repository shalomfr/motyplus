"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, DollarSign, UserPlus, RefreshCw, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface DashboardStats {
  totalCustomers: number
  totalRevenue: number
  totalLeads: number
  pendingUpdates: number
}

const STAT_CONFIG = [
  {
    key: "totalCustomers" as const,
    label: "לקוחות פעילים",
    icon: Users,
    color: "blue",
    borderColor: "border-r-blue-500",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    key: "totalRevenue" as const,
    label: "הכנסות",
    icon: DollarSign,
    color: "green",
    borderColor: "border-r-green-500",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    format: "currency",
  },
  {
    key: "totalLeads" as const,
    label: "לידים פתוחים",
    icon: UserPlus,
    color: "purple",
    borderColor: "border-r-purple-500",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    key: "pendingUpdates" as const,
    label: "עדכונים ממתינים",
    icon: RefreshCw,
    color: "amber",
    borderColor: "border-r-amber-500",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
]

export function StatsCards() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalRevenue: 0,
    totalLeads: 0,
    pendingUpdates: 0,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-r-4 border-r-gray-200">
            <CardContent className="p-4 sm:p-6 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {STAT_CONFIG.map((config) => {
        const Icon = config.icon
        const value = stats[config.key]
        const displayValue = config.format === "currency"
          ? formatCurrency(value)
          : String(value)

        return (
          <Card key={config.key} className={`border-r-4 ${config.borderColor}`}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.iconBg}`}>
                  <Icon className={`h-5 w-5 ${config.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{config.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{displayValue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
