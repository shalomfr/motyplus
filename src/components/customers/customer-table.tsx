"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil, Eye, ChevronRight, ChevronLeft, PauseCircle, PlayCircle, Trash2, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils"

export interface CustomerRow {
  id: number
  fullName: string
  phone: string
  email: string
  organName: string
  setTypeName: string
  status: "PENDING_APPROVAL" | "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION"
  updatedAt: string
  currentUpdateVersion: string | null
  includesUpdates: boolean
  infoFileUrl: string | null
}

interface CustomerTableProps {
  customers: CustomerRow[]
  isLoading: boolean
  totalCount: number
  page: number
  pageSize: number
  latestVersion?: string | null
  onPageChange: (page: number) => void
  onToggleSuspend?: (id: number, currentStatus: string) => Promise<void>
  onDelete?: (id: number, fullName: string) => Promise<void>
  onApprove?: (id: number) => Promise<void>
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  PENDING_APPROVAL: {
    label: "ממתין לאישור",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
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
    className: "bg-orange-100 text-blue-800 border-blue-200",
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
  latestVersion,
  onPageChange,
  onToggleSuspend,
  onDelete,
  onApprove,
}: CustomerTableProps) {
  const totalPages = Math.ceil(totalCount / pageSize)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; fullName: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSuspend = async (id: number, status: string) => {
    if (!onToggleSuspend) return
    setLoadingId(id)
    await onToggleSuspend(id, status)
    setLoadingId(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !onDelete) return
    setIsDeleting(true)
    await onDelete(deleteTarget.id, deleteTarget.fullName)
    setIsDeleting(false)
    setDeleteTarget(null)
  }

  if (isLoading) {
    return (
      <div className="rounded-xl glass-card">
        <div className="p-4">
          <CustomerTableSkeleton />
        </div>
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-xl glass-card p-12 text-center">
        <p className="text-gray-500 text-lg">לא נמצאו לקוחות</p>
        <p className="text-gray-400 text-sm mt-2">
          נסה לשנות את הסינון או להוסיף לקוח חדש
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl">
        <Table>
          <TableHeader>
            <TableRow className="bg-white/5">
              <TableHead className="w-[70px]">מזהה</TableHead>
              <TableHead>שם מלא</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>מייל</TableHead>
              <TableHead>אורגן</TableHead>
              <TableHead>סט</TableHead>
              <TableHead className="w-[100px]">מצב</TableHead>
              <TableHead className="w-[90px]">עדכון</TableHead>
              <TableHead className="w-[40px] text-center">אינפו</TableHead>
              <TableHead className="w-[100px]">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => {
              const status = statusConfig[customer.status] || statusConfig.ACTIVE
              return (
                <TableRow key={customer.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-gray-500">
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
                  <TableCell>
                    {customer.includesUpdates ? (
                      customer.currentUpdateVersion ? (
                        latestVersion && customer.currentUpdateVersion !== latestVersion ? (
                          <Badge variant="outline" className="font-normal bg-red-100 text-red-800 border-red-200">
                            {customer.currentUpdateVersion}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-normal bg-green-100 text-green-800 border-green-200">
                            {customer.currentUpdateVersion}
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="font-normal bg-red-100 text-red-800 border-red-200">
                          לא עודכן
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="font-normal bg-gray-100 text-gray-500 border-gray-200">
                        ללא עדכונים
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "inline-block w-2.5 h-2.5 rounded-full",
                        customer.infoFileUrl ? "bg-green-500" : "bg-red-400"
                      )}
                      title={customer.infoFileUrl ? "יש אינפו" : "אין אינפו"}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {onApprove && customer.status === "PENDING_APPROVAL" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="אשר לקוח"
                          disabled={loadingId === customer.id}
                          onClick={async () => {
                            setLoadingId(customer.id)
                            await onApprove(customer.id)
                            setLoadingId(null)
                          }}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          {loadingId === customer.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Link href={`/customers/${customer.id}`} className={buttonVariants({ variant: "ghost", size: "icon" })} title="צפייה">
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link href={`/customers/${customer.id}`} className={buttonVariants({ variant: "ghost", size: "icon" })} title="עריכה">
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {onToggleSuspend && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={customer.status === "FROZEN" ? "חידוש" : "השהייה"}
                          disabled={loadingId === customer.id}
                          onClick={() => handleSuspend(customer.id, customer.status)}
                          className={customer.status === "FROZEN" ? "text-blue-600 hover:text-blue-700" : "text-amber-600 hover:text-amber-700"}
                        >
                          {loadingId === customer.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : customer.status === "FROZEN" ? (
                            <PlayCircle className="h-4 w-4" />
                          ) : (
                            <PauseCircle className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="מחיקה"
                          onClick={() => setDeleteTarget({ id: customer.id, fullName: customer.fullName })}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>אישור מחיקה</DialogTitle>
            <DialogDescription>
              האם למחוק את הלקוח <strong>{deleteTarget?.fullName}</strong>?
              פעולה זו אינה ניתנת לביטול.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-start">
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              מחק
            </Button>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
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
