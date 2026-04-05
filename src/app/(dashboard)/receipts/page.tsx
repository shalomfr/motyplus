"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Receipt, Loader2, ExternalLink, Search, ChevronRight, ChevronLeft } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import Link from "next/link"

interface ReceiptRow {
  id: string
  receiptNumber: string | null
  receiptUrl: string | null
  amount: number
  description: string | null
  paymentMethod: string | null
  createdAt: string
  customer: {
    id: number
    fullName: string
    email: string
  }
}

const PAGE_SIZE = 20

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const fetchReceipts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/receipts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setReceipts(data.receipts || [])
        setTotalCount(data.pagination?.total || 0)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchReceipts()
  }, [fetchReceipts])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">קבלות</h2>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              רשימת קבלות ({totalCount})
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-64">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="חיפוש לקוח..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="h-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              אין קבלות עדיין
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>מס' קבלה</TableHead>
                    <TableHead>לקוח</TableHead>
                    <TableHead>סכום</TableHead>
                    <TableHead>תיאור</TableHead>
                    <TableHead>אמצעי תשלום</TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead className="w-20">צפייה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">
                        {r.receiptNumber || "-"}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/customers/${r.customer.id}`}
                          className="hover:underline hover:text-primary"
                        >
                          {r.customer.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{formatCurrency(Number(r.amount))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {r.paymentMethod || "לא צוין"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        {r.receiptUrl ? (
                          <a
                            href={r.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="icon">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                  <div className="text-sm text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, totalCount)} מתוך {totalCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">{page} / {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
