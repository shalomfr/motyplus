"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CustomerForm } from "@/components/customers/customer-form"
import { CustomerActions } from "@/components/customers/customer-actions"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, ArrowUpCircle, Loader2 } from "lucide-react"

interface CustomerUpdate {
  id: string
  version: string
  sentAt: string | null
  downloadedAt: string | null
}

interface ActivityLogEntry {
  id: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  userName: string | null
}

interface LinkedCustomer {
  id: number
  fullName: string
  organName: string
}

interface CustomerData {
  id: number
  fullName: string
  phone: string
  whatsappPhone: string | null
  address: string | null
  email: string
  organId: string
  organName: string
  additionalOrganId: string | null
  additionalOrganName: string | null
  setTypeId: string
  setTypeName: string
  includesUpdates: boolean
  amountPaid: number
  status: "PENDING_APPROVAL" | "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION"
  sampleType: "CPI" | "CPF"
  currentUpdateVersion: string | null
  hasV3: boolean
  notes: string | null
  infoFileUrl: string | null
  additionalInfoFileUrl: string | null
  purchaseDate: string
  updateExpiryDate: string
  createdAt: string
  updatedAt: string
  balance: number | null
  discountPercent: number | null
  couponCode: string | null
  linkedCustomer: LinkedCustomer | null
  updates: CustomerUpdate[]
  activityLog: ActivityLogEntry[]
}

function CustomerPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function EditCustomerPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<CustomerData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError("לקוח לא נמצא")
          return
        }
        throw new Error("שגיאה בטעינת נתוני הלקוח")
      }
      const raw = await res.json()
      const mapped: CustomerData = {
        id: raw.id,
        fullName: raw.fullName,
        phone: raw.phone,
        whatsappPhone: raw.whatsappPhone,
        address: raw.address,
        email: raw.email,
        organId: raw.organId,
        organName: raw.organ?.name || "",
        additionalOrganId: raw.additionalOrganId,
        additionalOrganName: raw.additionalOrgan?.name || null,
        setTypeId: raw.setTypeId,
        setTypeName: raw.setType?.name || "",
        includesUpdates: raw.setType?.includesUpdates ?? false,
        amountPaid: Number(raw.amountPaid),
        status: raw.status,
        sampleType: raw.sampleType,
        currentUpdateVersion: raw.currentUpdateVersion,
        hasV3: raw.hasV3,
        notes: raw.notes,
        infoFileUrl: raw.infoFileUrl,
        additionalInfoFileUrl: raw.additionalInfoFileUrl,
        purchaseDate: raw.purchaseDate,
        updateExpiryDate: raw.updateExpiryDate,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        balance: raw.setType?.includesUpdates
          ? 0
          : Math.max(0, Number(raw.setType?.price || 0) - Number(raw.amountPaid)),
        discountPercent: raw.promotion?.discountPercent || null,
        couponCode: raw.promotion?.couponCode || null,
        linkedCustomer: raw.linkedCustomer
          ? {
              id: raw.linkedCustomer.id,
              fullName: raw.linkedCustomer.fullName,
              organName: raw.linkedCustomer.organ?.name || "",
            }
          : null,
        updates: (raw.customerUpdates || []).map(
          (cu: {
            id: string
            updateVersion?: { version: string }
            sentAt?: string | null
            downloadedAt?: string | null
          }) => ({
            id: cu.id,
            version: cu.updateVersion?.version || "",
            sentAt: cu.sentAt || null,
            downloadedAt: cu.downloadedAt || null,
          })
        ),
        activityLog: [],
      }
      setCustomer(mapped)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "שגיאה בטעינת נתוני הלקוח"
      )
    } finally {
      setIsLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchCustomer()
  }, [fetchCustomer])

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "שגיאה בעדכון הלקוח")
      }

      toast({
        title: "הלקוח עודכן בהצלחה",
        variant: "success" as "default",
      })

      fetchCustomer()
    } catch (err) {
      toast({
        title: "שגיאה",
        description:
          err instanceof Error ? err.message : "שגיאה בעדכון הלקוח",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = () => {
    fetchCustomer()
  }

  const [isUpgrading, setIsUpgrading] = useState(false)
  const [fullSetTypes, setFullSetTypes] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    // טעינת סוגי סט מלאים (includesUpdates = true) לשדרוג
    fetch("/api/data/sets")
      .then((res) => res.json())
      .then((sets: { id: string; name: string; includesUpdates: boolean }[]) => {
        setFullSetTypes(sets.filter((s) => s.includesUpdates))
      })
      .catch(() => {})
  }, [])

  const handleUpgrade = async (setTypeId: string) => {
    if (!confirm("לשדרג לקוח לסט מלא? תקופת העדכון תתחיל מהיום ותהיה לשנה.")) return
    setIsUpgrading(true)
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upgrade", setTypeId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "שגיאה בשדרוג")
      }
      toast({
        title: "הלקוח שודרג בהצלחה",
        description: "תקופת העדכון — שנה מהיום",
        variant: "success" as "default",
      })
      fetchCustomer()
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err instanceof Error ? err.message : "שגיאה בשדרוג",
        variant: "destructive",
      })
    } finally {
      setIsUpgrading(false)
    }
  }

  if (isLoading) {
    return <CustomerPageSkeleton />
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">שגיאה</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground">
              {error || "לקוח לא נמצא"}
            </p>
            <Link href="/customers">
              <Button variant="outline" className="mt-4">
                חזרה לרשימת לקוחות
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            {customer.fullName}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-muted-foreground">
              מזהה: {customer.id} | {customer.organName}
              {customer.additionalOrganName && ` + ${customer.additionalOrganName}`}
              {" | "}{customer.setTypeName}
            </span>
            {customer.discountPercent != null && customer.discountPercent > 0 && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                {customer.discountPercent}% הנחה
                {customer.couponCode && ` (${customer.couponCode})`}
              </Badge>
            )}
            {!customer.includesUpdates && (
              <>
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                  חצי סט — ללא עדכונים
                </Badge>
                {/* #11: כפתור שדרוג ליד סוג הסט */}
                {fullSetTypes.length > 0 && (
                  fullSetTypes.length === 1 ? (
                    <Button
                      size="sm"
                      onClick={() => handleUpgrade(fullSetTypes[0].id)}
                      disabled={isUpgrading}
                      className="bg-green-600 hover:bg-green-700 h-7"
                    >
                      {isUpgrading ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <ArrowUpCircle className="h-3 w-3 ml-1" />}
                      שדרג לסט מלא
                    </Button>
                  ) : (
                    fullSetTypes.map((st) => (
                      <Button key={st.id} size="sm" onClick={() => handleUpgrade(st.id)} disabled={isUpgrading} className="bg-green-600 hover:bg-green-700 h-7">
                        {isUpgrading ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <ArrowUpCircle className="h-3 w-3 ml-1" />}
                        {st.name}
                      </Button>
                    ))
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Customer details form */}
        <div className="lg:col-span-2">
          <CustomerForm
            mode="edit"
            initialData={{
              fullName: customer.fullName,
              phone: customer.phone,
              whatsappPhone: customer.whatsappPhone,
              address: customer.address,
              email: customer.email,
              organId: customer.organId,
              additionalOrganId: customer.additionalOrganId,
              setTypeId: customer.setTypeId,
              amountPaid: customer.amountPaid,
              purchaseDate: customer.purchaseDate,
              notes: customer.notes,
              infoFileUrl: customer.infoFileUrl,
              additionalInfoFileUrl: customer.additionalInfoFileUrl,
              status: customer.status,
              hasV3: customer.hasV3,
              sampleType: customer.sampleType,
              currentUpdateVersion: customer.currentUpdateVersion,
              updateExpiryDate: customer.updateExpiryDate,
              createdAt: customer.createdAt,
              updatedAt: customer.updatedAt,
              id: customer.id,
            }}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </div>

        {/* Right column - Actions panel */}
        <div>
          <CustomerActions
            customerId={customer.id}
            customerEmail={customer.email}
            customerName={customer.fullName}
            customerPhone={customer.phone}
            customerWhatsapp={customer.whatsappPhone}
            status={customer.status}
            sampleType={customer.sampleType}
            amountPaid={customer.amountPaid}
            balance={customer.balance}
            includesUpdates={customer.includesUpdates}
            currentUpdateVersion={customer.currentUpdateVersion}
            infoFileUrl={customer.infoFileUrl}
            additionalInfoFileUrl={customer.additionalInfoFileUrl}
            linkedCustomer={customer.linkedCustomer}
            updates={customer.updates}
            activityLog={customer.activityLog}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>
    </div>
  )
}
