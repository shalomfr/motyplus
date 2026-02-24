"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Save, Loader2 } from "lucide-react"

interface LeadFormData {
  fullName: string
  phone: string
  email: string
  organInterest: string
  organId: string
  source: string
  assignedAgentId: string
}

interface LeadFormProps {
  initialData?: Partial<LeadFormData>
  leadId?: string
  mode: "create" | "edit"
}

interface Organ {
  id: string
  name: string
}

interface Agent {
  id: string
  name: string
}

const SOURCES = [
  { value: "website", label: "אתר" },
  { value: "facebook", label: "פייסבוק" },
  { value: "instagram", label: "אינסטגרם" },
  { value: "referral", label: "הפניה" },
  { value: "phone", label: "טלפון" },
  { value: "other", label: "אחר" },
]

export function LeadForm({ initialData, leadId, mode }: LeadFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [organs, setOrgans] = useState<Organ[]>([])
  const [agents, setAgents] = useState<Agent[]>([])

  const [form, setForm] = useState<LeadFormData>({
    fullName: initialData?.fullName || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    organInterest: initialData?.organInterest || "",
    organId: initialData?.organId || "",
    source: initialData?.source || "",
    assignedAgentId: initialData?.assignedAgentId || "",
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [organsRes, agentsRes] = await Promise.all([
          fetch("/api/data/organs"),
          fetch("/api/users?role=AGENT"),
        ])

        if (organsRes.ok) {
          const data = await organsRes.json()
          setOrgans(data.organs || data)
        }
        if (agentsRes.ok) {
          const data = await agentsRes.json()
          setAgents(data.users || data)
        }
      } catch (err) {
        console.error("Error fetching form data:", err)
      }
    }
    fetchData()
  }, [])

  const handleChange = (field: keyof LeadFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const url = mode === "create" ? "/api/leads" : `/api/leads/${leadId}`
      const method = mode === "create" ? "POST" : "PATCH"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          organId: form.organId || null,
          assignedAgentId: form.assignedAgentId || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "שגיאה בשמירה")
      }

      const data = await res.json()
      router.push(`/leads/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">פרטי ליד</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">שם מלא</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="שם מלא"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">טלפון</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="050-0000000"
                dir="ltr"
                className="text-left"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">מייל</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organInterest">עניין באורגן</Label>
              <Input
                id="organInterest"
                value={form.organInterest}
                onChange={(e) => handleChange("organInterest", e.target.value)}
                placeholder="למשל: פסנתר, גיטרה..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>אורגן</Label>
              <Select value={form.organId} onValueChange={(v) => handleChange("organId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר אורגן..." />
                </SelectTrigger>
                <SelectContent>
                  {organs.map((organ) => (
                    <SelectItem key={organ.id} value={organ.id}>
                      {organ.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>מקור</Label>
              <Select value={form.source} onValueChange={(v) => handleChange("source", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר מקור..." />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>סוכן מטפל</Label>
            <Select
              value={form.assignedAgentId}
              onValueChange={(v) => handleChange("assignedAgentId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר סוכן..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
          ) : (
            <Save className="h-4 w-4 ml-2" />
          )}
          {mode === "create" ? "צור ליד" : "שמור שינויים"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          ביטול
        </Button>
      </div>
    </form>
  )
}
