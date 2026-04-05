"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LucideIcon } from "lucide-react"

interface TaskCubeProps {
  title: string
  count: number
  icon: LucideIcon
  bgColor: string     // e.g. "bg-purple-100"
  textColor: string   // e.g. "text-purple-700"
  active: boolean
  onClick: () => void
  subtitle?: string
}

export function TaskCube({
  title,
  count,
  icon: Icon,
  bgColor,
  textColor,
  active,
  onClick,
  subtitle,
}: TaskCubeProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        active ? "ring-2 ring-primary shadow-md" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`p-2.5 rounded-xl ${bgColor}`}>
          <Icon className={`h-5 w-5 ${textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <Badge
          variant="outline"
          className={`text-lg font-bold px-3 py-1 ${
            count > 0
              ? `${bgColor} ${textColor} border-current/20`
              : "bg-green-50 text-green-600 border-green-200"
          }`}
        >
          {count}
        </Badge>
      </CardContent>
    </Card>
  )
}
