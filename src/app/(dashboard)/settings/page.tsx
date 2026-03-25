"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailInput } from "@/components/ui/email-input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Settings as SettingsIcon,
  Mail,
  HardDrive,
  Info,
  Users,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  RefreshCw,
  WifiOff,
  Download,
  Upload,
  Database,
  AlertTriangle,
} from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { ConnectionsTab } from "@/components/settings/connections-tab"

interface SystemUser {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

interface SystemInfo {
  emailConfigured: boolean
  driveConnected: boolean
  totalCustomers: number
  totalLeads: number
  version: string
}

interface WhatsAppStatus {
  configured: boolean
  status: "connected" | "disconnected" | "not_created" | "not_configured" | "pairing" | "connecting" | "error"
  phone?: string
  qrcode?: string | null
  pairingCode?: string | null
}

export default function SettingsPage() {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    emailConfigured: false,
    driveConnected: false,
    totalCustomers: 0,
    totalLeads: 0,
    version: "1.0.0",
  })
  const [loading, setLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus>({ configured: false, status: "not_configured" })
  const [waLoading, setWaLoading] = useState(false)
  const [waPolling, setWaPolling] = useState(false)
  const [waPhone, setWaPhone] = useState("")
  const [waPairingCode, setWaPairingCode] = useState<string | null>(null)
  const [waMode, setWaMode] = useState<"qr" | "phone">("qr")

  // Backup states
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null)
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null)

  // New user form
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserRole, setNewUserRole] = useState("ADMIN")

  const fetchWhatsApp = async () => {
    setWaLoading(true)
    try {
      const res = await fetch("/api/whatsapp")
      if (res.ok) setWhatsapp(await res.json())
    } catch (err) {
      console.error("WhatsApp status error:", err)
    } finally {
      setWaLoading(false)
    }
  }

  const handleWhatsAppAction = async (action: string) => {
    setWaLoading(true)
    try {
      await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      await fetchWhatsApp()
      if (action === "connect" || action === "create") setWaPolling(true)
      if (action === "disconnect") { setWaPairingCode(null); setWaPolling(false) }
    } catch (err) {
      console.error("WhatsApp action error:", err)
    } finally {
      setWaLoading(false)
    }
  }

  const handlePairByPhone = async () => {
    if (!waPhone.trim()) return
    setWaLoading(true)
    setWaPairingCode(null)
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pair", phone: waPhone }),
      })
      const data = await res.json()
      if (data.pairingCode) {
        setWaPairingCode(data.pairingCode)
        setWaPolling(true)
      }
    } catch (err) {
      console.error("Pairing error:", err)
    } finally {
      setWaLoading(false)
    }
  }

  // Poll for QR/connection when waiting — slower poll to avoid QR flicker
  useEffect(() => {
    if (!waPolling) return
    const pollInterval = whatsapp.qrcode ? 10000 : 5000 // 10s when QR shown, 5s otherwise
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/whatsapp")
        if (res.ok) {
          const data: WhatsAppStatus = await res.json()
          // Only update QR if it actually changed (avoid flicker)
          if (data.qrcode && whatsapp.qrcode && data.qrcode === whatsapp.qrcode) {
            // QR same — just update status
            setWhatsapp(prev => ({ ...prev, status: data.status, phone: data.phone }))
          } else {
            setWhatsapp(data)
          }
          if (data.status === "connected") setWaPolling(false)
          // If QR expired (status back to disconnected with no QR), stop polling
          if (data.status === "disconnected" && !data.qrcode && whatsapp.qrcode) setWaPolling(false)
        }
      } catch (err) {
        console.error("Poll error:", err)
      }
    }, pollInterval)
    return () => clearInterval(interval)
  }, [waPolling, whatsapp.qrcode, whatsapp.status])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, infoRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/settings/info"),
          fetchWhatsApp(),
        ])

        if (usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.users || data)
        }
        if (infoRes.ok) {
          const data = await infoRes.json()
          setSystemInfo(data)
        }
      } catch (err) {
        console.error("Error fetching settings data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleAddUser = async () => {
    setSavingUser(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setUsers((prev) => [...prev, data])
        setShowAddUser(false)
        setNewUserName("")
        setNewUserEmail("")
        setNewUserPassword("")
        setNewUserRole("ADMIN")
      }
    } catch (err) {
      console.error("Error adding user:", err)
    } finally {
      setSavingUser(false)
    }
  }

  const handleToggleUser = async (userId: string, isActive: boolean) => {
    const action = isActive ? "להשבית" : "להפעיל"
    if (!confirm(`האם ${action} את המשתמש?`)) return
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      })
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !isActive } : u))
      )
    } catch (err) {
      console.error("Error toggling user:", err)
    }
  }

  // Fetch last backup date
  useEffect(() => {
    fetch("/api/settings/info")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.lastBackupDate) setLastBackupDate(data.lastBackupDate)
      })
      .catch(() => {})
  }, [])

  const handleExportBackup = async () => {
    setBackupLoading(true)
    try {
      const res = await fetch("/api/backup/export")
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `motty-beats-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setLastBackupDate(new Date().toISOString())
    } catch (err) {
      console.error("Backup error:", err)
      alert("שגיאה ביצירת גיבוי")
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRestoreBackup = async () => {
    if (!restoreFile) return
    setRestoreLoading(true)
    setRestoreResult(null)
    try {
      const formData = new FormData()
      formData.append("file", restoreFile)
      const res = await fetch("/api/backup/import", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok) {
        setRestoreResult({ success: true, message: `שוחזרו ${data.totalRecords} רשומות מ-${data.tablesRestored} טבלאות` })
      } else {
        setRestoreResult({ success: false, message: data.error || "שגיאה בשחזור" })
      }
    } catch (err) {
      console.error("Restore error:", err)
      setRestoreResult({ success: false, message: "שגיאה בשחזור" })
    } finally {
      setRestoreLoading(false)
      setShowRestoreConfirm(false)
      setRestoreFile(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-7 w-7 text-gray-600" />
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">הגדרות</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              הגדרות מייל
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {systemInfo.emailConfigured ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-green-700 font-medium">שירות מייל מוגדר ופעיל</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm text-red-700 font-medium">שירות מייל לא מוגדר</span>
                </>
              )}
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ספק:</span>
                <span>Resend API</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">כתובת שולח:</span>
                <span dir="ltr">noreply@mottybeats.com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">מפתח API:</span>
                <span>{systemInfo.emailConfigured ? "********" : "לא הוגדר"}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              הגדרת מפתח API מתבצעת דרך משתני סביבה (RESEND_API_KEY)
            </p>
          </CardContent>
        </Card>

        {/* Google Drive */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              חיבור Google Drive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {systemInfo.driveConnected ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-green-700 font-medium">מחובר ל-Google Drive</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-amber-500" />
                  <span className="text-sm text-amber-700 font-medium">לא מחובר</span>
                </>
              )}
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              חיבור Google Drive מאפשר ניהול תיקיות עדכונים ודגימות ישירות מהמערכת.
            </p>
            <Button variant="outline" size="sm">
              {systemInfo.driveConnected ? "בדוק חיבור" : "חבר Google Drive"}
            </Button>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5" />
              מידע מערכת
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">גרסת מערכת:</span>
                <Badge variant="outline">{systemInfo.version}</Badge>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">סה"כ לקוחות:</span>
                <span className="font-medium">{systemInfo.totalCustomers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">סה"כ לידים:</span>
                <span className="font-medium">{systemInfo.totalLeads}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">סביבה:</span>
                <span>Production</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">בסיס נתונים:</span>
                <span>PostgreSQL</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Backup & Restore */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              גיבוי ושחזור
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastBackupDate && (
              <div className="text-sm text-muted-foreground">
                גיבוי אחרון: {formatDateTime(lastBackupDate)}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleExportBackup} disabled={backupLoading}>
                {backupLoading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Download className="h-4 w-4 ml-1" />}
                ייצא גיבוי
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => document.getElementById("restore-file-input")?.click()}
                disabled={restoreLoading}
              >
                <Upload className="h-4 w-4 ml-1" />
                שחזר מגיבוי
              </Button>
              <input
                id="restore-file-input"
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setRestoreFile(file)
                    setShowRestoreConfirm(true)
                  }
                  e.target.value = ""
                }}
              />
            </div>
            {restoreResult && (
              <div className={`flex items-center gap-2 text-sm ${restoreResult.success ? "text-green-700" : "text-red-700"}`}>
                {restoreResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {restoreResult.message}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              הגיבוי כולל את כל הנתונים במסד הנתונים. קבצים ב-Google Drive מגובים בנפרד.
            </p>
          </CardContent>
        </Card>

        {/* WhatsApp Connection */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
                חיבור וואטסאפ
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={fetchWhatsApp} disabled={waLoading}>
                <RefreshCw className={`h-4 w-4 ${waLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!whatsapp.configured ? (
              <div className="flex items-center gap-2 text-amber-700">
                <XCircle className="h-5 w-5 text-amber-500" />
                <span className="text-sm">Evolution API לא מוגדר (חסר EVOLUTION_URL)</span>
              </div>
            ) : whatsapp.status === "connected" ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700">וואטסאפ מחובר</p>
                    {whatsapp.phone && <p className="text-sm text-muted-foreground">{whatsapp.phone}</p>}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 border-red-200 hover:bg-red-50"
                  onClick={() => handleWhatsAppAction("disconnect")}
                  disabled={waLoading}
                >
                  <WifiOff className="h-4 w-4 ml-1" />
                  נתק
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mode tabs */}
                <div className="flex border rounded-lg overflow-hidden w-fit">
                  <button
                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${waMode === "qr" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    onClick={() => setWaMode("qr")}
                  >
                    קוד QR
                  </button>
                  <button
                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${waMode === "phone" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    onClick={() => setWaMode("phone")}
                  >
                    מספר טלפון
                  </button>
                </div>

                {waMode === "qr" ? (
                  <>
                    {whatsapp.qrcode ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                          <span className="text-sm text-green-700">ממתין לסריקה...</span>
                        </div>
                        <p className="text-xs text-muted-foreground">פתח וואטסאפ ← מכשירים מחוברים ← חבר מכשיר</p>
                        <img
                          src={whatsapp.qrcode.startsWith("data:") ? whatsapp.qrcode : `data:image/png;base64,${whatsapp.qrcode}`}
                          alt="QR Code"
                          className="w-52 h-52 border rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">חבר את WhatsApp באמצעות סריקת קוד QR</p>
                        <Button size="sm" onClick={() => { handleWhatsAppAction("connect"); setWaPolling(true); }} disabled={waLoading}>
                          {waLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                          קבל קוד QR
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {waPairingCode ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                          <span className="text-sm text-green-700">ממתין לאישור בטלפון...</span>
                        </div>
                        <p className="text-xs text-muted-foreground">פתח וואטסאפ ← מכשירים מחוברים ← חבר מכשיר ← חבר עם מספר טלפון</p>
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 border-2 border-primary rounded-xl px-6 py-3">
                            <span className="text-2xl font-bold tracking-[0.3em] text-primary" dir="ltr">
                              {waPairingCode.slice(0, 4)}-{waPairingCode.slice(4)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">הזן קוד זה בוואטסאפ</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">הזן מספר טלפון לקבלת קוד צימוד</p>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label className="text-xs mb-1">מספר טלפון</Label>
                            <Input
                              dir="ltr"
                              placeholder="050-837-7756"
                              value={waPhone}
                              onChange={(e) => setWaPhone(e.target.value)}
                              className="text-left"
                            />
                          </div>
                          <Button size="sm" onClick={handlePairByPhone} disabled={waLoading || !waPhone.trim()}>
                            {waLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            קבל קוד
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={fetchWhatsApp} disabled={waLoading}>
                    <RefreshCw className="h-4 w-4 ml-1" />
                    רענן
                  </Button>
                  {(whatsapp.qrcode || waPairingCode) && (
                    <Button variant="ghost" size="sm" onClick={() => handleWhatsAppAction("disconnect")} disabled={waLoading} className="text-red-500">
                      נתק ונסה שוב
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Management */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                ניהול משתמשים
              </CardTitle>
              <Button size="sm" onClick={() => setShowAddUser(true)}>
                <Plus className="h-4 w-4 ml-1" />
                הוסף משתמש
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                אין משתמשים במערכת
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>מייל</TableHead>
                    <TableHead>תפקיד</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>נוצר</TableHead>
                    <TableHead className="w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell dir="ltr" className="text-left">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {user.role === "ADMIN" ? "מנהל" : "סוכן"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">פעיל</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-200">מושבת</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleUser(user.id, user.isActive)}
                          className={user.isActive ? "text-red-500 hover:text-red-700" : "text-green-500 hover:text-green-700"}
                        >
                          {user.isActive ? "השבת" : "הפעל"}
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

      {/* Restore Confirm Dialog */}
      <Dialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              שחזור מגיבוי
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium text-red-600">
              שים לב! פעולה זו תמחק את כל הנתונים הנוכחיים במערכת ותחליף אותם בנתונים מהגיבוי.
            </p>
            {restoreFile && (
              <div className="text-sm text-muted-foreground">
                קובץ: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(0)} KB)
              </div>
            )}
            <p className="text-sm">האם אתה בטוח שברצונך להמשיך?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRestoreConfirm(false); setRestoreFile(null) }}>
              ביטול
            </Button>
            <Button variant="destructive" onClick={handleRestoreBackup} disabled={restoreLoading}>
              {restoreLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              כן, שחזר
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* חיבורים */}
      <Separator className="my-4" />
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">חיבורים</h3>
        <ConnectionsTab />
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת משתמש חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם</Label>
              <Input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="שם המשתמש"
              />
            </div>
            <div className="space-y-2">
              <Label>מייל</Label>
              <EmailInput
                value={newUserEmail}
                onValueChange={(val) => setNewUserEmail(val)}
                placeholder="email@example.com"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label>סיסמה</Label>
              <Input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="סיסמה (מינימום 6 תווים)"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label>תפקיד</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">מנהל</SelectItem>
                  <SelectItem value="AGENT">סוכן</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>ביטול</Button>
            <Button
              onClick={handleAddUser}
              disabled={savingUser || !newUserName || !newUserEmail || !newUserPassword}
            >
              {savingUser && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              הוסף משתמש
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
