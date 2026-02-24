"use client"

import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { customerSchema, customerUpdateSchema } from "@/lib/validators"
import { formatDate } from "@/lib/utils"
import { Loader2, Save } from "lucide-react"
import { cn } from "@/lib/utils"

type CustomerFormData = z.infer<typeof customerSchema>
type CustomerUpdateFormData = z.infer<typeof customerUpdateSchema>

interface Organ {
  id: string
  name: string
}

interface SetType {
  id: string
  name: string
  price: number
}

interface CustomerFormProps {
  mode: "create" | "edit"
  initialData?: CustomerUpdateFormData & {
    id?: number
    status?: string
    purchaseDate?: string
    updateExpiryDate?: string
    currentUpdateVersion?: string | null
    hasV3?: boolean
    sampleType?: string
    createdAt?: string
    updatedAt?: string
  }
  onSubmit: (data: CustomerFormData | CustomerUpdateFormData) => Promise<void>
  isSubmitting: boolean
}

const statusConfig: Record<string, { label: string; className: string }> = {
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

export function CustomerForm({
  mode,
  initialData,
  onSubmit,
  isSubmitting,
}: CustomerFormProps) {
  const [organs, setOrgans] = useState<Organ[]>([])
  const [setTypes, setSetTypes] = useState<SetType[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  const schema = mode === "create" ? customerSchema : customerUpdateSchema

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormData | CustomerUpdateFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: initialData?.fullName || "",
      phone: initialData?.phone || "",
      whatsappPhone: initialData?.whatsappPhone || "",
      address: initialData?.address || "",
      email: initialData?.email || "",
      organId: initialData?.organId || "",
      additionalOrganId: initialData?.additionalOrganId || "",
      setTypeId: initialData?.setTypeId || "",
      amountPaid: initialData?.amountPaid || 0,
      purchaseDate:
        initialData?.purchaseDate?.split("T")[0] ||
        new Date().toISOString().split("T")[0],
      notes: initialData?.notes || "",
      ...(mode === "edit" && {
        status: initialData?.status as "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION" | undefined,
        hasV3: initialData?.hasV3 || false,
        sampleType: initialData?.sampleType as "CPI" | "CPF" | undefined,
        currentUpdateVersion: initialData?.currentUpdateVersion || "",
      }),
    },
  })

  const watchedOrganId = watch("organId")
  const watchedSetTypeId = watch("setTypeId")

  useEffect(() => {
    async function fetchData() {
      try {
        const [organsRes, setsRes] = await Promise.all([
          fetch("/api/data/organs"),
          fetch("/api/data/sets"),
        ])
        if (organsRes.ok) {
          const organsData = await organsRes.json()
          setOrgans(organsData)
        }
        if (setsRes.ok) {
          const setsData = await setsRes.json()
          setSetTypes(setsData)
        }
      } catch (error) {
        console.error("Error fetching form data:", error)
      } finally {
        setIsLoadingData(false)
      }
    }
    fetchData()
  }, [])

  if (isLoadingData) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {mode === "create" ? "פרטי לקוח חדש" : "פרטי לקוח"}
          </CardTitle>
          {mode === "edit" && initialData?.status && (
            <Badge
              variant="outline"
              className={cn(
                "text-sm",
                statusConfig[initialData.status]?.className
              )}
            >
              {statusConfig[initialData.status]?.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">
                שם מלא <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                {...register("fullName")}
                placeholder="הזן שם מלא"
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">
                פלאפון <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="050-0000000"
                dir="ltr"
                className="text-right"
              />
              {errors.phone && (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <Label htmlFor="whatsappPhone">פלאפון וואטסאפ</Label>
              <Input
                id="whatsappPhone"
                {...register("whatsappPhone")}
                placeholder="050-0000000"
                dir="ltr"
                className="text-right"
              />
              {errors.whatsappPhone && (
                <p className="text-sm text-destructive">
                  {errors.whatsappPhone.message}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">כתובת</Label>
              <Input
                id="address"
                {...register("address")}
                placeholder="הזן כתובת"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                מייל <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="email@example.com"
                dir="ltr"
                className="text-right"
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Organ */}
            <div className="space-y-2">
              <Label>
                אורגן <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watchedOrganId}
                onValueChange={(value) => setValue("organId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר אורגן" />
                </SelectTrigger>
                <SelectContent>
                  {organs.map((organ) => (
                    <SelectItem key={organ.id} value={organ.id}>
                      {organ.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.organId && (
                <p className="text-sm text-destructive">
                  {errors.organId.message}
                </p>
              )}
            </div>

            {/* Additional Organ */}
            <div className="space-y-2">
              <Label>אורגן נוסף</Label>
              <Select
                value={watch("additionalOrganId") || ""}
                onValueChange={(value) =>
                  setValue(
                    "additionalOrganId",
                    value === "none" ? null : value
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="ללא" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא</SelectItem>
                  {organs.map((organ) => (
                    <SelectItem key={organ.id} value={organ.id}>
                      {organ.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Set Type */}
            <div className="space-y-2">
              <Label>
                סוג סט <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watchedSetTypeId}
                onValueChange={(value) => setValue("setTypeId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג סט" />
                </SelectTrigger>
                <SelectContent>
                  {setTypes.map((set) => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.setTypeId && (
                <p className="text-sm text-destructive">
                  {errors.setTypeId.message}
                </p>
              )}
            </div>

            {/* Amount Paid */}
            <div className="space-y-2">
              <Label htmlFor="amountPaid">
                סכום ששולם <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amountPaid"
                type="number"
                {...register("amountPaid", { valueAsNumber: true })}
                placeholder="0"
                dir="ltr"
                className="text-right"
              />
              {errors.amountPaid && (
                <p className="text-sm text-destructive">
                  {errors.amountPaid.message}
                </p>
              )}
            </div>

            {/* Purchase Date */}
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">תאריך קנייה</Label>
              <Input
                id="purchaseDate"
                type="date"
                {...register("purchaseDate")}
              />
            </div>
          </div>

          {/* Edit-mode only fields */}
          {mode === "edit" && initialData && (
            <div className="border-t pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Read-only info */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">תאריך קנייה</Label>
                  <p className="text-sm font-medium h-10 flex items-center">
                    {initialData.purchaseDate
                      ? formatDate(initialData.purchaseDate)
                      : "-"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    תאריך תפוגת עדכון
                  </Label>
                  <p className="text-sm font-medium h-10 flex items-center">
                    {initialData.updateExpiryDate
                      ? formatDate(initialData.updateExpiryDate)
                      : "-"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">גרסת עדכון</Label>
                  <p className="text-sm font-medium h-10 flex items-center">
                    {initialData.currentUpdateVersion || "לא עודכן"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Checkbox
                      id="hasV3"
                      checked={Boolean(watch("hasV3" as keyof (CustomerFormData | CustomerUpdateFormData)))}
                      onCheckedChange={(checked) =>
                        setValue("hasV3" as keyof (CustomerFormData | CustomerUpdateFormData), (checked === true) as unknown as string)
                      }
                    />
                    <Label htmlFor="hasV3" className="cursor-pointer">
                      V3
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="הערות נוספות..."
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-start">
            <Button type="submit" disabled={isSubmitting} className="min-w-32">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  שומר...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 ml-2" />
                  {mode === "create" ? "צור לקוח" : "שמור שינויים"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
