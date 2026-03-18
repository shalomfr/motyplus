"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Activity, Loader2, ChevronRight, ChevronLeft } from "lucide-react"
import { formatDateTime } from "@/lib/utils"

interface ActivityLogEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  details: Record<string, unknown> | null
  createdAt: string
  user: { id: string; name: string } | null
  customer: { id: number; fullName: string } | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: "יצירה", color: "bg-green-100 text-green-800 border-green-200" },
  UPDATE: { label: "עדכון", color: "bg-blue-100 text-blue-800 border-blue-200" },
  DELETE: { label: "מחיקה", color: "bg-red-100 text-red-800 border-red-200" },
  SEND_EMAIL: { label: "שליחת מייל", color: "bg-purple-100 text-purple-800 border-purple-200" },
  SEND_UPDATE: { label: "שליחת עדכון", color: "bg-orange-100 text-orange-800 border-orange-200" },
  CONVERT_LEAD: { label: "המרת ליד", color: "bg-teal-100 text-teal-800 border-teal-200" },
  LOGIN: { label: "כניסה", color: "bg-gray-100 text-gray-800 border-gray-200" },
  STATUS_CHANGE: { label: "שינוי סטטוס", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
}

const ENTITY_LABELS: Record<string, string> = {
  CUSTOMER: "לקוח",
  LEAD: "ליד",
  UPDATE: "עדכון",
  EMAIL: "מייל",
  PROMOTION: "מבצע",
  ORGAN: "אורגן",
  SET_TYPE: "סוג סט",
  USER: "משתמש",
  SYSTEM: "מערכת",
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])

  // Filters
  const [filterAction, setFilterAction] = useState<string>("all")
  const [filterUser, setFilterUser] = useState<string>("all")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", "25")
      if (filterAction !== "all") params.set("action", filterAction)
      if (filterUser !== "all") params.set("userId", filterUser)
      if (filterDateFrom) params.set("dateFrom", filterDateFrom)
      if (filterDateTo) params.set("dateTo", filterDateTo)

      const res = await fetch(`/api/activity-log?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || data.activityLogs || [])
        if (data.pagination) {
          setPagination(data.pagination)
        }
      }
    } catch (err) {
      console.error("Error fetching activity logs:", err)
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterUser, filterDateFrom, filterDateTo])

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users")
        if (res.ok) {
          const data = await res.json()
          setUsers(data.users || data)
        }
      } catch (err) {
        console.error("Error fetching users:", err)
      }
    }
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchLogs(1)
  }, [fetchLogs])

  const getDetailsSummary = (entry: ActivityLogEntry): string => {
    if (!entry.details) return ""
    const details = entry.details
    const parts: string[] = []

    if (details.fullName) parts.push(String(details.fullName))
    if (details.version) parts.push(`גרסה ${details.version}`)
    if (details.email) parts.push(String(details.email))
    if (details.stage) parts.push(`שלב: ${details.stage}`)
    if (details.status) parts.push(`סטטוס: ${details.status}`)

    return parts.join(" | ")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-7 w-7 text-gray-600" />
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">יומן פעילות</h2>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 w-40">
              <label className="text-sm text-muted-foreground">סוג פעולה</label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger>
                  <SelectValue placeholder="הכל" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 w-40">
              <label className="text-sm text-muted-foreground">משתמש</label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger>
                  <SelectValue placeholder="הכל" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל המשתמשים</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">מתאריך</label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">עד תאריך</label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {pagination.total > 0 ? `${pagination.total} רשומות` : "יומן פעילות"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              אין רשומות פעילות
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">תאריך ושעה</TableHead>
                    <TableHead className="w-28">משתמש</TableHead>
                    <TableHead className="w-28">פעולה</TableHead>
                    <TableHead className="w-24">ישות</TableHead>
                    <TableHead>פרטים</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((entry) => {
                    const actionConfig = ACTION_LABELS[entry.action] || {
                      label: entry.action,
                      color: "bg-gray-100 text-gray-800 border-gray-200",
                    }
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm font-mono">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.user?.name || "מערכת"}
                        </TableCell>
                        <TableCell>
                          <Badge className={actionConfig.color}>
                            {actionConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {ENTITY_LABELS[entry.entityType] || entry.entityType}
                          <span className="text-muted-foreground text-xs mr-1">
                            #{entry.entityId}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                          {entry.customer && (
                            <span className="font-medium text-foreground ml-2">
                              {entry.customer.fullName}
                            </span>
                          )}
                          {getDetailsSummary(entry)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    עמוד {pagination.page} מתוך {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchLogs(pagination.page - 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                      הקודם
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchLogs(pagination.page + 1)}
                    >
                      הבא
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
