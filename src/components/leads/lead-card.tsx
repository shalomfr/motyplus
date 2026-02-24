"use client"

import { Badge } from "@/components/ui/badge"
import { Phone, Mail, Calendar } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface LeadCardProps {
  lead: {
    id: string
    fullName: string
    phone: string
    email: string | null
    organInterest: string | null
    source: string | null
    createdAt: string
    assignedAgent?: { name: string } | null
  }
  onClick: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}

const SOURCE_LABELS: Record<string, string> = {
  website: "אתר",
  facebook: "פייסבוק",
  instagram: "אינסטגרם",
  referral: "הפניה",
  phone: "טלפון",
  other: "אחר",
}

export function LeadCard({ lead, onClick, draggable, onDragStart }: LeadCardProps) {
  return (
    <div
      className="bg-white rounded-lg border shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <div className="flex items-start justify-between">
        <h4 className="font-medium text-sm">{lead.fullName}</h4>
        {lead.source && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {SOURCE_LABELS[lead.source] || lead.source}
          </Badge>
        )}
      </div>

      {lead.organInterest && (
        <p className="text-xs text-muted-foreground">{lead.organInterest}</p>
      )}

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Phone className="h-3 w-3" />
          <span dir="ltr">{lead.phone}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3" />
            <span dir="ltr" className="truncate">{lead.email}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(lead.createdAt)}</span>
        </div>
      </div>

      {lead.assignedAgent && (
        <div className="pt-1 border-t">
          <span className="text-[10px] text-muted-foreground">
            סוכן: {lead.assignedAgent.name}
          </span>
        </div>
      )}
    </div>
  )
}
