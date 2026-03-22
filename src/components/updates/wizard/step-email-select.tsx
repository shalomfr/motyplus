"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: string | null
  isActive: boolean
}

interface StepEmailSelectProps {
  updateId: string
  currentSubject: string | null
  onTemplateApplied: () => void
}

export function StepEmailSelect({
  updateId,
  currentSubject,
  onTemplateApplied,
}: StepEmailSelectProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [appliedId, setAppliedId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/emails/templates")
        if (res.ok) {
          const data = await res.json()
          setTemplates(data.filter((t: EmailTemplate) => t.isActive))
        }
      } catch (err) {
        console.error("Failed to fetch templates:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  // Try to detect which template is currently applied based on subject match
  useEffect(() => {
    if (currentSubject && templates.length > 0) {
      const match = templates.find((t) => t.subject === currentSubject)
      if (match) setAppliedId(match.id)
    }
  }, [currentSubject, templates])

  async function applyTemplate(template: EmailTemplate) {
    setApplying(template.id)
    try {
      const res = await fetch(`/api/updates/${updateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailSubject: template.subject,
          emailBody: template.body,
        }),
      })
      if (res.ok) {
        setAppliedId(template.id)
        onTemplateApplied()
      }
    } catch (err) {
      console.error("Failed to apply template:", err)
    } finally {
      setApplying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>אין תבניות מייל זמינות</p>
        <p className="text-sm mt-1">צור תבנית חדשה בעמוד המיילים</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">בחירת תבנית מייל</h3>
        <p className="text-sm text-muted-foreground mt-1">
          בחר את תבנית המייל שתישלח ללקוחות הזכאים לעדכון
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((template) => {
          const isApplied = appliedId === template.id
          const isApplying = applying === template.id

          return (
            <Card
              key={template.id}
              onClick={() => !isApplying && applyTemplate(template)}
              className={cn(
                "border-2 cursor-pointer transition-all hover:shadow-md",
                isApplied
                  ? "border-blue-500 bg-orange-50 shadow-sm"
                  : "border-gray-200 hover:border-orange-300"
              )}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {template.name}
                      </span>
                      {isApplied && (
                        <Check className="h-4 w-4 text-blue-600 shrink-0" />
                      )}
                    </div>
                    {template.category && (
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        {template.category}
                      </Badge>
                    )}
                  </div>
                  {isApplying && (
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />
                  )}
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2" dir="rtl">
                  נושא: {template.subject}
                </p>

                {isApplied && (
                  <p className="text-xs text-blue-600 font-medium">
                    תבנית נבחרה
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
