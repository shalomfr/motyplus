"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle, AlertTriangle, CreditCard, Loader2, Wallet, Receipt,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import type { BalanceDetails } from "@/lib/services/customer-balance.service"
import { QuoteWizardDialog } from "./quote-wizard-dialog"

interface CustomerBalanceCardProps {
  customerId: number
  customerName: string
  customerEmail: string
  amountPaid: number
  onStatusChange?: () => void
}

const STATUS_CONFIG = {
  fully_updated: { label: "מעודכן", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  missing_updates: { label: "חסרים עדכונים", color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
  half_set: { label: "חלקי סט", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CreditCard },
} as const

export function CustomerBalanceCard({ customerId, customerName, customerEmail, amountPaid, onStatusChange }: CustomerBalanceCardProps) {
  const { toast } = useToast()
  const [details, setDetails] = useState<BalanceDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false)

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
  if (!details.organSupportsUpdates) return null

  const config = STATUS_CONFIG[details.type]
  const Icon = config.icon
  const progressPercent = computeProgress(details)
  const updateProgressPercent = details.totalUpdates > 0
    ? Math.round((details.completedUpdates / details.totalUpdates) * 100)
    : 100
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n)

  return (
    <>
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

          {/* Update progress bar */}
          {details.totalUpdates > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>מצב עדכונים: {details.currentVersion || "—"} מתוך {details.latestVersion || "—"}</span>
                <span>{updateProgressPercent}%</span>
              </div>
              <Progress
                value={updateProgressPercent}
                className={cn(
                  "h-2.5",
                  details.completedUpdates >= details.totalUpdates ? "[&>div]:bg-green-500" : "[&>div]:bg-amber-500"
                )}
              />
            </div>
          )}

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

          {/* Single Quote Wizard button */}
          {details.totalOwed > 0 && (
            <div className="pt-2">
              <Button
                className="w-full gap-2"
                onClick={() => setQuoteWizardOpen(true)}
              >
                <Receipt className="h-4 w-4" />
                הצעת מחיר — {formatCurrency(details.totalOwed)}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <QuoteWizardDialog
        open={quoteWizardOpen}
        onOpenChange={setQuoteWizardOpen}
        customerId={customerId}
        customerName={customerName}
        customerEmail={customerEmail}
        amountPaid={amountPaid}
        onSuccess={onStatusChange}
      />
    </>
  )
}

function computeProgress(details: BalanceDetails): number {
  if (details.totalOwed === 0) return 100
  const total = details.amountPaid + details.totalOwed
  if (total === 0) return 100
  return Math.round((details.amountPaid / total) * 100)
}
