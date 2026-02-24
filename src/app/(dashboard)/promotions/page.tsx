"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Percent, Loader2 } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface Promotion {
  id: string
  name: string
  couponCode: string
  discountPercent: number
  validFrom: string
  validUntil: string
  isActive: boolean
  maxUses: number | null
  currentUses: number
  createdAt: string
}

export default function PromotionsPage() {
  const router = useRouter()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const res = await fetch("/api/promotions")
        if (res.ok) {
          const data = await res.json()
          setPromotions(data.promotions || data)
        }
      } catch (err) {
        console.error("Error fetching promotions:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchPromotions()
  }, [])

  const getStatus = (promo: Promotion) => {
    const now = new Date()
    const from = new Date(promo.validFrom)
    const until = new Date(promo.validUntil)

    if (!promo.isActive) return { label: "לא פעיל", className: "bg-gray-100 text-gray-800 border-gray-200" }
    if (now < from) return { label: "עתידי", className: "bg-blue-100 text-blue-800 border-blue-200" }
    if (now > until) return { label: "פג תוקף", className: "bg-red-100 text-red-800 border-red-200" }
    if (promo.maxUses && promo.currentUses >= promo.maxUses) return { label: "מלא", className: "bg-orange-100 text-orange-800 border-orange-200" }
    return { label: "פעיל", className: "bg-green-100 text-green-800 border-green-200" }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">מבצעים</h2>
        <Button onClick={() => router.push("/promotions/new")}>
          <Plus className="h-4 w-4 ml-2" />
          מבצע חדש
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Percent className="h-5 w-5" />
            רשימת מבצעים
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : promotions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              אין מבצעים. צור מבצע חדש כדי להתחיל.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>קוד קופון</TableHead>
                  <TableHead>הנחה</TableHead>
                  <TableHead>תקופה</TableHead>
                  <TableHead>שימושים</TableHead>
                  <TableHead>סטטוס</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo) => {
                  const status = getStatus(promo)
                  return (
                    <TableRow key={promo.id}>
                      <TableCell className="font-medium">{promo.name}</TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
                          {promo.couponCode}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{promo.discountPercent}%</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(promo.validFrom)} - {formatDate(promo.validUntil)}
                      </TableCell>
                      <TableCell>
                        {promo.currentUses}
                        {promo.maxUses ? ` / ${promo.maxUses}` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.className}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
