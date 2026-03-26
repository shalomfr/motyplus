"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EmailInput } from "@/components/ui/email-input"
import { Badge } from "@/components/ui/badge"
import { WorkListTable } from "@/components/updates/work-list-table"
import { ArrowRight, Loader2, ListChecks, SendHorizonal, Search, Mail, UserPlus } from "lucide-react"

interface WorkCustomer {
  id: number
  fullName: string
  organ: { id: string; name: string }
  email: string
  phone: string
  currentUpdateVersion: string | null
  status: string
  infoUploaded: boolean
  samplesReady: boolean
  sent: boolean
}

interface Organ {
  id: string
  name: string
}

interface SearchResult {
  id: number
  fullName: string
  email: string
  customerId: string
  status: string
  organ: { name: string } | null
}

export default function UpdateWorkPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [customers, setCustomers] = useState<WorkCustomer[]>([])
  const [organs, setOrgans] = useState<Organ[]>([])
  const [loading, setLoading] = useState(true)
  const [updateVersion, setUpdateVersion] = useState("")
  const [sendingAll, setSendingAll] = useState(false)
  const [sendAllResult, setSendAllResult] = useState<{
    sent: number; emailSent: number; emailSkipped: number; failed: number; skippedNoFile: number; total: number
  } | null>(null)

  // שליחה ידנית — חיפוש לקוח
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [sendingCustomer, setSendingCustomer] = useState<number | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // שליחה ידנית — מייל
  const [manualEmail, setManualEmail] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [manualResult, setManualResult] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [workRes, organsRes] = await Promise.all([
        fetch(`/api/updates/${id}/work`),
        fetch("/api/data/organs"),
      ])

      if (workRes.ok) {
        const workData = await workRes.json()
        setCustomers(workData.customers || [])
        setUpdateVersion(workData.version || "")
      }

      if (organsRes.ok) {
        const organsData = await organsRes.json()
        setOrgans(organsData.organs || organsData || [])
      }
    } catch (err) {
      console.error("Error fetching work data:", err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    fetchData()
  }

  // חיפוש לקוחות
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.customers || [])
          setShowResults(true)
        }
      } catch (err) {
        console.error("Search error:", err)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // סגירת תוצאות בלחיצה מחוץ
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // שליחה ללקוח שנבחר (force)
  const handleSendToCustomer = async (customerId: number, customerName: string) => {
    if (!confirm(`לשלוח את העדכון ל-${customerName}?`)) return
    setSendingCustomer(customerId)
    setManualResult(null)
    try {
      const res = await fetch(`/api/updates/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: [customerId], force: true }),
      })
      const data = await res.json()
      if (res.ok) {
        setManualResult(`נשלח בהצלחה ל-${customerName}`)
        setSearchQuery("")
        setShowResults(false)
        fetchData()
      } else {
        setManualResult(`שגיאה: ${data.error}`)
      }
    } catch {
      setManualResult("שגיאה בשליחה")
    } finally {
      setSendingCustomer(null)
    }
  }

  // שליחה למייל ידני
  const handleSendToEmail = async () => {
    if (!manualEmail || !manualEmail.includes("@")) return
    if (!confirm(`לשלוח את העדכון ל-${manualEmail}?`)) return
    setSendingEmail(true)
    setManualResult(null)
    try {
      const res = await fetch(`/api/updates/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: manualEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setManualResult(`נשלח בהצלחה ל-${manualEmail}`)
        setManualEmail("")
      } else {
        setManualResult(`שגיאה: ${data.error}`)
      }
    } catch {
      setManualResult("שגיאה בשליחה")
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSendAll = async () => {
    if (!confirm("האם לשלוח את העדכון לכל הלקוחות הזכאים? פעולה זו תשלח מייל ו-WhatsApp לכולם.")) return
    setSendingAll(true)
    setSendAllResult(null)
    try {
      const res = await fetch(`/api/updates/${id}/send-all`, { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setSendAllResult({
          sent: data.sent,
          emailSent: data.emailSent || 0,
          emailSkipped: data.emailSkipped || 0,
          failed: data.failed,
          skippedNoFile: data.skippedNoFile,
          total: data.total,
        })
        fetchData()
      } else {
        alert(data.error || "שגיאה בשליחה לכולם")
      }
    } catch (err) {
      console.error("Error sending to all:", err)
      alert("שגיאה בשליחה לכולם")
    } finally {
      setSendingAll(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const readyCount = customers.filter((c) => c.infoUploaded && c.samplesReady && !c.sent).length
  const sentCount = customers.filter((c) => c.sent).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/updates/${id}`)}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
            רשימת עבודה - {updateVersion}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {customers.length} לקוחות זכאים | {readyCount} מוכנים לשליחה | {sentCount} נשלחו
          </p>
        </div>
        <Button
          onClick={handleSendAll}
          disabled={sendingAll}
        >
          {sendingAll ? (
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4 ml-2" />
          )}
          שלח לכולם
        </Button>
      </div>

      {/* שליחה ידנית */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            שליחה ידנית
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* חיפוש לקוח */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">בחירת לקוח (ללא פילטר זכאות)</label>
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="חפש לפי שם, מייל או מזהה..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                    className="pr-10"
                  />
                  {searchLoading && (
                    <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSendToCustomer(c.id, c.fullName)}
                        disabled={sendingCustomer === c.id}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0 text-right disabled:opacity-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{c.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.customerId} | {c.email} {c.organ && `| ${c.organ.name}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mr-3">
                          <Badge variant="outline" className="text-xs">{c.status}</Badge>
                          {sendingCustomer === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SendHorizonal className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showResults && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-center text-sm text-muted-foreground">
                    לא נמצאו לקוחות
                  </div>
                )}
              </div>
            </div>

            {/* מייל ידני */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">שליחה למייל ידני</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <EmailInput
                    placeholder="example@mail.com"
                    value={manualEmail}
                    onValueChange={(val) => setManualEmail(val)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendToEmail()}
                    className="pr-10"
                    dir="ltr"
                  />
                </div>
                <Button
                  onClick={handleSendToEmail}
                  disabled={sendingEmail || !manualEmail.includes("@")}
                >
                  {sendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SendHorizonal className="h-4 w-4 ml-2" />
                  )}
                  שלח
                </Button>
              </div>
            </div>
          </div>

          {manualResult && (
            <div className={`mt-3 rounded-lg border p-3 text-sm ${
              manualResult.startsWith("שגיאה")
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}>
              {manualResult}
            </div>
          )}
        </CardContent>
      </Card>

      {sendAllResult && (
        <div className="rounded-lg border border-blue-200 bg-orange-50 p-4">
          <p className="font-medium text-blue-800">
            תוצאות שליחה לכולם: נשלח ל-{sendAllResult.sent} לקוחות | {sendAllResult.emailSent} מיילים נשלחו
            {sendAllResult.emailSkipped > 0 && ` | ${sendAllResult.emailSkipped} ללא תבנית מייל`}
            {sendAllResult.skippedNoFile > 0 && ` | ${sendAllResult.skippedNoFile} דולגו (אין קובץ CPI)`}
            {sendAllResult.failed > 0 && ` | ${sendAllResult.failed} נכשלו`}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            לקוחות זכאים לעדכון
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkListTable
            updateId={id}
            customers={customers}
            organs={organs}
            onRefresh={handleRefresh}
          />
        </CardContent>
      </Card>
    </div>
  )
}
