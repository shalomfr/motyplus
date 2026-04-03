import { Card, CardContent } from "@/components/ui/card"
import { Users, UserCheck, ShieldOff, TrendingUp, Wallet, AlertCircle, Clock, RefreshCw } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { DashboardStats } from "@/lib/services/dashboard.service"

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
    borderColor: "border-r-orange-500",
    iconBg: "bg-orange-100",
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

const MIDDLE_ROW: StatCardConfig[] = [
  {
    key: "expiredUpdates",
    label: "תפוגת עדכונים",
    icon: Clock,
    borderColor: "border-r-orange-500",
    iconBg: "bg-orange-100",
    iconColor: "text-blue-600",
    getValue: (s) => String(s.expiredUpdatesCount),
    getSubtext: () => "לקוחות שפג תוקף העדכון שלהם",
  },
  {
    key: "notUpdated",
    label: "לא זכאים לעדכון",
    icon: RefreshCw,
    borderColor: "border-r-red-400",
    iconBg: "bg-red-100",
    iconColor: "text-red-500",
    getValue: (s) => String(s.notUpdatedCount),
    getSubtext: () => "סט שלם, לא קיבלו עדכון",
  },
  {
    key: "exception",
    label: "חריגים",
    icon: AlertCircle,
    borderColor: "border-r-amber-500",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    getValue: (s) => String(s.customersByStatus.EXCEPTION),
    getSubtext: () => "מקבלים עדכונים ללא קשר למצב",
  },
]

const BOTTOM_ROW: StatCardConfig[] = [
  {
    key: "totalRevenue",
    label: "סה\"כ הכנסות",
    icon: TrendingUp,
    borderColor: "border-r-orange-400",
    iconBg: "bg-orange-100",
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
    borderColor: "border-r-orange-500",
    iconBg: "bg-orange-100",
    iconColor: "text-blue-600",
    getValue: (s) => formatCurrency(s.totalDebt),
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

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="space-y-4">
      {/* שורה עליונה — לקוחות */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TOP_ROW.map((config) => (
          <StatCard key={config.key} config={config} stats={stats} />
        ))}
      </div>

      {/* שורה אמצעית — עדכונים */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {MIDDLE_ROW.map((config) => (
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
