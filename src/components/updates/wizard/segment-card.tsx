"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Users, CheckCircle2, XCircle, AlertTriangle, Clock, Ban } from "lucide-react"
import { cn } from "@/lib/utils"

interface SegmentCardProps {
  segmentKey: string
  label: string
  count: number
  templateName: string | null
  canSend: boolean
  color: string
  onPreview: () => void
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; icon: string; badge: string }> = {
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
    icon: "text-green-600",
    badge: "bg-green-100 text-green-700",
  },
  yellow: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
    icon: "text-yellow-600",
    badge: "bg-yellow-100 text-yellow-700",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-800",
    icon: "text-orange-600",
    badge: "bg-orange-100 text-orange-700",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    icon: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: "text-red-600",
    badge: "bg-red-100 text-red-700",
  },
  gray: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-600",
    icon: "text-gray-400",
    badge: "bg-gray-100 text-gray-600",
  },
}

const ICON_MAP: Record<string, typeof CheckCircle2> = {
  eligible: CheckCircle2,
  missing_cpi: AlertTriangle,
  not_updated: Clock,
  half_set: Users,
  expired: XCircle,
  excluded: Ban,
}

export function SegmentCard({
  segmentKey,
  label,
  count,
  templateName,
  canSend,
  color,
  onPreview,
}: SegmentCardProps) {
  const colors = COLOR_MAP[color] || COLOR_MAP.gray
  const Icon = ICON_MAP[segmentKey] || Users

  return (
    <Card className={cn("border", colors.border, colors.bg)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", colors.icon)} />
            <span className={cn("font-medium text-sm", colors.text)}>{label}</span>
          </div>
          <Badge className={cn("text-xs", colors.badge)} variant="secondary">
            {count}
          </Badge>
        </div>

        {templateName && (
          <p className="text-xs text-muted-foreground truncate">
            תבנית: {templateName}
          </p>
        )}

        {!canSend && count > 0 && (
          <p className="text-xs text-muted-foreground">
            {segmentKey === "missing_cpi" ? "לא ישלח — חסר קובץ CPI" : "לא ישלח מייל"}
          </p>
        )}

        {canSend && templateName && count > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1"
            onClick={onPreview}
          >
            <Eye className="h-3.5 w-3.5 ml-1" />
            הצג מייל
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
