"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, BarChart3 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface MonthlyRevenue {
  month: string
  label: string
  revenue: number
}

export function RevenueChart() {
  const [data, setData] = useState<MonthlyRevenue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        const res = await fetch("/api/dashboard/revenue")
        if (res.ok) {
          const result = await res.json()
          setData(result.months || result)
        } else {
          // Generate placeholder data if API not ready
          const months = []
          const monthNames = [
            "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
            "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
          ]
          const now = new Date()
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            months.push({
              month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
              label: monthNames[d.getMonth()],
              revenue: 0,
            })
          }
          setData(months)
        }
      } catch {
        // Generate empty months
        const months = []
        const monthNames = [
          "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
          "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
        ]
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          months.push({
            month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            label: monthNames[d.getMonth()],
            revenue: 0,
          })
        }
        setData(months)
      } finally {
        setLoading(false)
      }
    }
    fetchRevenue()
  }, [])

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          הכנסות חודשיות
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Chart */}
            <div className="flex items-end gap-2 h-48" dir="ltr">
              {data.map((item) => {
                const heightPercent = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center justify-end h-40">
                      {item.revenue > 0 && (
                        <span className="text-[10px] text-muted-foreground mb-1">
                          {formatCurrency(item.revenue)}
                        </span>
                      )}
                      <div
                        className="w-full rounded-t-md bg-primary/80 hover:bg-primary transition-colors min-h-[2px]"
                        style={{ height: `${Math.max(heightPercent, 2)}%` }}
                        title={`${item.label}: ${formatCurrency(item.revenue)}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground text-center whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            <div className="flex justify-between items-center pt-2 border-t text-sm">
              <span className="text-muted-foreground">
                סה"כ תקופה:
              </span>
              <span className="font-bold">
                {formatCurrency(data.reduce((sum, d) => sum + d.revenue, 0))}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
