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
import { Plus, Send, Mail, Loader2, Edit } from "lucide-react"
import { formatDateTime } from "@/lib/utils"

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
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)

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
