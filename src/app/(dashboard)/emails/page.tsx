"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Plus, Send, Mail, Loader2, Edit, Users, AlertTriangle, Info,
  RefreshCw, UserPlus, Percent, Gift, Bell, ShoppingBag,
  ChevronDown, ChevronUp, FolderOpen,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  category: string | null
  variables: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    emailLogs: number
  }
}

interface CategoryConfig {
  key: string
  label: string
  icon: LucideIcon
  color: string
  bgColor: string
  iconColor: string
}

const CATEGORIES_CONFIG: CategoryConfig[] = [
  {
    key: "update",
    label: "מיילים של עדכון",
    icon: RefreshCw,
    color: "border-r-blue-500",
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    key: "after_purchase",
    label: "אחרי רכישה",
    icon: ShoppingBag,
    color: "border-r-emerald-500",
    bgColor: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    key: "welcome",
    label: "לקוח חדש",
    icon: UserPlus,
    color: "border-r-green-500",
    bgColor: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    key: "promotion",
    label: "מבצעים והצעות מחיר",
    icon: Percent,
    color: "border-r-orange-500",
    bgColor: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    key: "greeting",
    label: "ברכות וחגים",
    icon: Gift,
    color: "border-r-pink-500",
    bgColor: "bg-pink-100",
    iconColor: "text-pink-600",
  },
  {
    key: "reminder",
    label: "תזכורות",
    icon: Bell,
    color: "border-r-amber-500",
    bgColor: "bg-amber-100",
    iconColor: "text-amber-600",
  },
]

// Fallback mapping for old category values
const CATEGORY_FALLBACK: Record<string, string> = {
  general: "greeting",
}

