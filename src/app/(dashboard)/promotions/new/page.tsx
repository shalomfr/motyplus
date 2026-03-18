"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Save, Loader2, RefreshCw, Link as LinkIcon } from "lucide-react"

function generateCouponCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function NewPromotionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [discountPercent, setDiscountPercent] = useState(10)
  const [couponCode, setCouponCode] = useState("")
  const [validFrom, setValidFrom] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [maxUses, setMaxUses] = useState<string>("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          discountPercent,
          couponCode,
          validFrom,
          validUntil,
          maxUses: maxUses ? parseInt(maxUses) : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "שגיאה ביצירת מבצע")
      }

      router.push("/promotions")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת מבצע")
    } finally {
      setLoading(false)
    }
  }

  const basePaymentUrl = "https://pay.motyplus.com/checkout"
  const previewLink = couponCode
    ? `${basePaymentUrl}?coupon=${couponCode}`
    : basePaymentUrl

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/promotions")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">מבצע חדש</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">פרטי המבצע</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם המבצע</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: מבצע חורף 2025"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountPercent">אחוז הנחה</Label>
                <Input
                  id="discountPercent"
                  type="number"
                  min={1}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="couponCode">קוד קופון</Label>
                <div className="flex gap-2">
                  <Input
                    id="couponCode"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="SUMMER25"
                    dir="ltr"
                    className="text-left font-mono"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCouponCode(generateCouponCode())}
                    title="צור קוד אוטומטי"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">תקף מתאריך</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">תקף עד תאריך</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUses">מקסימום שימושים (אופציונלי)</Label>
              <Input
                id="maxUses"
                type="number"
                min={0}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="ללא הגבלה"
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment link preview */}
        {couponCode && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                תצוגת קישור תשלום עם הנחה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium mb-1">קישור תשלום עם קופון:</p>
                <code className="text-xs text-blue-600 break-all" dir="ltr">
                  {previewLink}
                </code>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * הקישור מדגים כיצד ייראה קישור התשלום עם קוד הקופון {couponCode} ({discountPercent}% הנחה)
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <Save className="h-4 w-4 ml-2" />
            )}
            צור מבצע
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/promotions")}
          >
            ביטול
          </Button>
        </div>
      </form>
    </div>
  )
}
