"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Loader2, User, Mail, RefreshCw, UserPlus, Edit } from "lucide-react"
import { formatDateTime } from "@/lib/utils"

interface ActivityEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  details: Record<string, unknown> | null
  createdAt: string
  user: { name: string } | null
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  CREATE: UserPlus,
  UPDATE: Edit,
  SEND_EMAIL: Mail,
  SEND_UPDATE: RefreshCw,
  CONVERT_LEAD: User,
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "יצירה",
  UPDATE: "עדכון",
  DELETE: "מחיקה",
  SEND_EMAIL: "שליחת מייל",
  SEND_UPDATE: "שליחת עדכון",
  CONVERT_LEAD: "המרת ליד",
  LOGIN: "כניסה",
  STATUS_CHANGE: "שינוי סטטוס",
}

const ENTITY_LABELS: Record<string, string> = {
  CUSTOMER: "לקוח",
  LEAD: "ליד",
  UPDATE: "עדכון",
  EMAIL: "מייל",
  PROMOTION: "מבצע",
}

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch("/api/activity-log?limit=10")
        if (res.ok) {
          const data = await res.json()
          setActivities(data.logs || data.activityLogs || data || [])
        }
      } catch (err) {
        console.error("Error fetching activities:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchActivities()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          פעילות אחרונה
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            אין פעילות אחרונה
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((entry) => {
              const IconComponent = ACTION_ICONS[entry.action] || Activity
              const actionLabel = ACTION_LABELS[entry.action] || entry.action
              const entityLabel = ENTITY_LABELS[entry.entityType] || entry.entityType
              const detailName = entry.details?.fullName || entry.details?.version || entry.details?.name || ""

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="p-1.5 bg-muted rounded-md mt-0.5">
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{entry.user?.name || "מערכת"}</span>
                      {" - "}
                      <span>{actionLabel}</span>
                      {" "}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {entityLabel}
                      </Badge>
                      {detailName && (
                        <span className="text-muted-foreground mr-1">
                          {" "}{String(detailName)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
