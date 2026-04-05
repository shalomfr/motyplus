"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  CustomerFiltersPanel,
  defaultFilters,
  type CustomerFilters,
} from "@/components/customers/customer-filters"
import {
  CustomerTable,
  type CustomerRow,
} from "@/components/customers/customer-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Plus, FileSpreadsheet, Loader2, Upload, Trash2, CheckCircle, AlertCircle, XCircle, RefreshCw, Send } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { NewOrderWizardDialog } from "@/components/customers/new-order-wizard-dialog"

const PAGE_SIZE = 20

interface ImportResult {
  created: number
  skipped: number
  skippedDetails?: { row: number; customerId: string; reason: string }[]
  errors: { row: number; customerId: string; error: string }[]
  batchTag: string
  total: number
}

export default function CustomersListPage() {
  const { toast } = useToast()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [filters, setFilters] = useState<CustomerFilters>(defaultFilters)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [lastBatchTag, setLastBatchTag] = useState<string | null>(null)
  const [isDeletingImport, setIsDeletingImport] = useState(false)
  const [isSyncingInfo, setIsSyncingInfo] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchCustomers = useCallback(async (append = false) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    try {
      const params = new URLSearchParams()
      params.set("page", page.toString())
      params.set("limit", PAGE_SIZE.toString())

      if (filters.search) params.set("search", filters.search)
      if (filters.organId && filters.organId !== "all")
        params.set("organId", filters.organId)
      if (filters.setTypeId && filters.setTypeId !== "all")
        params.set("setTypeId", filters.setTypeId)
      if (filters.status && filters.status !== "all")
        params.set("status", filters.status)
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
      if (filters.dateTo) params.set("dateTo", filters.dateTo)
      if (filters.missingDetails)
        params.set("missingDetails", "true")
      if (filters.missingField)
        params.set("missingField", filters.missingField)
      if (filters.maxUpdateVersion && filters.maxUpdateVersion !== "all")
        params.set("maxUpdateVersion", filters.maxUpdateVersion)

      const res = await fetch(`/api/customers?${params.toString()}`)
      if (!res.ok) throw new Error("שגיאה בטעינת הנתונים")

      const data = await res.json()
      const mapped = (data.customers || []).map((c: {
          id: number; fullName: string; phone: string; email: string;
          amountPaid?: number;
          organ?: { name: string; supportsUpdates?: boolean }; setType?: { name: string; price?: number; includesUpdates?: boolean };
          promotion?: { discountPercent: number; couponCode: string } | null;
          status: "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION"; updatedAt: string;
          currentUpdateVersion?: string | null; infoFileUrl?: string | null;
          discountReason?: string | null;
        }) => ({
          ...c,
          organName: c.organ?.name || "",
          setTypeName: c.setType?.name || "",
          setTypePrice: Number(c.setType?.price || 0),
          fullSetPrice: Number(data.fullSetPrice || 0),
          amountPaid: Number(c.amountPaid || 0),
          currentUpdateVersion: c.currentUpdateVersion || null,
          includesUpdates: c.setType?.includesUpdates ?? false,
          organSupportsUpdates: c.organ?.supportsUpdates ?? false,
          infoFileUrl: c.infoFileUrl || null,
          discountPercent: c.promotion?.discountPercent || null,
          discountReason: c.discountReason || null,
        }))
      if (append) {
        setCustomers(prev => [...prev, ...mapped])
      } else {
        setCustomers(mapped)
      }
      setLatestVersion(data.latestVersion || null)
      setTotalCount(data.pagination?.total || 0)
      setHasMore(page * PAGE_SIZE < (data.pagination?.total || 0))
    } catch (error) {
      setHasMore(false)
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את רשימת הלקוחות",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [page, filters, toast])

  useEffect(() => {
    if (page === 1) {
      fetchCustomers(false)
    } else {
      fetchCustomers(true)
    }
  }, [fetchCustomers])

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          setPage(prev => prev + 1)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, isLoading, isLoadingMore])

  const handleFiltersChange = (newFilters: CustomerFilters) => {
    setIsLoading(true)
    setFilters(newFilters)
    setPage(1)
    setCustomers([])
    setHasMore(true)
  }

  const handleClearFilters = () => {
    setIsLoading(true)
    setFilters(defaultFilters)
    setPage(1)
    setCustomers([])
    setHasMore(true)
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()

      if (filters.search) params.set("search", filters.search)
      if (filters.organId && filters.organId !== "all")
        params.set("organId", filters.organId)
      if (filters.setTypeId && filters.setTypeId !== "all")
        params.set("setTypeId", filters.setTypeId)
      if (filters.status && filters.status !== "all")
        params.set("status", filters.status)
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
      if (filters.dateTo) params.set("dateTo", filters.dateTo)
      if (filters.missingDetails)
        params.set("missingDetails", "true")
      if (filters.missingField)
        params.set("missingField", filters.missingField)
      if (filters.maxUpdateVersion && filters.maxUpdateVersion !== "all")
        params.set("maxUpdateVersion", filters.maxUpdateVersion)

      const res = await fetch(`/api/customers/export?${params.toString()}`)
      if (!res.ok) throw new Error("שגיאה בייצוא")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `customers-${new Date().toISOString().split("T")[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "הקובץ יורד",
        description: "קובץ האקסל מוכן להורדה",
        variant: "success" as "default",
      })
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לייצא את הנתונים",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleToggleSuspend = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "FROZEN" ? "ACTIVE" : "FROZEN"
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      toast({
        title: newStatus === "FROZEN" ? "הלקוח הושהה" : "הלקוח חודש",
        variant: "success" as "default",
      })
      fetchCustomers()
    } catch {
      toast({ title: "שגיאה בשינוי סטטוס", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number, fullName: string) => {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({
        title: "הלקוח נמחק",
        description: fullName,
        variant: "success" as "default",
      })
      fetchCustomers()
    } catch {
      toast({ title: "שגיאה במחיקת הלקוח", variant: "destructive" })
    }
  }

  // ===== Import handlers =====

  const handleImportClick = () => {
    setImportResult(null)
    setImportDialogOpen(true)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/customers/import", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: "שגיאה בייבוא",
          description: data.error || "שגיאה לא ידועה",
          variant: "destructive",
        })
        return
      }

      setImportResult(data)
      setLastBatchTag(data.batchTag)
      fetchCustomers()

      if (data.created > 0) {
        toast({
          title: "הייבוא הושלם — מסנכרן אינפו...",
          description: `${data.created} לקוחות יובאו, בודק קבצי אינפו בדרייב...`,
          variant: "success" as "default",
        })
        // סנכרון אינפו אוטומטי אחרי ייבוא
        fetch("/api/customers/sync-info", { method: "POST" })
          .then(r => r.json())
          .then(syncData => {
            if (syncData.updated > 0) {
              toast({
                title: "סנכרון אינפו הושלם",
                description: `${syncData.updated} לקוחות עודכנו עם קובץ אינפו`,
                variant: "success" as "default",
              })
              fetchCustomers()
            }
          })
          .catch(() => {})
      }
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "שגיאה בייבוא הקובץ",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
      // Reset file input so re-selecting the same file works
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDeleteImport = async () => {
    const confirmed = window.confirm(
      `האם למחוק את כל הלקוחות שיובאו מקובץ CSV?`
    )
    if (!confirmed) return

    setIsDeletingImport(true)
    try {
      // אם יש batch ספציפי — מחק אותו, אחרת מחק הכל
      const batchParam = lastBatchTag ? `?batch=${lastBatchTag}` : "?batch=ALL"
      const res = await fetch(
        `/api/customers/import${batchParam}`,
        { method: "DELETE" }
      )
      const data = await res.json()

      if (!res.ok) {
        toast({
          title: "שגיאה",
          description: data.error || "שגיאה במחיקה",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "הייבוא נמחק",
        description: `${data.deleted} לקוחות נמחקו`,
        variant: "success" as "default",
      })

      setLastBatchTag(null)
      setImportResult(null)
      setImportDialogOpen(false)
      fetchCustomers()
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "שגיאה במחיקת הייבוא",
        variant: "destructive",
      })
    } finally {
      setIsDeletingImport(false)
    }
  }

  const handleSyncInfo = async () => {
    setIsSyncingInfo(true)
    try {
      const res = await fetch("/api/customers/sync-info", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        toast({
          title: "סנכרון אינפו הושלם",
          description: data.message,
          variant: "success" as "default",
        })
        fetchCustomers()
      } else {
        toast({ title: "שגיאה", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "שגיאה בסנכרון", variant: "destructive" })
    } finally {
      setIsSyncingInfo(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            רשימת לקוחות
          </h1>
          <p className="text-muted-foreground mt-1">
            {!isLoading && `סה"כ ${totalCount} לקוחות`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncInfo}
            disabled={isSyncingInfo}
          >
            {isSyncingInfo ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 ml-2" />
            )}
            סנכרן אינפו
          </Button>
          <Button
            variant="outline"
            onClick={handleImportClick}
          >
            <Upload className="h-4 w-4 ml-2" />
            ייבוא מ-CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 ml-2" />
            )}
            ייצוא לאקסל
          </Button>
          <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
            <Send className="h-4 w-4 ml-2" />
            הזמן לקוח
          </Button>
          <Link href="/customers/new">
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              הוסף לקוח
            </Button>
          </Link>
        </div>
      </div>

      {/* Delete imported customers banner — always visible */}
      {!importDialogOpen && (
        <div className="flex items-center justify-between glass border border-blue-200 rounded-lg p-3">
          <span className="text-sm text-blue-700">
            מחיקת כל הלקוחות שיובאו מקובץ CSV
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteImport}
            disabled={isDeletingImport}
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            {isDeletingImport ? (
              <Loader2 className="h-4 w-4 ml-1 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 ml-1" />
            )}
            מחק ייבוא אחרון
          </Button>
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>ייבוא לקוחות מקובץ CSV</DialogTitle>
            <DialogDescription>
              בחר קובץ CSV לייבוא. שורות עם קוד לקוח קיים ידלגו אוטומטית.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* File input */}
            {!isImporting && !importResult && (
              <div className="flex flex-col items-center gap-4">
                <label
                  htmlFor="csv-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-white/5 transition-colors text-gray-300"
                >
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    לחץ לבחירת קובץ CSV
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    UTF-8, מופרד בפסיקים
                  </span>
                </label>
                <input
                  ref={fileInputRef}
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}

            {/* Loading */}
            {isImporting && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                <p className="text-sm text-gray-600">מייבא לקוחות...</p>
                <Progress value={50} className="w-full" indicatorClassName="bg-orange-500" />
              </div>
            )}

            {/* Results */}
            {importResult && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 mb-1" />
                    <span className="text-lg font-bold text-green-700">
                      {importResult.created}
                    </span>
                    <span className="text-xs text-green-600">יובאו</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-yellow-50 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mb-1" />
                    <span className="text-lg font-bold text-yellow-700">
                      {importResult.skipped}
                    </span>
                    <span className="text-xs text-yellow-600">דולגו</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-red-50 rounded-lg">
                    <XCircle className="h-5 w-5 text-red-600 mb-1" />
                    <span className="text-lg font-bold text-red-700">
                      {importResult.errors.length}
                    </span>
                    <span className="text-xs text-red-600">שגיאות</span>
                  </div>
                </div>

                <p className="text-sm text-gray-500 text-center">
                  סה&quot;כ {importResult.total} שורות עובדו
                </p>

                {/* Error details */}
                {importResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-sm font-medium text-red-800 mb-2">
                      פירוט שגיאות:
                    </p>
                    <ul className="text-xs text-red-700 space-y-1">
                      {importResult.errors.slice(0, 20).map((err, i) => (
                        <li key={i}>
                          שורה {err.row} (קוד {err.customerId}): {err.error}
                        </li>
                      ))}
                      {importResult.errors.length > 20 && (
                        <li className="font-medium">
                          ...ועוד {importResult.errors.length - 20} שגיאות
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Skipped details */}
                {importResult.skippedDetails && importResult.skippedDetails.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-sm font-medium text-yellow-800 mb-2">
                      פירוט דילוגים:
                    </p>
                    <ul className="text-xs text-yellow-700 space-y-1">
                      {importResult.skippedDetails.slice(0, 30).map((s, i) => (
                        <li key={i}>
                          שורה {s.row} (קוד {s.customerId}): {s.reason}
                        </li>
                      ))}
                      {importResult.skippedDetails.length > 30 && (
                        <li className="font-medium">
                          ...ועוד {importResult.skippedDetails.length - 30} דילוגים
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-2">
                  {importResult.created > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteImport}
                      disabled={isDeletingImport}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      {isDeletingImport ? (
                        <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 ml-1" />
                      )}
                      בטל ייבוא
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      setImportDialogOpen(false)
                      setImportResult(null)
                    }}
                  >
                    סגור
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <CustomerFiltersPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClear={handleClearFilters}
      />

      {/* Results Table */}
      <CustomerTable
        customers={customers}
        isLoading={isLoading && page === 1}
        onToggleSuspend={handleToggleSuspend}
        onDelete={handleDelete}
        onApprove={async (id) => {
          try {
            const res = await fetch(`/api/customers/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "approve" }),
            })
            if (res.ok) {
              setPage(1)
              setCustomers([])
              fetchCustomers(false)
            }
          } catch { /* */ }
        }}
        totalCount={totalCount}
        page={1}
        pageSize={customers.length || PAGE_SIZE}
        latestVersion={latestVersion}
        onPageChange={() => {}}
      />

      {/* Infinite scroll sentinel */}
      <div ref={loadMoreRef} className="flex items-center justify-center py-4">
        {isLoadingMore && (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
        {!hasMore && customers.length > 0 && (
          <p className="text-sm text-muted-foreground">הוצגו כל {totalCount} הלקוחות</p>
        )}
      </div>

      <NewOrderWizardDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />
    </div>
  )
}
