"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LeadForm } from "@/components/leads/lead-form"
import {
  ArrowRight,
  Loader2,
  UserCheck,
  MessageSquare,
  Send,
  DollarSign,
} from "lucide-react"
import { formatDateTime, formatCurrency } from "@/lib/utils"

interface LeadNote {
  id: string
  content: string
  createdAt: string
  user: { name: string }
}

interface LeadDetail {
  id: string
  fullName: string
  phone: string
  email: string | null
  organInterest: string | null
  organId: string | null
  source: string | null
  stage: string
  assignedAgentId: string | null
  createdAt: string
  updatedAt: string
  assignedAgent: { id: string; name: string } | null
  organ: { id: string; name: string } | null
  notes: LeadNote[]
  convertedCustomerId: number | null
}

const STAGE_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  NEW: { label: "ליד חדש", color: "bg-blue-500", step: 1 },
  CONTACTED: { label: "שיחה", color: "bg-yellow-500", step: 2 },
  PROPOSAL: { label: "הצעה", color: "bg-purple-500", step: 3 },
  CLOSED_WON: { label: "נסגר בהצלחה", color: "bg-green-500", step: 4 },
  CLOSED_LOST: { label: "אבד", color: "bg-red-500", step: 0 },
}

const COMMISSION_RATE = 0.1 // 10% commission

export default function LeadDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [addingNote, setAddingNote] = useState(false)
  const [converting, setConverting] = useState(false)
  const [showConvertDialog, setShowConvertDialog] = useState(false)

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${id}`)
      if (res.ok) {
        const data = await res.json()
        setLead(data)
      }
    } catch (err) {
      console.error("Error fetching lead:", err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchLead()
  }, [fetchLead])

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setAddingNote(true)

    try {
      const res = await fetch(`/api/leads/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      })

      if (res.ok) {
        setNewNote("")
        fetchLead()
      }
    } catch (err) {
      console.error("Error adding note:", err)
    } finally {
      setAddingNote(false)
    }
  }

  const handleConvert = async () => {
    setConverting(true)
    try {
      const res = await fetch(`/api/leads/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/customers/${data.customerId}`)
      }
    } catch (err) {
      console.error("Error converting lead:", err)
    } finally {
      setConverting(false)
      setShowConvertDialog(false)
    }
  }

  const handleStageChange = async (newStage: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      })

      if (res.ok) {
        fetchLead()
      }
    } catch (err) {
      console.error("Error updating stage:", err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        ליד לא נמצא
      </div>
    )
  }

  const stageConfig = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.NEW
  const stages = ["NEW", "CONTACTED", "PROPOSAL", "CLOSED_WON"]
  const currentStepIndex = stages.indexOf(lead.stage)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/leads")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
              {lead.fullName}
            </h2>
            <Badge className={`${stageConfig.color} text-white border-0`}>
              {stageConfig.label}
            </Badge>
          </div>
        </div>
        {!lead.convertedCustomerId && lead.stage !== "CLOSED_LOST" && (
          <Button onClick={() => setShowConvertDialog(true)}>
            <UserCheck className="h-4 w-4 ml-2" />
            המר ללקוח
          </Button>
        )}
      </div>

      {/* Stage progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {stages.map((stage, index) => {
              const config = STAGE_CONFIG[stage]
              const isActive = index <= currentStepIndex
              const isCurrent = stage === lead.stage

              return (
                <div key={stage} className="flex-1 flex items-center gap-2">
                  <button
                    onClick={() => handleStageChange(stage)}
                    className={`flex-1 h-10 rounded-md flex items-center justify-center text-sm font-medium transition-colors
                      ${isCurrent
                        ? `${config.color} text-white`
                        : isActive
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                  >
                    {config.label}
                  </button>
                  {index < stages.length - 1 && (
                    <div className="w-4 h-0.5 bg-muted flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
          {lead.stage !== "CLOSED_LOST" && (
            <div className="mt-2 text-left">
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                onClick={() => handleStageChange("CLOSED_LOST")}
              >
                סמן כאבד
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead info */}
        <div className="lg:col-span-2 space-y-4">
          {editing ? (
            <LeadForm
              mode="edit"
              leadId={id}
              initialData={{
                fullName: lead.fullName,
                phone: lead.phone,
                email: lead.email || "",
                organInterest: lead.organInterest || "",
                organId: lead.organId || "",
                source: lead.source || "",
                assignedAgentId: lead.assignedAgentId || "",
              }}
            />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">פרטי ליד</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    עריכה
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">שם: </span>
                    <span className="font-medium">{lead.fullName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">טלפון: </span>
                    <span className="font-medium" dir="ltr">{lead.phone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">מייל: </span>
                    <span className="font-medium" dir="ltr">{lead.email || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">עניין באורגן: </span>
                    <span className="font-medium">{lead.organInterest || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">אורגן: </span>
                    <span className="font-medium">{lead.organ?.name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">מקור: </span>
                    <span className="font-medium">{lead.source || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">סוכן: </span>
                    <span className="font-medium">{lead.assignedAgent?.name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">נוצר: </span>
                    <span className="font-medium">{formatDateTime(lead.createdAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                הערות ({lead.notes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="הוסף הערה..."
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                  className="self-end"
                >
                  {addingNote ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {lead.notes.length > 0 && <Separator />}

              <div className="space-y-3">
                {lead.notes.map((note) => (
                  <div key={note.id} className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{note.user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(note.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>

              {lead.notes.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  אין הערות עדיין
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Commission sidebar */}
        <div className="space-y-4">
          {lead.assignedAgent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  עמלה
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">סוכן: </span>
                  <span className="font-medium">{lead.assignedAgent.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">שיעור עמלה: </span>
                  <span className="font-medium">{COMMISSION_RATE * 100}%</span>
                </div>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  העמלה תחושב אוטומטית לאחר המרה ללקוח בהתאם לסכום הרכישה.
                </p>
              </CardContent>
            </Card>
          )}

          {lead.convertedCustomerId && (
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    הומר ללקוח
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push(`/customers/${lead.convertedCustomerId}`)}
                  >
                    צפה בלקוח #{lead.convertedCustomerId}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Convert dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>המרת ליד ללקוח</DialogTitle>
            <DialogDescription>
              האם להמיר את {lead.fullName} ללקוח במערכת?
              פעולה זו תיצור כרטיס לקוח חדש עם הפרטים הקיימים.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleConvert} disabled={converting}>
              {converting ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <UserCheck className="h-4 w-4 ml-2" />
              )}
              המר ללקוח
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
