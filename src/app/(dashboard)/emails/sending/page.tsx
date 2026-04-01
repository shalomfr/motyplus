"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Send, Mail, Loader2, Users, AlertTriangle, Info,
  RefreshCw, Clock, Package, ArrowRight,
} from "lucide-react"
import { BulkQuoteWizardDialog } from "@/components/emails/bulk-quote-wizard-dialog"

interface PendingUpdate {
  id: string
  version: string
  status: string
  updateType: string
  price: number
  description: string | null
  releaseDate: string | null
  createdAt: string
  totalCustomers: number
  sentCount: number
  pendingCount: number
}

export default function EmailSendingPage() {
  const router = useRouter()
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [bulkWizardOpen, setBulkWizardOpen] = useState(false)
  const [bulkWizardType, setBulkWizardType] = useState<"not_updated" | "half_set" | undefined>(undefined)

  const fetchPendingUpdates = async () => {
    setPendingLoading(true)
    try {
      const res = await fetch("/api/updates/pending")
      if (res.ok) {
        const data = await res.json()
        setPendingUpdates(data)
      }
    } catch (err) {
      console.error("Error fetching pending updates:", err)
    } finally {
      setPendingLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingUpdates()
  }, [])

  const openBulkWizard = (type: "not_updated" | "half_set") => {
    setBulkWizardType(type)
    setBulkWizardOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">שליחת מיילים</h2>
        <Button variant="outline" onClick={() => router.push("/emails")} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          חזרה למיילים
        </Button>
      </div>

      {/* הסבר */}
      <Card className="border-blue-200 bg-orange-50/50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-blue-800">שליחת עדכונים ומיילים</p>
              <p className="text-blue-700">
                כאן ניתן לשלוח עדכונים שהוכנו באשף העדכונים, או לשלוח מיילים מותאמים אישית.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* עדכונים ממתינים */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <h3 className="font-semibold text-lg">עדכונים ממתינים לשליחה</h3>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPendingUpdates} disabled={pendingLoading}>
            {pendingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {pendingLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingUpdates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>אין עדכונים ממתינים לשליחה</p>
              <p className="text-xs mt-1">עדכונים שנשמרים באשף העדכונים יופיעו כאן</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingUpdates.map((update) => (
              <Card key={update.id} className="border-r-4 border-r-orange-400 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Package className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">
                          עדכון {update.version}
                          <Badge variant="outline" className="mr-2 text-xs">
                            {update.updateType === "FULL" ? "מלא" : "חלקי"}
                          </Badge>
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>{update.totalCustomers} לקוחות סה&quot;כ</span>
                          <span className="text-green-600">{update.sentCount} נשלחו</span>
                          {update.pendingCount > 0 && (
                            <span className="text-orange-600 font-medium">{update.pendingCount} ממתינים</span>
                          )}
                        </div>
                        {update.description && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-md truncate">{update.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={update.status === "READY" ? "default" : "secondary"}
                        className={update.status === "READY" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                      >
                        {update.status === "READY" ? "מוכן לשליחה" : "בשליחה"}
                      </Badge>
                      <Button
                        onClick={() => router.push(`/updates/${update.id}/wizard`)}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <Send className="h-4 w-4" />
                        שלח עדכון
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* שליחה קבוצתית */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h3 className="font-semibold text-lg">שליחה קבוצתית</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-r-4 border-r-red-400 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openBulkWizard("not_updated")}>
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
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="border-r-4 border-r-amber-400 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openBulkWizard("half_set")}>
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
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* שליחת מייל מותאם */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <h3 className="font-semibold text-lg">שליחת מייל מותאם</h3>
        </div>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/emails/send")}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm">שלח מייל מותאם אישית</p>
                <p className="text-xs text-muted-foreground">בחר תבנית, נמענים, ושלח מייל</p>
              </div>
            </div>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <BulkQuoteWizardDialog
        open={bulkWizardOpen}
        onOpenChange={setBulkWizardOpen}
        initialType={bulkWizardType}
      />
    </div>
  )
}
