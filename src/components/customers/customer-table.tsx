"use client"

import React from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil, Eye, ChevronRight, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils"

export interface CustomerRow {
  id: number
  fullName: string
  phone: string
  email: string
  organName: string
  setTypeName: string
  status: "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION"
  updatedAt: string
}

interface CustomerTableProps {
  customers: CustomerRow[]
  isLoading: boolean
  totalCount: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "פעיל",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  BLOCKED: {
    label: "חסום",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  FROZEN: {
    label: "מוקפא",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  EXCEPTION: {
    label: "חריג",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
}

function CustomerTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-20" />
        </div>
      ))}
    </div>
  )
}

export function CustomerTable({
  customers,
  isLoading,
  totalCount,
  page,
  pageSize,
  onPageChange,
}: CustomerTableProps) {
  const totalPages = Math.ceil(totalCount / pageSize)

  if (isLoading) {
    return (
      <div className="rounded-md border bg-white">
        <div className="p-4">
          <CustomerTableSkeleton />
        </div>
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-md border bg-white p-12 text-center">
        <p className="text-muted-foreground text-lg">לא נמצאו לקוחות</p>
        <p className="text-muted-foreground text-sm mt-2">
          נסה לשנות את הסינון או להוסיף לקוח חדש
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[70px]">מזהה</TableHead>
              <TableHead>שם מלא</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>מייל</TableHead>
              <TableHead>אורגן</TableHead>
              <TableHead>סט</TableHead>
              <TableHead className="w-[100px]">מצב</TableHead>
              <TableHead>עדכון אחרון</TableHead>
              <TableHead className="w-[100px]">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => {
              const status = statusConfig[customer.status] || statusConfig.ACTIVE
              return (
                <TableRow key={customer.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-muted-foreground">
                    {customer.id}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {customer.fullName}
                    </Link>
                  </TableCell>
                  <TableCell dir="ltr" className="text-right">
                    {customer.phone}
                  </TableCell>
                  <TableCell dir="ltr" className="text-right">
                    {customer.email}
                  </TableCell>
                  <TableCell>{customer.organName}</TableCell>
                  <TableCell>{customer.setTypeName}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("font-normal", status.className)}
                    >
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(customer.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/customers/${customer.id}`}>
                        <Button variant="ghost" size="icon" title="צפייה">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/customers/${customer.id}`}>
                        <Button variant="ghost" size="icon" title="עריכה">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          מציג {(page - 1) * pageSize + 1}-
          {Math.min(page * pageSize, totalCount)} מתוך {totalCount} לקוחות
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronRight className="h-4 w-4" />
            הקודם
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }

              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "default" : "outline"}
                  size="sm"
                  className="w-9"
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            הבא
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
