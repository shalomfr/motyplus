"use client"

import React from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils"
import { Phone, Mail, ExternalLink } from "lucide-react"

interface CustomerCardProps {
  id: number
  fullName: string
  phone: string
  email: string
  organName: string
  setTypeName: string
  status: "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION"
  purchaseDate: string
  showActions?: boolean
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "פעיל",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  BLOCKED: {
    label: "חסום",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  FROZEN: {
    label: "מוקפא",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  EXCEPTION: {
    label: "חריג",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
}

export function CustomerCard({
  id,
  fullName,
  phone,
  email,
  organName,
  setTypeName,
  status,
  purchaseDate,
  showActions = true,
}: CustomerCardProps) {
  const statusInfo = statusConfig[status] || statusConfig.ACTIVE

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{fullName}</h3>
              <Badge
                variant="outline"
                className={cn("text-xs", statusInfo.className)}
              >
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              מזהה: {id} | {organName} | {setTypeName}
            </p>
          </div>
          {showActions && (
            <Link href={`/customers/${id}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4 ml-1" />
                צפייה
              </Button>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" />
            <span dir="ltr">{phone}</span>
          </div>
          <div className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            <span dir="ltr">{email}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          נרכש: {formatDate(purchaseDate)}
        </p>
      </CardContent>
    </Card>
  )
}
