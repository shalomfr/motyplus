"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronUp, X, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CustomerFilters {
  search: string
  organId: string
  setTypeId: string
  status: string
  dateFrom: string
  dateTo: string
  missingDetails: boolean
  missingField: string
  maxUpdateVersion: string
}

interface Organ {
  id: string
  name: string
}

interface SetType {
  id: string
  name: string
}

interface UpdateVersion {
  id: string
  version: string
}

interface CustomerFiltersProps {
  filters: CustomerFilters
  onFiltersChange: (filters: CustomerFilters) => void
  onClear: () => void
}

const defaultFilters: CustomerFilters = {
  search: "",
  organId: "",
  setTypeId: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  missingDetails: false,
  missingField: "",
  maxUpdateVersion: "",
}

export function CustomerFiltersPanel({
  filters,
  onFiltersChange,
  onClear,
}: CustomerFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [organs, setOrgans] = useState<Organ[]>([])
  const [setTypes, setSetTypes] = useState<SetType[]>([])
  const [updateVersions, setUpdateVersions] = useState<UpdateVersion[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const [organsRes, setsRes, versionsRes] = await Promise.all([
          fetch("/api/data/organs"),
          fetch("/api/data/sets"),
          fetch("/api/data/update-versions"),
        ])
        if (organsRes.ok) {
          const organsData = await organsRes.json()
          setOrgans(organsData)
        }
        if (setsRes.ok) {
          const setsData = await setsRes.json()
          setSetTypes(setsData)
        }
        if (versionsRes.ok) {
          const versionsData = await versionsRes.json()
          setUpdateVersions(versionsData)
        }
      } catch (error) {
        console.error("Error fetching filter data:", error)
      }
    }
    fetchData()
  }, [])

  const hasActiveFilters =
    filters.search !== "" ||
    filters.organId !== "" ||
    filters.setTypeId !== "" ||
    filters.status !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.missingDetails

  const updateFilter = <K extends keyof CustomerFilters>(
    key: K,
    value: CustomerFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const advancedActive =
    filters.organId !== "" ||
    filters.setTypeId !== "" ||
    filters.status !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.missingDetails ||
    filters.missingField !== "" ||
    filters.maxUpdateVersion !== ""

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        {/* חיפוש ראשי — תמיד גלוי */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי שם / מזהה / מייל..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="pr-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className={cn(advancedActive && "border-orange-400 text-blue-600")}
          >
            {isOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            סינון מתקדם
            {advancedActive && (
              <span className="gradient-blue-btn text-white text-xs px-1.5 py-0.5 rounded-full mr-1">!</span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4 ml-1" />
              נקה
            </Button>
          )}
        </div>

        {/* פילטרים מתקדמים — מוסתרים כברירת מחדל */}
        {isOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4 pt-4 border-t">
            {/* Organ Type */}
            <div className="space-y-2">
              <Label>סוג אורגן</Label>
              <Select
                value={filters.organId}
                onValueChange={(value) => updateFilter("organId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="כל האורגנים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל האורגנים</SelectItem>
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
              <Label>סוג סט</Label>
              <Select
                value={filters.setTypeId}
                onValueChange={(value) => updateFilter("setTypeId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="כל הסטים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסטים</SelectItem>
                  {setTypes.map((set) => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>מצב</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => updateFilter("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="כל המצבים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל המצבים</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">ממתין לאישור</SelectItem>
                  <SelectItem value="ACTIVE">פעיל</SelectItem>
                  <SelectItem value="BLOCKED">חסום</SelectItem>
                  <SelectItem value="FROZEN">מוקפא</SelectItem>
                  <SelectItem value="EXCEPTION">חריג</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range — same row */}
            <div className="space-y-2">
              <Label>טווח תאריכים</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter("dateFrom", e.target.value)}
                  className="flex-1"
                />
                <span className="text-muted-foreground text-sm shrink-0">עד</span>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter("dateTo", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Update Version Filter */}
            <div className="space-y-2">
              <Label>מעודכן עד גרסה</Label>
              <Select
                value={filters.maxUpdateVersion}
                onValueChange={(value) => updateFilter("maxUpdateVersion", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="כל הגרסאות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הגרסאות</SelectItem>
                  {updateVersions.map((v) => (
                    <SelectItem key={v.id} value={v.version}>
                      {v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Missing Details */}
            <div className="space-y-2">
              <Label>חסרי פרטים</Label>
              <Select
                value={filters.missingDetails ? (filters.missingField || "any") : ""}
                onValueChange={(value) => {
                  if (!value || value === "none") {
                    onFiltersChange({ ...filters, missingDetails: false, missingField: "" })
                  } else {
                    onFiltersChange({ ...filters, missingDetails: true, missingField: value === "any" ? "" : value })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="הכל" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">הכל</SelectItem>
                  <SelectItem value="any">כל חסר</SelectItem>
                  <SelectItem value="email">חסר מייל</SelectItem>
                  <SelectItem value="phone">חסר טלפון</SelectItem>
                  <SelectItem value="address">חסר כתובת</SelectItem>
                  <SelectItem value="infoFile">חסר אינפו</SelectItem>
                  <SelectItem value="whatsapp">חסר WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { defaultFilters }