export default function EmailsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [bulkSending, setBulkSending] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(CATEGORIES_CONFIG.map(c => c.key).concat(["uncategorized"]))
  )

  const handleBulkSend = async (type: "not_updated" | "half_set") => {
    const label = type === "not_updated" ? "למי שלא מעודכן" : "לחצאי סטים"
    if (!confirm(`לשלוח מיילים ${label}? פעולה זו תשלח מיילים לכל הלקוחות המתאימים.`)) return
    setBulkSending(type)
    try {
      const res = await fetch("/api/emails/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: data.message, variant: "success" as "default" })
      } else {
        toast({ title: "שגיאה", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "שגיאה בשליחה", variant: "destructive" })
    } finally {
      setBulkSending(null)
    }
  }

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch("/api/emails/templates")
        if (res.ok) {
          const data = await res.json()
          setTemplates(data.templates || data)
        }
      } catch (err) {
        console.error("Error fetching templates:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, EmailTemplate[]> = {}
    for (const cat of CATEGORIES_CONFIG) {
      groups[cat.key] = []
    }
    groups["uncategorized"] = []

    for (const t of templates) {
      let cat = t.category || "uncategorized"
      // Map old category values to new ones
      if (CATEGORY_FALLBACK[cat]) {
        cat = CATEGORY_FALLBACK[cat]
      }
      if (groups[cat]) {
        groups[cat].push(t)
      } else {
        groups["uncategorized"].push(t)
      }
    }

    return groups
  }, [templates])

  const allKeys = CATEGORIES_CONFIG.map(c => c.key).concat(["uncategorized"])
  const allExpanded = allKeys.every(k => expandedSections.has(k))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">מיילים</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/emails/send")}>
            <Send className="h-4 w-4 ml-2" />
            שלח מייל
          </Button>
          <Button onClick={() => router.push("/emails/templates/new")}>
            <Plus className="h-4 w-4 ml-2" />
            תבנית חדשה
          </Button>
        </div>
      </div>

      {/* הסבר על תבניות */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-blue-800">תבניות קבועות ומשתנות</p>
              <p className="text-blue-700">
                <strong>תבניות קבועות</strong> (ברכות, חגים) — התוכן זהה לכל לקוח ולא צריך לשנות אותן.
              </p>
              <p className="text-blue-700">
                <strong>תבניות משתנות</strong> (עדכונים, הצעות מחיר) — משתמשות במשתנים כמו {`{{version}}`}, {`{{downloadLink}}`}, {`{{customerName}}`} שמוחלפים אוטומטית בשליחה.
                <br />
                לא צריך לשנות אותן בכל עדכון — המערכת מחליפה את המשתנים לבד.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* שליחה קבוצתית */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-r-4 border-r-red-400">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-sm">שלח למי שלא מעודכן</p>
                <p className="text-xs text-muted-foreground">מייל עם הצעת מחיר לעדכון</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleBulkSend("not_updated")} disabled={!!bulkSending}>
              {bulkSending === "not_updated" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-amber-400">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-sm">שלח לחצאי סטים</p>
                <p className="text-xs text-muted-foreground">הצעה לשדרוג לסט שלם</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleBulkSend("half_set")} disabled={!!bulkSending}>
              {bulkSending === "half_set" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* כותרת + הרחב/כווץ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <h3 className="font-semibold text-lg">תבניות מייל</h3>
          <Badge variant="outline">{templates.length} תבניות</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (allExpanded) {
              setExpandedSections(new Set())
            } else {
              setExpandedSections(new Set(allKeys))
            }
          }}
        >
          {allExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 ml-1" />
              כווץ הכל
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 ml-1" />
              הרחב הכל
            </>
          )}
        </Button>
      </div>

      {/* תוכן */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          אין תבניות מייל. צור תבנית חדשה כדי להתחיל.
        </div>
      ) : (
        <div className="space-y-3">
          {CATEGORIES_CONFIG.map(cat => {
            const catTemplates = groupedTemplates[cat.key]
            if (!catTemplates || catTemplates.length === 0) return null
            const Icon = cat.icon
            const isExpanded = expandedSections.has(cat.key)

            return (
              <Card key={cat.key} className={`border-r-4 ${cat.color}`}>
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleSection(cat.key)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${cat.bgColor}`}>
                      <Icon className={`h-4 w-4 ${cat.iconColor}`} />
                    </div>
                    <span className="font-medium">{cat.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {catTemplates.length}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>שם</TableHead>
                          <TableHead>נושא</TableHead>
                          <TableHead>משתנים</TableHead>
                          <TableHead>שימושים</TableHead>
                          <TableHead>עדכון אחרון</TableHead>
                          <TableHead className="w-20">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catTemplates.map((template) => (
                          <TableRow key={template.id}>
                            <TableCell className="font-medium">{template.name}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{template.subject}</TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {template.variables.length}
                              </span>
                            </TableCell>
                            <TableCell>{template._count?.emailLogs ?? 0}</TableCell>
                            <TableCell className="text-sm">
                              {formatDateTime(template.updatedAt)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => router.push(`/emails/templates/${template.id}`)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            )
          })}

          {/* ללא קטגוריה */}
          {groupedTemplates["uncategorized"]?.length > 0 && (
            <Card className="border-r-4 border-r-gray-400">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection("uncategorized")}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100">
                    <FolderOpen className="h-4 w-4 text-gray-600" />
                  </div>
                  <span className="font-medium">ללא קטגוריה</span>
                  <Badge variant="outline" className="text-xs">
                    {groupedTemplates["uncategorized"].length}
                  </Badge>
                </div>
                {expandedSections.has("uncategorized") ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {expandedSections.has("uncategorized") && (
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם</TableHead>
                        <TableHead>נושא</TableHead>
                        <TableHead>משתנים</TableHead>
                        <TableHead>שימושים</TableHead>
                        <TableHead>עדכון אחרון</TableHead>
                        <TableHead className="w-20">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedTemplates["uncategorized"].map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{template.subject}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {template.variables.length}
                            </span>
                          </TableCell>
                          <TableCell>{template._count?.emailLogs ?? 0}</TableCell>
                          <TableCell className="text-sm">
                            {formatDateTime(template.updatedAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/emails/templates/${template.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
