"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  Copy,
  Check,
  ExternalLink,
  Search,
  Package,
} from "lucide-react"

interface SetCustomer {
  id: number
  fullName: string
  email: string
  phone: string
  customerId: string | null
  organName: string
  setTypeName: string
  amountPaid: number
}

interface SetSendingCubeProps {
  customers: SetCustomer[]
  onRefresh: () => void
}

export function SetSendingCube({ customers, onRefresh }: SetSendingCubeProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(label)
    setTimeout(() => setCopiedId(null), 1500)
    toast({ title: `${label} הועתק`, variant: "success" as "default" })
  }

  const filtered = customers.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.fullName.toLowerCase().includes(q) ||
      String(c.id).includes(q) ||
      (c.customerId && c.customerId.includes(q))
    )
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">לקוחות חדשים</CardTitle>
        <p className="text-sm text-muted-foreground">
          {customers.length} לקוחות ששילמו וממתינים לקבלת הסט
        </p>
      </CardHeader>
      <CardContent>
        {customers.length > 5 && (
          <div className="relative mb-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי שם או מזהה..."
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
                <Package className="h-10 w-10 mx-auto mb-2 text-green-500 opacity-60" />
                <p>כל הסטים נשלחו!</p>
              </>
            ) : (
              <p>לא נמצאו תוצאות</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filtered.map((c) => {
              const displayId = c.customerId || String(c.id)
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-gray-400">
                      {displayId}
                    </span>
                    <span className="font-medium truncate">{c.fullName}</span>
                    <span className="text-xs text-gray-400">{c.organName}</span>
                    <span className="text-xs text-gray-400">{c.setTypeName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Copy ID */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => copyToClipboard(displayId, `מזהה ${displayId}`)}
                    >
                      {copiedId === `מזהה ${displayId}` ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span className="mr-1">מזהה</span>
                    </Button>

                    {/* Go to customer */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                      onClick={() => router.push(`/customers/${c.id}`)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="mr-1">כניסה ללקוח</span>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
