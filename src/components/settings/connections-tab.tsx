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

function ProviderCard({
  providerType,
  label,
  description,
  icon,
  providers,
  onRefresh,
}: {
  providerType: string
  label: string
  description: string
  icon: React.ReactNode
  providers: BillingProvider[]
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  // Form state
  const [field1, setField1] = useState("")
  const [field2, setField2] = useState("")
  const [field3, setField3] = useState("")
  const [useApiToken, setUseApiToken] = useState(true)

  const provider = providers.find((p) => p.provider === providerType)

  const handleSave = async () => {
    let apiKey = ""
    let apiSecret: string | null = null
    let displayName = label

    if (providerType === "ICOUNT") {
      if (!field1) {
        toast({ title: "יש להזין Company ID", variant: "destructive" })
        return
      }
      apiKey = field1
      if (useApiToken) {
        if (!field2) {
          toast({ title: "יש להזין API Token", variant: "destructive" })
          return
        }
        apiSecret = field2
      } else {
        if (!field2 || !field3) {
          toast({ title: "יש למלא אימייל וסיסמה", variant: "destructive" })
          return
        }
        apiSecret = `${field2}|||${field3}`
      }
    } else if (providerType === "YESHINVOICE") {
      if (!field1 || !field2) {
        toast({ title: "יש להזין Secret ו-UserKey", variant: "destructive" })
        return
      }
      apiKey = JSON.stringify({ secret: field1, userkey: field2 })
      displayName = "יש חשבונית"
    } else if (providerType === "CARDCOM") {
      if (!field1 || !field2 || !field3) {
        toast({ title: "יש להזין API Name, API Password ו-Terminal Number", variant: "destructive" })
        return
      }
      apiKey = JSON.stringify({ apiName: field1, apiPassword: field2, terminalNumber: field3 })
      displayName = "CardCom"
    }

    setSaving(true)
    try {
      const res = await fetch("/api/integrations/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerType,
          apiKey,
          apiSecret,
          displayName,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: data.message || "נשמר בהצלחה" })
        setField1("")
        setField2("")
        setField3("")
        onRefresh()
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
    if (!provider) return
    setTesting(true)
    try {
      const res = await fetch("/api/integrations/billing/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: provider.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "החיבור תקין!", variant: "success" as "default" })
      } else {
        toast({ title: "החיבור נכשל", description: data.message, variant: "destructive" })
      }
      onRefresh()
    } catch {
      toast({ title: "שגיאה בבדיקת חיבור", variant: "destructive" })
    } finally {
      setTesting(false)
    }
  }

  const handleToggleActive = async (active: boolean) => {
    if (!provider) return
    try {
      await fetch(`/api/integrations/billing/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: active }),
      })
      onRefresh()
    } catch {
      toast({ title: "שגיאה", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!provider) return
    if (!confirm(`למחוק את חיבור ${label}?`)) return
    try {
      await fetch(`/api/integrations/billing/${provider.id}`, { method: "DELETE" })
      onRefresh()
      toast({ title: "החיבור נמחק" })
    } catch {
      toast({ title: "שגיאה במחיקה", variant: "destructive" })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <CardTitle className="text-lg">{label}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {provider && (
            <div className="flex items-center gap-3">
              <Checkbox
                checked={provider.isActive}
                onCheckedChange={(checked) => handleToggleActive(checked === true)}
              />
              <Badge
                variant="outline"
                className={
                  provider.isActive && provider.lastSyncAt
                    ? "bg-green-100 text-green-800 border-green-200"
                    : provider.lastError
                      ? "bg-red-100 text-red-800 border-red-200"
                      : "bg-gray-100 text-gray-800 border-gray-200"
                }
              >
                {provider.isActive && provider.lastSyncAt
                  ? "מחובר"
                  : provider.lastError
                    ? "שגיאה"
                    : "לא מחובר"}
              </Badge>
              {provider.isPrimary && (
                <Badge className="bg-orange-100 text-blue-800 border-blue-200">ראשי</Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {provider ? (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">מזהה:</span>
                <span className="mr-2 font-mono">{provider.apiKey}</span>
              </div>
              {provider.lastSyncAt && (
                <div>
                  <span className="text-muted-foreground">בדיקה אחרונה:</span>
                  <span className="mr-2">{formatDateTime(provider.lastSyncAt)}</span>
                </div>
              )}
            </div>

            {provider.lastError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                <XCircle className="h-4 w-4 shrink-0" />
                {provider.lastError}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTest} disabled={testing}>
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

            <details className="border rounded-lg p-3">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                עדכון פרטי גישה
              </summary>
              <div className="space-y-3 mt-3">
                {providerType === "ICOUNT" ? (
                  <>
                    <div className="space-y-1">
                      <Label>Company ID</Label>
                      <Input value={field1} onChange={(e) => setField1(e.target.value)} placeholder="מזהה חברה" dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label>אימייל</Label>
                      <Input value={field2} onChange={(e) => setField2(e.target.value)} placeholder="user@email.com" dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label>סיסמה</Label>
                      <Input type="password" value={field3} onChange={(e) => setField3(e.target.value)} placeholder="••••••••" dir="ltr" />
                    </div>
                  </>
                ) : providerType === "CARDCOM" ? (
                  <>
                    <div className="space-y-1">
                      <Label>API Name</Label>
                      <Input value={field1} onChange={(e) => setField1(e.target.value)} placeholder="kzFKfoh..." dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label>API Password</Label>
                      <Input type="password" value={field2} onChange={(e) => setField2(e.target.value)} placeholder="••••••••" dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label>Terminal Number</Label>
                      <Input value={field3} onChange={(e) => setField3(e.target.value)} placeholder="1000" dir="ltr" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label>Secret</Label>
                      <Input value={field1} onChange={(e) => setField1(e.target.value)} placeholder="3c341b0f-310f-..." dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label>UserKey</Label>
                      <Input value={field2} onChange={(e) => setField2(e.target.value)} placeholder="QssW776...KqJ" dir="ltr" />
                    </div>
                  </>
                )}
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                  עדכן
                </Button>
              </div>
            </details>
          </>
        ) : (
          <div className="space-y-3">
            {providerType === "ICOUNT" ? (
              <>
                <div className="space-y-1">
                  <Label>Company ID</Label>
                  <Input value={field1} onChange={(e) => setField1(e.target.value)} placeholder="מזהה חברה ב-iCount" dir="ltr" />
                </div>
                <div className="flex gap-2 text-sm">
                  <Button type="button" variant={useApiToken ? "default" : "outline"} size="sm" onClick={() => setUseApiToken(true)}>
                    API Token
                  </Button>
                  <Button type="button" variant={!useApiToken ? "default" : "outline"} size="sm" onClick={() => setUseApiToken(false)}>
                    אימייל + סיסמה
                  </Button>
                </div>
                {useApiToken ? (
                  <div className="space-y-1">
                    <Label>API Token</Label>
                    <Input value={field2} onChange={(e) => setField2(e.target.value)} placeholder="API3E8-XXXX-XXXX-XXXX" dir="ltr" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label>אימייל (שם משתמש)</Label>
                      <Input value={field2} onChange={(e) => setField2(e.target.value)} placeholder="user@email.com" dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label>סיסמה</Label>
                      <Input type="password" value={field3} onChange={(e) => setField3(e.target.value)} placeholder="סיסמת iCount" dir="ltr" />
                    </div>
                  </>
                )}
              </>
            ) : providerType === "CARDCOM" ? (
              <>
                <div className="space-y-1">
                  <Label>API Name</Label>
                  <Input value={field1} onChange={(e) => setField1(e.target.value)} placeholder="kzFKfoh..." dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>API Password</Label>
                  <Input type="password" value={field2} onChange={(e) => setField2(e.target.value)} placeholder="••••••••" dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>Terminal Number</Label>
                  <Input value={field3} onChange={(e) => setField3(e.target.value)} placeholder="1000" dir="ltr" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Secret</Label>
                  <Input value={field1} onChange={(e) => setField1(e.target.value)} placeholder="3c341b0f-310f-4770-..." dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>UserKey</Label>
                  <Input value={field2} onChange={(e) => setField2(e.target.value)} placeholder="QssW7776655KqJ" dir="ltr" />
                </div>
              </>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Plug className="h-4 w-4 ml-2" />
              )}
              חבר {label}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ConnectionsTab() {
  const [providers, setProviders] = useState<BillingProvider[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ProviderCard
        providerType="YESHINVOICE"
        label="יש חשבונית"
        description="סליקה, חשבוניות וקבלות דיגיטליות"
        icon={
          <div className="p-2 bg-green-100 rounded-lg">
            <Plug className="h-5 w-5 text-green-600" />
          </div>
        }
        providers={providers}
        onRefresh={fetchProviders}
      />
      <ProviderCard
        providerType="CARDCOM"
        label="CardCom"
        description="סליקת אשראי, חשבוניות מס וקבלות"
        icon={
          <div className="p-2 bg-purple-100 rounded-lg">
            <Plug className="h-5 w-5 text-purple-600" />
          </div>
        }
        providers={providers}
        onRefresh={fetchProviders}
      />
      <ProviderCard
        providerType="ICOUNT"
        label="iCount"
        description="סליקה, קבלות, וניהול לקוחות"
        icon={
          <div className="p-2 bg-orange-100 rounded-lg">
            <Plug className="h-5 w-5 text-blue-600" />
          </div>
        }
        providers={providers}
        onRefresh={fetchProviders}
      />
    </div>
  )
}
