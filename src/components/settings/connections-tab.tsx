"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CheckCircle, XCircle, Plug, TestTube } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDateTime } from "@/lib/utils"

interface BillingProvider {
  id: string
  provider: string
  displayName: string
  apiKey: string
  isActive: boolean
  isPrimary: boolean
  lastSyncAt: string | null
  lastError: string | null
}

export function ConnectionsTab() {
  const { toast } = useToast()
  const [providers, setProviders] = useState<BillingProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  // iCount form
  const [companyId, setCompanyId] = useState("")
  const [apiToken, setApiToken] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [useApiToken, setUseApiToken] = useState(true)

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/integrations/billing")
      if (res.ok) {
        const data = await res.json()
        setProviders(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [])

  const icountProvider = providers.find((p) => p.provider === "ICOUNT")

  const handleSave = async () => {
    if (!companyId) {
      toast({ title: "יש להזין Company ID", variant: "destructive" })
      return
    }
    if (useApiToken && !apiToken) {
      toast({ title: "יש להזין API Token", variant: "destructive" })
      return
    }
    if (!useApiToken && (!email || !password)) {
      toast({ title: "יש למלא אימייל וסיסמה", variant: "destructive" })
      return
    }

    const secret = useApiToken ? apiToken : `${email}|||${password}`

    setSaving(true)
    try {
      const res = await fetch("/api/integrations/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "ICOUNT",
          apiKey: companyId,
          apiSecret: secret,
          displayName: "iCount",
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: data.message || "נשמר בהצלחה" })
        setCompanyId("")
        setApiToken("")
        setEmail("")
        setPassword("")
        fetchProviders()
      } else {
        toast({ title: "שגיאה", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!icountProvider) return
    setTesting(true)
    try {
      const res = await fetch("/api/integrations/billing/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: icountProvider.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "החיבור תקין!", variant: "success" as "default" })
      } else {
        toast({ title: "החיבור נכשל", description: data.message, variant: "destructive" })
      }
      fetchProviders()
    } catch {
      toast({ title: "שגיאה בבדיקת חיבור", variant: "destructive" })
    } finally {
      setTesting(false)
    }
  }

  const handleToggleActive = async (active: boolean) => {
    if (!icountProvider) return
    try {
      await fetch(`/api/integrations/billing/${icountProvider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: active }),
      })
      fetchProviders()
    } catch {
      toast({ title: "שגיאה", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!icountProvider) return
    if (!confirm("למחוק את חיבור iCount?")) return
    try {
      await fetch(`/api/integrations/billing/${icountProvider.id}`, { method: "DELETE" })
      fetchProviders()
      toast({ title: "החיבור נמחק" })
    } catch {
      toast({ title: "שגיאה במחיקה", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Plug className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">iCount</CardTitle>
                <CardDescription>סליקה, קבלות, וניהול לקוחות</CardDescription>
              </div>
            </div>
            {icountProvider && (
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={icountProvider.isActive}
                  onCheckedChange={(checked) => handleToggleActive(checked === true)}
                />
                <Badge
                  variant="outline"
                  className={
                    icountProvider.isActive && icountProvider.lastSyncAt
                      ? "bg-green-100 text-green-800 border-green-200"
                      : icountProvider.lastError
                        ? "bg-red-100 text-red-800 border-red-200"
                        : "bg-gray-100 text-gray-800 border-gray-200"
                  }
                >
                  {icountProvider.isActive && icountProvider.lastSyncAt
                    ? "מחובר"
                    : icountProvider.lastError
                      ? "שגיאה"
                      : "לא מחובר"}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {icountProvider ? (
            <>
              {/* Connected state */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Company ID:</span>
                  <span className="mr-2 font-mono">{icountProvider.apiKey}</span>
                </div>
                {icountProvider.lastSyncAt && (
                  <div>
                    <span className="text-muted-foreground">בדיקה אחרונה:</span>
                    <span className="mr-2">{formatDateTime(icountProvider.lastSyncAt)}</span>
                  </div>
                )}
              </div>

              {icountProvider.lastError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {icountProvider.lastError}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4 ml-2" />
                  )}
                  בדוק חיבור
                </Button>
                <Button variant="outline" className="text-red-600" onClick={handleDelete}>
                  מחק חיבור
                </Button>
              </div>

              {/* Update credentials */}
              <details className="border rounded-lg p-3">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  עדכון פרטי גישה
                </summary>
                <div className="space-y-3 mt-3">
                  <div className="space-y-1">
                    <Label>Company ID</Label>
                    <Input
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      placeholder="מזהה חברה ב-iCount"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>אימייל</Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@email.com"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>סיסמה</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                    />
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                    עדכן
                  </Button>
                </div>
              </details>
            </>
          ) : (
            <>
              {/* Setup form */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Company ID</Label>
                  <Input
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    placeholder="מזהה חברה ב-iCount"
                    dir="ltr"
                  />
                </div>

                <div className="flex gap-2 text-sm">
                  <Button
                    type="button"
                    variant={useApiToken ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseApiToken(true)}
                  >
                    API Token
                  </Button>
                  <Button
                    type="button"
                    variant={!useApiToken ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseApiToken(false)}
                  >
                    אימייל + סיסמה
                  </Button>
                </div>

                {useApiToken ? (
                  <div className="space-y-1">
                    <Label>API Token</Label>
                    <Input
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      placeholder="API3E8-XXXX-XXXX-XXXX"
                      dir="ltr"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label>אימייל (שם משתמש)</Label>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@email.com"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>סיסמה</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="סיסמת iCount"
                        dir="ltr"
                      />
                    </div>
                  </>
                )}

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <Plug className="h-4 w-4 ml-2" />
                  )}
                  חבר iCount
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
