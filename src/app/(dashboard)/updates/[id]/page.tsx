"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UpdateForm } from "@/components/updates/update-form"
import { ArrowRight, Users, Send, Download, Loader2, Edit, ListChecks } from "lucide-react"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"

interface UpdateVersion {
  id: string
  version: string
  price: number
  status: string
  releaseDate: string | null
  description: string | null
  driveRhythmsFolder: string | null
  driveSamplesFolder: string | null
  emailSubject: string | null
  emailBody: string | null
  createdAt: string
  customerUpdates: Array<{
    id: string
    customerId: number
    sentAt: string | null
    downloadedAt: string | null
    customer: {
      id: number
      fullName: string
      email: string
      organ: { name: string }
    }
  }>
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "טיוטה", className: "bg-gray-100 text-gray-800 border-gray-200" },
  PREPARING: { label: "בהכנה", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  READY: { label: "מוכן", className: "bg-blue-100 text-blue-800 border-blue-200" },
  SENDING: { label: "בשליחה", className: "bg-orange-100 text-orange-800 border-orange-200" },
  COMPLETED: { label: "הושלם", className: "bg-green-100 text-green-800 border-green-200" },
}

export default function UpdateDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [update, setUpdate] = useState<UpdateVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const fetchUpdate = async () => {
    try {
      const res = await fetch(`/api/updates/${id}`)
      if (res.ok) {
        const data = await res.json()
        setUpdate(data)
      }
    } catch (err) {
      console.error("Error fetching update:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUpdate()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!update) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        עדכון לא נמצא
      </div>
    )
  }

  const sentCount = update.customerUpdates.filter((cu) => cu.sentAt).length
  const downloadedCount = update.customerUpdates.filter((cu) => cu.downloadedAt).length
  const totalEligible = update.customerUpdates.length
  const statusConfig = STATUS_CONFIG[update.status] || STATUS_CONFIG.DRAFT

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/updates")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
              עדכון {update.version}
            </h2>
            <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
          </div>
          {update.releaseDate && (
            <p className="text-sm text-muted-foreground mt-1">
              תאריך שחרור: {formatDate(update.releaseDate)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/updates/${id}/work`)}
        >
          <ListChecks className="h-4 w-4 ml-2" />
          רשימת עבודה
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">זכאים</p>
              <p className="text-2xl font-bold">{totalEligible}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Send className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">נשלחו</p>
              <p className="text-2xl font-bold">{sentCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">הורדו</p>
              <p className="text-2xl font-bold">{downloadedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" dir="rtl">
        <TabsList>
          <TabsTrigger value="details">פרטים</TabsTrigger>
          <TabsTrigger value="work">רשימת עבודה</TabsTrigger>
          <TabsTrigger value="sent">נשלחו ({sentCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          {editing ? (
            <UpdateForm
              mode="edit"
              updateId={id}
              initialData={{
                version: update.version,
                price: Number(update.price),
                description: update.description || "",
                driveRhythmsFolder: update.driveRhythmsFolder || "",
                driveSamplesFolder: update.driveSamplesFolder || "",
                emailSubject: update.emailSubject || "",
                emailBody: update.emailBody || "",
                releaseDate: update.releaseDate
                  ? new Date(update.releaseDate).toISOString().split("T")[0]
                  : "",
              }}
            />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">פרטי עדכון</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Edit className="h-4 w-4 ml-1" />
                    עריכה
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">גרסה: </span>
                    <span className="font-medium">{update.version}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">מחיר: </span>
                    <span className="font-medium">{formatCurrency(Number(update.price))}</span>
                  </div>
                </div>
                {update.description && (
                  <div>
                    <span className="text-sm text-muted-foreground">תיאור: </span>
                    <p className="text-sm mt-1">{update.description}</p>
                  </div>
                )}
                {update.driveRhythmsFolder && (
                  <div>
                    <span className="text-sm text-muted-foreground">תיקיית ריתמוסים: </span>
                    <a
                      href={update.driveRhythmsFolder}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                      dir="ltr"
                    >
                      {update.driveRhythmsFolder}
                    </a>
                  </div>
                )}
                {update.driveSamplesFolder && (
                  <div>
                    <span className="text-sm text-muted-foreground">תיקיית דגימות: </span>
                    <a
                      href={update.driveSamplesFolder}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                      dir="ltr"
                    >
                      {update.driveSamplesFolder}
                    </a>
                  </div>
                )}
                {update.emailSubject && (
                  <div>
                    <span className="text-sm text-muted-foreground">נושא מייל: </span>
                    <span className="text-sm">{update.emailSubject}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="work">
          <Card>
            <CardContent className="p-4">
              <Button onClick={() => router.push(`/updates/${id}/work`)}>
                <ListChecks className="h-4 w-4 ml-2" />
                פתח רשימת עבודה מלאה
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent">
          <Card>
            <CardContent className="pt-4">
              {sentCount === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  טרם נשלחו עדכונים ללקוחות
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>מזהה</TableHead>
                      <TableHead>שם</TableHead>
                      <TableHead>אורגן</TableHead>
                      <TableHead>נשלח בתאריך</TableHead>
                      <TableHead>הורד בתאריך</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {update.customerUpdates
                      .filter((cu) => cu.sentAt)
                      .map((cu) => (
                        <TableRow key={cu.id}>
                          <TableCell className="font-mono text-xs">{cu.customerId}</TableCell>
                          <TableCell className="font-medium">{cu.customer.fullName}</TableCell>
                          <TableCell>{cu.customer.organ.name}</TableCell>
                          <TableCell>{cu.sentAt ? formatDateTime(cu.sentAt) : "-"}</TableCell>
                          <TableCell>
                            {cu.downloadedAt ? (
                              formatDateTime(cu.downloadedAt)
                            ) : (
                              <span className="text-muted-foreground">טרם הורד</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
