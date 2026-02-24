"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"
import { formatDateTime } from "@/lib/utils"

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

  // New user form
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserRole, setNewUserRole] = useState("ADMIN")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, infoRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/settings/info"),
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
                <span dir="ltr">noreply@motyplus.com</span>
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
              <Input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
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
