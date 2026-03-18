"use client"

import { useState, useEffect } from "react"
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
import { Plus, Send, Mail, Loader2, Edit, Users, AlertTriangle, Info } from "lucide-react"
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

const CATEGORY_LABELS: Record<string, string> = {
  update: "עדכון",
  welcome: "ברוכים הבאים",
  promotion: "מבצע",
  general: "כללי",
  reminder: "תזכורת",
}

export default function EmailsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [bulkSending, setBulkSending] = useState<string | null>(null)

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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            תבניות מייל
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              אין תבניות מייל. צור תבנית חדשה כדי להתחיל.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>נושא</TableHead>
                  <TableHead>קטגוריה</TableHead>
                  <TableHead>משתנים</TableHead>
                  <TableHead>שימושים</TableHead>
                  <TableHead>עדכון אחרון</TableHead>
                  <TableHead className="w-20">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{template.subject}</TableCell>
                    <TableCell>
                      {template.category ? (
                        <Badge variant="outline">
                          {CATEGORY_LABELS[template.category] || template.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
