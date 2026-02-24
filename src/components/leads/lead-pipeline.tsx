"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LeadCard } from "./lead-card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Lead {
  id: string
  fullName: string
  phone: string
  email: string | null
  organInterest: string | null
  source: string | null
  stage: string
  createdAt: string
  assignedAgent?: { name: string } | null
}

interface LeadPipelineProps {
  leads: Lead[]
  onStageChange: (leadId: string, newStage: string) => void
}

const STAGES = [
  { key: "NEW", label: "ליד חדש", color: "bg-blue-50 border-blue-200", headerColor: "bg-blue-500" },
  { key: "CONTACTED", label: "שיחה", color: "bg-yellow-50 border-yellow-200", headerColor: "bg-yellow-500" },
  { key: "PROPOSAL", label: "הצעה", color: "bg-purple-50 border-purple-200", headerColor: "bg-purple-500" },
  { key: "CLOSED_WON", label: "סגירה", color: "bg-green-50 border-green-200", headerColor: "bg-green-500" },
]

export function LeadPipeline({ leads, onStageChange }: LeadPipelineProps) {
  const router = useRouter()
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId)
    e.dataTransfer.setData("text/plain", leadId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverStage(stage)
  }

  const handleDragLeave = () => {
    setDragOverStage(null)
  }

  const handleDrop = (e: React.DragEvent, newStage: string) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData("text/plain")
    if (leadId && draggedLeadId) {
      onStageChange(leadId, newStage)
    }
    setDraggedLeadId(null)
    setDragOverStage(null)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" dir="rtl">
      {STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.stage === stage.key)
        const isDragOver = dragOverStage === stage.key

        return (
          <div
            key={stage.key}
            className={cn(
              "flex-shrink-0 w-72 rounded-lg border-2 transition-colors",
              stage.color,
              isDragOver && "ring-2 ring-primary ring-offset-2"
            )}
            onDragOver={(e) => handleDragOver(e, stage.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.key)}
          >
            {/* Column header */}
            <div className={cn("rounded-t-md px-3 py-2 flex items-center justify-between", stage.headerColor)}>
              <span className="text-white font-medium text-sm">{stage.label}</span>
              <Badge className="bg-white/20 text-white border-0 text-xs">
                {stageLeads.length}
              </Badge>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
              {stageLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                />
              ))}
              {stageLeads.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  אין לידים בשלב זה
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
