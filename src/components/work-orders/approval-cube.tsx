"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  CheckCircle,
  Loader2,
  Search,
  ExternalLink,
  UserCheck,
} from "lucide-react"

interface ApprovalCustomer {
  id: number
  fullName: string
  email: string
  phone: string
  organName: string
  setTypeName: string
  amountPaid: number
  createdAt: string
}

interface ApprovalCubeProps {
  customers: ApprovalCustomer[]
  onRefresh: () => void
}

export function ApprovalCube({ customers, onRefresh }: ApprovalCubeProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [approvingId, setApprovingId] = useState<number | null>(null)

  const handleApprove = async (customerId: number) => {
    setApprovingId(customerId)
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      })
      if (!res.ok) throw new Error("שגיאה באישור")
      toast({ title: "הלקוח אושר בהצלחה", variant: "success" as "default" })
      onRefresh()
    } catch {
      toast({ title: "שגיאה באישור הלקוח", variant: "destructive" })
    } finally {
      setApprovingId(null)
    }
  }

  const filtered = customers.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.fullName.toLowerCase().includes(q) ||
      String(c.id).includes(q) ||
      c.email.toLowerCase().includes(q)
    )
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">אישור לקוחות</CardTitle>
        <p className="text-sm text-muted-foreground">
          {customers.length} לקוחות ממתינים לא��שור
        </p>
      </CardHeader>
      <CardContent>
        {customers.length > 5 && (
          <div className="relative mb-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי שם, מייל או מזהה..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {customers.length === 0 ? (
              <>
                <UserCheck className="h-10 w-10 mx-auto mb-2 text-green-500 opacity-60" />
                <p>אין לקוחות ממתינים לאישור</p>
              </>
            ) : (
              <p>לא נמצאו תוצאות</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-gray-400">{c.id}</span>
                  <Link
                    href={`/customers/${c.id}`}
                    className="font-medium text-blue-700 hover:underline flex items-center gap-1 truncate"
                  >
                    {c.fullName}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </Link>
                  <span className="text-xs text-gray-400">{c.organName}</span>
                  <span className="text-xs text-gray-400">{c.setTypeName}</span>
                  {c.amountPaid > 0 && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200">
                      שילם
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50 shrink-0"
                  onClick={() => handleApprove(c.id)}
                  disabled={approvingId === c.id}
                >
                  {approvingId === c.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3 w-3 ml-1" />
                  )}
                  אשר
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
