"use client"

import React, { useState, useEffect, useCallback } from "react"
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
import { Plus, FileSpreadsheet, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const PAGE_SIZE = 20

export default function CustomersListPage() {
  const { toast } = useToast()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [filters, setFilters] = useState<CustomerFilters>(defaultFilters)

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", page.toString())
      params.set("pageSize", PAGE_SIZE.toString())

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

      const res = await fetch(`/api/customers?${params.toString()}`)
      if (!res.ok) throw new Error("שגיאה בטעינת הנתונים")

      const data = await res.json()
      setCustomers(data.customers || [])
      setTotalCount(data.totalCount || 0)
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את רשימת הלקוחות",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [page, filters, toast])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleFiltersChange = (newFilters: CustomerFilters) => {
    setFilters(newFilters)
    setPage(1)
  }

  const handleClearFilters = () => {
    setFilters(defaultFilters)
    setPage(1)
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set("export", "excel")

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

      const res = await fetch(`/api/customers?${params.toString()}`)
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
        <div className="flex items-center gap-2">
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
          <Link href="/customers/new">
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              הוסף לקוח
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <CustomerFiltersPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClear={handleClearFilters}
      />

      {/* Results Table */}
      <CustomerTable
        customers={customers}
        isLoading={isLoading}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
