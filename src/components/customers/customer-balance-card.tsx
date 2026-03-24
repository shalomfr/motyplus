"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle, AlertTriangle, CreditCard, Copy, Loader2, ExternalLink, Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import type { BalanceDetails } from "@/lib/services/customer-balance.service"

interface CustomerBalanceCardProps {
  customerId: number
  amountPaid: number
}

const STATUS_CONFIG = {
  fully_updated: { label: "מעודכן", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  missing_updates: { label: "חסרים עדכונים", color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
  half_set: { label: "חצי סט", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CreditCard },
} as const

export function CustomerBalanceCard({ customerId, amountPaid }: CustomerBalanceCardProps) {
  const { toast } = useToast()
  const [details, setDetails] = useState<BalanceDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingLink, setCreatingLink] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}/balance`)
      if (res.ok) setDetails(await res.json())
    } catch {
      toast({ title: "שגיאה בטעינת מצב עדכונים", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [customerId, toast])

  useEffect(() => { fetchBalance() }, [fetchBalance])

  const handleCreatePaymentLink = async () => {
    setCreatingLink(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/payment-link`, { method: "POST" })
      if (!res.ok) throw new Error("failed")
      const data = await res.json()
      setPaymentUrl(data.url)
      toast({ title: "לינק תשלום נוצר בהצלחה" })
    } catch {
      toast({ title: "שגיאה ביצירת לינק תשלום", variant: "destructive" })
    } finally {
      setCreatingLink(false)
    }
  }

  const copyLink = () => {
    if (!paymentUrl) return
    navigator.clipboard.writeText(paymentUrl)
    toast({ title: "הלינק הועתק" })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!details) return null

  const config = STATUS_CONFIG[details.type]
  const Icon = config.icon
  const progressPercent = computeProgress(details)
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            מצב עדכונים וחוב
          </CardTitle>
          <Badge variant="outline" className={cn("text-xs", config.color)}>
            <Icon className="h-3 w-3 ml-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>שולם: {formatCurrency(amountPaid)}</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress
            value={progressPercent}
            className={cn(
              "h-2.5",
              details.totalOwed === 0 ? "[&>div]:bg-green-500" : "[&>div]:bg-orange-500"
            )}
          />
        </div>

        {/* Total owed */}
        <div className="flex items-center justify-between py-2 border-t border-b">
          <span className="text-sm font-medium">נותר לתשלום</span>
          <span className={cn(
            "text-xl font-bold",
            details.totalOwed > 0 ? "text-red-600" : "text-green-600"
          )}>
            {details.totalOwed > 0 ? formatCurrency(details.totalOwed) : "שולם במלואו"}
          </span>
        </div>

        {/* Version info */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">גרסה נוכחית</span>
          <span className="font-medium">{details.currentVersion || "—"}</span>
        </div>
        {details.latestVersion && details.latestVersion !== details.currentVersion && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">גרסה אחרונה</span>
            <span className="font-medium">{details.latestVersion}</span>
          </div>
        )}

        {/* Missing updates list */}
        {details.missingUpdates.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">עדכונים חסרים:</span>
            {details.missingUpdates.map((u) => (
              <div key={u.version} className="flex items-center justify-between text-sm bg-orange-50 rounded px-3 py-1.5 border border-orange-100">
                <span className="font-medium">{u.version}</span>
                <span className="text-orange-700 font-semibold">{formatCurrency(u.price)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Half set info */}
        {details.type === "half_set" && details.setCompletionCost != null && details.setCompletionCost > 0 && (
          <div className="text-sm bg-blue-50 rounded px-3 py-2 border border-blue-100">
            <span className="text-muted-foreground">להשלמת סט שלם: </span>
            <span className="font-bold text-blue-700">{formatCurrency(details.setCompletionCost)}</span>
          </div>
        )}

        {/* Payment link */}
        {details.totalOwed > 0 && (
          <div className="pt-2 space-y-2">
            {!paymentUrl ? (
              <Button
                className="w-full gap-2"
                onClick={handleCreatePaymentLink}
                disabled={creatingLink}
              >
                {creatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                צור לינק תשלום — {formatCurrency(details.totalOwed)}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={copyLink}>
                    <Copy className="h-3 w-3" /> העתק לינק
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" asChild>
                    <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" /> פתח
                    </a>
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center truncate" dir="ltr">
                  {paymentUrl}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function computeProgress(details: BalanceDetails): number {
  if (details.totalOwed === 0) return 100
  const total = details.amountPaid + details.totalOwed
  if (total === 0) return 100
  return Math.round((details.amountPaid / total) * 100)
}
