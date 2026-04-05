import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { MonthlyRevenue } from "@/lib/services/dashboard.service"

interface RevenueChartProps {
  data: MonthlyRevenue[];
}

export function RevenueChart({ data }: RevenueChartProps) {
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
          <div className="space-y-4">
            {/* Chart */}
            <div className="flex items-end gap-1 sm:gap-2 h-36 sm:h-48" dir="ltr">
              {data.map((item) => {
                const heightPercent = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center justify-end h-28 sm:h-40">
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
            <div className="flex justify-between items-center pt-2 border-t text-xs sm:text-sm">
              <span className="text-muted-foreground">
                סה"כ תקופה:
              </span>
              <span className="font-bold">
                {formatCurrency(data.reduce((sum, d) => sum + d.revenue, 0))}
              </span>
            </div>
          </div>
      </CardContent>
    </Card>
  )
}
