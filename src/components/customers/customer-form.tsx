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
import { Loader2, Save, Upload, FileText, X as XIcon, Plus, ArrowUpCircle, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { FileUploadProgress, type UploadStatus } from "@/components/ui/file-upload-progress"
import { uploadWithProgress } from "@/lib/upload-with-progress"

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
  includesUpdates: boolean
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
    isCasual?: boolean
    sampleType?: string
    includesUpdates?: boolean
    createdAt?: string
    updatedAt?: string
  }
  onSubmit: (data: CustomerFormData | CustomerUpdateFormData, pendingInfoFile?: File, pendingAdditionalInfoFile?: File) => Promise<void>
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
    className: "bg-orange-100 text-orange-800 border-orange-200",
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
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle")
  const [uploadError, setUploadError] = useState("")
  const [additionalUploadProgress, setAdditionalUploadProgress] = useState(0)
  const [additionalUploadStatus, setAdditionalUploadStatus] = useState<UploadStatus>("idle")
  const [additionalUploadError, setAdditionalUploadError] = useState("")
  const [pendingInfoFile, setPendingInfoFile] = useState<File | null>(null)
  const [nextCustomerId, setNextCustomerId] = useState<number | null>(null)
  const [pendingAdditionalInfoFile, setPendingAdditionalInfoFile] = useState<File | null>(null)
  const [infoFileName, setInfoFileName] = useState<string>(() => {
    if (initialData?.infoFileUrl) {
      const parts = initialData.infoFileUrl.split("/")
      const raw = parts[parts.length - 1]
      const match = raw.match(/^\d+-(.+)$/)
      return match ? match[1] : raw
    }
    return ""
  })
  const [additionalInfoFileName, setAdditionalInfoFileName] = useState<string>(() => {
    if (initialData?.additionalInfoFileUrl) {
      const parts = initialData.additionalInfoFileUrl.split("/")
      const raw = parts[parts.length - 1]
      const match = raw.match(/^\d+-(.+)$/)
      return match ? match[1] : raw
    }
    return ""
  })

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
      infoFileUrl: initialData?.infoFileUrl || "",
      additionalInfoFileUrl: initialData?.additionalInfoFileUrl || "",
      ...(mode === "edit" && {
        status: initialData?.status as "ACTIVE" | "BLOCKED" | "FROZEN" | "EXCEPTION" | undefined,
        hasV3: initialData?.hasV3 ?? true,
        isCasual: initialData?.isCasual ?? false,
        sampleType: initialData?.sampleType as "CPI" | "CPF" | undefined,
        currentUpdateVersion: initialData?.currentUpdateVersion || "",
      }),
    },
  })

  const watchedOrganId = watch("organId")
  const watchedSetTypeId = watch("setTypeId")
  const [userEditedAmount, setUserEditedAmount] = useState(false)

  // #21/#6: Auto-fill סכום לפי סוג סט (רק אם המשתמש לא שינה ידנית)
  useEffect(() => {
    if (mode === "create" && watchedSetTypeId && !userEditedAmount) {
      const selectedSet = setTypes.find(s => s.id === watchedSetTypeId)
      if (selectedSet) {
        setValue("amountPaid", selectedSet.price)
      }
    }
  }, [watchedSetTypeId, setTypes, mode, userEditedAmount, setValue])

  useEffect(() => {
    async function fetchData() {
      try {
        const fetches: Promise<Response>[] = [
          fetch("/api/data/organs"),
          fetch("/api/data/sets"),
        ]
        // #4: מספר לקוח הבא
        if (mode === "create") {
          fetches.push(fetch("/api/customers/next-id"))
        }
        const [organsRes, setsRes, nextIdRes] = await Promise.all(fetches)
        if (organsRes.ok) {
          const organsData = await organsRes.json()
          setOrgans(organsData)
        }
        if (setsRes.ok) {
          const setsData = await setsRes.json()
          setSetTypes(setsData)
        }
        if (nextIdRes?.ok) {
          const idData = await nextIdRes.json()
          setNextCustomerId(idData.nextId)
        }
      } catch (error) {
        console.error("Error fetching form data:", error)
      } finally {
        setIsLoadingData(false)
      }
    }
    fetchData()
  }, [])

  const [detectResult, setDetectResult] = useState<string | null>(null)

  // #2: זיהוי אורגן אוטומטי מקובץ N27 (bytes 0-63 = שם אורגן)
  const detectOrganFromN27 = async (file: File, forceUpdate = false) => {
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      // bytes 0-63 = שם אורגן (null-terminated ASCII)
      let organName = ""
      for (let i = 0; i < Math.min(64, bytes.length); i++) {
        if (bytes[i] === 0) break
        organName += String.fromCharCode(bytes[i])
      }
      organName = organName.trim()
      if (!organName) {
        if (forceUpdate) setDetectResult("לא זוהה אורגן בקובץ")
        return
      }

      // קריאת waveCapacity מ-N27 לזיהוי 1G/2G
      let waveCapacity = 0
      if (bytes.length >= 0x7C) {
        const waveUnits = ((bytes[0x78] << 24) | (bytes[0x79] << 16) | (bytes[0x7A] << 8) | bytes[0x7B]) >>> 0
        waveCapacity = waveUnits * 1024
      }

      // חיפוש אורגן תואם (case-insensitive, גם חלקי)
      const normalize = (s: string) => s.toLowerCase().replace(/[-_ ]/g, "")
      const normalizedName = normalize(organName)

      // קודם ניסיון התאמה מדויקת
      let match = organs.find(o => normalize(o.name) === normalizedName)

      // אם אין התאמה מדויקת — התאמה חלקית עם זיהוי 1G/2G לפי waveCapacity
      if (!match) {
        const candidates = organs.filter(o =>
          normalizedName.includes(normalize(o.name)) ||
          normalize(o.name).includes(normalizedName)
        )

        if (candidates.length > 1 && normalizedName.includes("tyros5") && waveCapacity > 0) {
          // Tyros5-1G vs Tyros5-2G: הבדלה לפי נפח wave memory
          // מעל 1.5GB = 2G, מתחת = 1G
          const threshold = 1.5 * 1024 * 1024 * 1024
          const suffix = waveCapacity > threshold ? "2g" : "1g"
          match = candidates.find(c => normalize(c.name).includes(suffix)) || candidates[0]
        } else {
          match = candidates[0]
        }
      }

      if (match) {
        if (!watchedOrganId || forceUpdate) {
          setValue("organId", match.id)
        }
        if (forceUpdate) setDetectResult(`זוהה: ${match.name}`)
      } else {
        if (forceUpdate) setDetectResult(`נמצא "${organName}" — לא תואם אורגן במערכת`)
      }
      if (forceUpdate) setTimeout(() => setDetectResult(null), 4000)
    } catch {
      if (forceUpdate) setDetectResult("שגיאה בקריאת הקובץ")
    }
  }

  const handleInfoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // #2: זיהוי אורגן אוטומטי בכל העלאה — תמיד מעדכן
    detectOrganFromN27(file, true)

    // במצב create - שומרים את הקובץ בזיכרון ומעלים אחרי יצירת הלקוח
    if (mode === "create") {
      setPendingInfoFile(file)
      setInfoFileName(file.name)
      e.target.value = ""
      return
    }

    if (!initialData?.id) {
      alert("שגיאה: לא נמצא מזהה לקוח")
      e.target.value = ""
      return
    }

    // זיהוי אורגן אוטומטי גם בעריכה
    detectOrganFromN27(file, true)

    setUploadStatus("uploading")
    setUploadProgress(0)
    setUploadError("")
    setInfoFileName(file.name)

    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await uploadWithProgress(
        `/api/customers/${initialData.id}/upload-info`,
        fd,
        (percent) => setUploadProgress(percent)
      )

      // קובץ הגיע לשרת, עכשיו מעבד (מעלה ל-Google Drive)
      if (uploadProgress >= 100) setUploadStatus("processing")

      if (!res.ok) throw new Error((res.data as { error?: string }).error || "שגיאה בהעלאה")

      const data = res.data as { url: string; fileName: string }
      setValue("infoFileUrl" as keyof (CustomerFormData | CustomerUpdateFormData), data.url)
      setInfoFileName(data.fileName)
      setUploadStatus("success")

      // אחרי 3 שניות נחזור למצב רגיל
      setTimeout(() => setUploadStatus("idle"), 3000)
    } catch (err) {
      setUploadStatus("error")
      setUploadError(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ")
    } finally {
      e.target.value = ""
    }
  }

  // פונקציית עזר: זיהוי אורגן מ-bytes של N27
  const matchOrganFromBytes = (bytes: Uint8Array): Organ | null => {
    let organName = ""
    for (let i = 0; i < Math.min(64, bytes.length); i++) {
      if (bytes[i] === 0) break
      organName += String.fromCharCode(bytes[i])
    }
    organName = organName.trim()
    if (!organName) return null

    let waveCapacity = 0
    if (bytes.length >= 0x7C) {
      const waveUnits = ((bytes[0x78] << 24) | (bytes[0x79] << 16) | (bytes[0x7A] << 8) | bytes[0x7B]) >>> 0
      waveCapacity = waveUnits * 1024
    }

    const normalize = (s: string) => s.toLowerCase().replace(/[-_ ]/g, "")
    const normalizedName = normalize(organName)

    let match = organs.find(o => normalize(o.name) === normalizedName)
    if (!match) {
      const candidates = organs.filter(o =>
        normalizedName.includes(normalize(o.name)) ||
        normalize(o.name).includes(normalizedName)
      )
      if (candidates.length > 1 && normalizedName.includes("tyros5") && waveCapacity > 0) {
        const threshold = 1.5 * 1024 * 1024 * 1024
        const suffix = waveCapacity > threshold ? "2g" : "1g"
        match = candidates.find(c => normalize(c.name).includes(suffix)) || candidates[0]
      } else {
        match = candidates[0]
      }
    }
    return match || null
  }

  // זיהוי אורגן נוסף אוטומטי מקובץ N27
  const detectAdditionalOrganFromN27 = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const match = matchOrganFromBytes(bytes)
      if (match) {
        setValue("additionalOrganId", match.id)
        setDetectResult(`זוהה: ${match.name}`)
      } else {
        let organName = ""
        for (let i = 0; i < Math.min(64, bytes.length); i++) {
          if (bytes[i] === 0) break
          organName += String.fromCharCode(bytes[i])
        }
        setDetectResult(`נמצא "${organName.trim()}" — לא תואם אורגן במערכת`)
      }
      setTimeout(() => setDetectResult(null), 4000)
    } catch { /* ignore */ }
  }

  const handleAdditionalInfoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // זיהוי אורגן נוסף אוטומטי
    detectAdditionalOrganFromN27(file)

    if (mode === "create") {
      setPendingAdditionalInfoFile(file)
      setAdditionalInfoFileName(file.name)
      e.target.value = ""
      return
    }

    if (!initialData?.id) {
      alert("שגיאה: לא נמצא מזהה לקוח")
      e.target.value = ""
      return
    }

    // זיהוי אורגן נוסף אוטומטי גם בעריכה
    detectAdditionalOrganFromN27(file)

    setAdditionalUploadStatus("uploading")
    setAdditionalUploadProgress(0)
    setAdditionalUploadError("")
    setAdditionalInfoFileName(file.name)

    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await uploadWithProgress(
        `/api/customers/${initialData.id}/upload-info?type=additional`,
        fd,
        (percent) => setAdditionalUploadProgress(percent)
      )

      if (additionalUploadProgress >= 100) setAdditionalUploadStatus("processing")

      if (!res.ok) throw new Error((res.data as { error?: string }).error || "שגיאה בהעלאה")

      const data = res.data as { url: string; fileName: string }
      setValue("additionalInfoFileUrl" as keyof (CustomerFormData | CustomerUpdateFormData), data.url)
      setAdditionalInfoFileName(data.fileName)
      setAdditionalUploadStatus("success")

      setTimeout(() => setAdditionalUploadStatus("idle"), 3000)
    } catch (err) {
      setAdditionalUploadStatus("error")
      setAdditionalUploadError(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ")
    } finally {
      e.target.value = ""
    }
  }

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
            {mode === "create" ? (
              <span>
                פרטי לקוח חדש
                {nextCustomerId && (
                  <span className="text-sm font-normal text-muted-foreground mr-2">
                    (מזהה: {nextCustomerId})
                  </span>
                )}
              </span>
            ) : "פרטי לקוח"}
          </CardTitle>
          {mode === "edit" && initialData && (
            <div className="flex items-center gap-2">
              {initialData.currentUpdateVersion && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-sm",
                    initialData.status === "EXCEPTION"
                      ? "bg-orange-100 text-orange-800 border-orange-200"
                      : "bg-green-100 text-green-800 border-green-200"
                  )}
                >
                  {initialData.currentUpdateVersion}
                </Badge>
              )}
              {!initialData.currentUpdateVersion && initialData.status !== "EXCEPTION" && (
                <Badge variant="outline" className="text-sm bg-red-100 text-red-800 border-red-200">
                  לא עודכן
                </Badge>
              )}
              {initialData.status && (
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
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => onSubmit(data, pendingInfoFile || undefined, pendingAdditionalInfoFile || undefined))} className="space-y-6">
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
                פלאפון ראשי <span className="text-destructive">*</span>
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
              <Label htmlFor="whatsappPhone">פלאפון משני</Label>
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

            {/* Email — auto-append @gmail.com */}
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
                onBlur={(e) => {
                  const val = e.target.value.trim()
                  if (val && !val.includes("@")) {
                    setValue("email", val + "@gmail.com")
                  }
                }}
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

            {/* #5: Additional Organ — כפתור הפעלה */}
            <div className="space-y-2">
              <Label>אורגן נוסף</Label>
              {watch("additionalOrganId") ? (
                <div className="flex gap-2">
                  <Select
                    value={watch("additionalOrganId") || ""}
                    onValueChange={(value) =>
                      setValue("additionalOrganId", value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="ללא" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא</SelectItem>
                      {organs.map((organ) => (
                        <SelectItem key={organ.id} value={organ.id}>{organ.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setValue("additionalOrganId", null)} className="shrink-0 text-red-500 hover:text-red-700">
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setValue("additionalOrganId", organs[0]?.id || "")}
                >
                  <Upload className="h-4 w-4 ml-2" />
                  הוסף אורגן נוסף
                </Button>
              )}
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
              {/* כפתור שדרוג לסט שלם — רק כשהסט הנוכחי לא כולל עדכונים */}
              {mode === "edit" && (() => {
                const currentSet = setTypes.find(s => s.id === watchedSetTypeId)
                const fullSet = setTypes.find(s => s.includesUpdates)
                if (currentSet && !currentSet.includesUpdates && fullSet) {
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => {
                        setValue("setTypeId", fullSet.id)
                        setUserEditedAmount(false) // יתעדכן אוטומטית לפי מחיר הסט
                      }}
                    >
                      <ArrowUpCircle className="h-4 w-4 ml-1" />
                      שדרג לסט שלם
                    </Button>
                  )
                }
                return null
              })()}
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
                onChange={(e) => {
                  setUserEditedAmount(true)
                  register("amountPaid", { valueAsNumber: true }).onChange(e)
                }}
              />
              {errors.amountPaid && (
                <p className="text-sm text-destructive">
                  {errors.amountPaid.message}
                </p>
              )}
            </div>

            {/* Discount Reason */}
            <div className="space-y-2">
              <Label htmlFor="discountReason">סיבת הנחה / מבצע</Label>
              <Input
                id="discountReason"
                {...register("discountReason" as keyof (CustomerFormData | CustomerUpdateFormData))}
                placeholder="לדוגמה: מבצע חנוכה 2025"
              />
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
                {/* #7: תפוגת עדכונים — רק אם סט שכולל עדכונים */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    תאריך תפוגת עדכון
                  </Label>
                  <p className="text-sm font-medium h-10 flex items-center">
                    {initialData.updateExpiryDate && initialData.status !== "FROZEN"
                      ? formatDate(initialData.updateExpiryDate)
                      : <span className="text-muted-foreground">לא רלוונטי</span>}
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
                  <div className="flex items-center gap-4 h-10">
                    <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="isCasual"
                        checked={Boolean(watch("isCasual" as keyof (CustomerFormData | CustomerUpdateFormData)))}
                        onCheckedChange={(checked) =>
                          setValue("isCasual" as keyof (CustomerFormData | CustomerUpdateFormData), (checked === true) as unknown as string)
                        }
                      />
                      <Label htmlFor="isCasual" className="cursor-pointer text-amber-700">
                        לקוח מזדמן
                      </Label>
                    </div>
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

          {/* Info File Upload */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>קובץ אינפו של האורגן</Label>
              {infoFileName && <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">יש אינפו</Badge>}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                onClick={async () => {
                  if (pendingInfoFile) {
                    // יש קובץ ממתין בזיכרון — זהה ממנו
                    detectOrganFromN27(pendingInfoFile, true)
                  } else if (mode === "edit" && initialData?.id && infoFileName) {
                    // במצב עריכה — הורד את הקובץ מהשרת וזהה
                    try {
                      setDetectResult("מזהה...")
                      const res = await fetch(`/api/customers/${initialData.id}/download-info`)
                      if (res.ok) {
                        const blob = await res.blob()
                        const file = new File([blob], "info.n27")
                        detectOrganFromN27(file, true)
                      } else {
                        setDetectResult("לא ניתן להוריד את הקובץ")
                      }
                    } catch {
                      setDetectResult("שגיאה בהורדת הקובץ")
                    }
                  } else {
                    // אין קובץ — פתח בחירת קובץ, זהה ממנו, ושמור כ-pending
                    const input = document.createElement("input")
                    input.type = "file"
                    input.accept = ".n27"
                    input.onchange = async (ev) => {
                      const file = (ev.target as HTMLInputElement).files?.[0]
                      if (!file) return
                      setPendingInfoFile(file)
                      setInfoFileName(file.name)
                      detectOrganFromN27(file, true)
                    }
                    input.click()
                  }
                }}
              >
                <Search className="h-3 w-3 ml-1" />
                זהה אורגן
              </Button>
              {detectResult && (
                <span className={cn("text-xs font-medium", detectResult.startsWith("זוהה") ? "text-green-600" : "text-amber-600")}>
                  {detectResult}
                </span>
              )}
            </div>

            {/* Progress indicator - shown during/after upload in edit mode */}
            {uploadStatus !== "idle" && (
              <FileUploadProgress
                fileName={infoFileName}
                progress={uploadProgress}
                status={uploadStatus}
                errorMessage={uploadError}
                colorScheme="blue"
              />
            )}

            {/* File selector / file display */}
            {uploadStatus === "idle" && (
              <div className="flex items-center gap-2">
                {infoFileName ? (
                  <div className="flex items-center gap-2 flex-1 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm">
                    <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="truncate">{infoFileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setValue("infoFileUrl" as keyof (CustomerFormData | CustomerUpdateFormData), "")
                        setInfoFileName("")
                        setPendingInfoFile(null)
                      }}
                      className="mr-auto text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex-1">
                    <Upload className="h-4 w-4" />
                    <span>העלה קובץ אינפו (.n27)</span>
                    <input
                      type="file"
                      accept=".n27"
                      className="hidden"
                      onChange={handleInfoFileUpload}
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Additional Info File Upload - only when additional organ selected */}
          {watch("additionalOrganId") && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>קובץ אינפו של האורגן הנוסף</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                onClick={async () => {
                  if (pendingAdditionalInfoFile) {
                    // זיהוי מהקובץ הממתין — עדכון אורגן נוסף
                    try {
                      const buffer = await pendingAdditionalInfoFile.arrayBuffer()
                      const bytes = new Uint8Array(buffer)
                      const match = matchOrganFromBytes(bytes)
                      if (match) {
                        setValue("additionalOrganId", match.id)
                        setDetectResult(`זוהה: ${match.name}`)
                      } else {
                        setDetectResult("לא זוהה אורגן בקובץ")
                      }
                      setTimeout(() => setDetectResult(null), 4000)
                    } catch { setDetectResult("שגיאה בקריאת הקובץ") }
                  } else {
                    // פתח בחירת קובץ
                    const input = document.createElement("input")
                    input.type = "file"
                    input.accept = ".n27"
                    input.onchange = async (ev) => {
                      const file = (ev.target as HTMLInputElement).files?.[0]
                      if (!file) return
                      setPendingAdditionalInfoFile(file)
                      setAdditionalInfoFileName(file.name)
                      try {
                        const buffer = await file.arrayBuffer()
                        const bytes = new Uint8Array(buffer)
                        const match = matchOrganFromBytes(bytes)
                        if (match) {
                          setValue("additionalOrganId", match.id)
                          setDetectResult(`זוהה: ${match.name}`)
                        } else {
                          setDetectResult("לא זוהה אורגן בקובץ")
                        }
                        setTimeout(() => setDetectResult(null), 4000)
                      } catch { setDetectResult("שגיאה") }
                    }
                    input.click()
                  }
                }}
              >
                <Search className="h-3 w-3 ml-1" />
                זהה אורגן
              </Button>
              {detectResult && (
                <span className={cn("text-xs font-medium", detectResult.startsWith("זוהה") ? "text-green-600" : "text-amber-600")}>
                  {detectResult}
                </span>
              )}
            </div>

            {additionalUploadStatus !== "idle" && (
              <FileUploadProgress
                fileName={additionalInfoFileName}
                progress={additionalUploadProgress}
                status={additionalUploadStatus}
                errorMessage={additionalUploadError}
                colorScheme="green"
              />
            )}

            {additionalUploadStatus === "idle" && (
              <div className="flex items-center gap-2">
                {additionalInfoFileName ? (
                  <div className="flex items-center gap-2 flex-1 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm">
                    <FileText className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="truncate">{additionalInfoFileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setValue("additionalInfoFileUrl" as keyof (CustomerFormData | CustomerUpdateFormData), "")
                        setAdditionalInfoFileName("")
                        setPendingAdditionalInfoFile(null)
                      }}
                      className="mr-auto text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors flex-1">
                    <Upload className="h-4 w-4" />
                    <span>העלה קובץ אינפו לאורגן נוסף (.n27)</span>
                    <input
                      type="file"
                      accept=".n27"
                      className="hidden"
                      onChange={handleAdditionalInfoFileUpload}
                    />
                  </label>
                )}
              </div>
            )}
          </div>
          )}

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
