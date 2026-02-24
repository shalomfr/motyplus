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
}

interface Organ {
  id: string
  name: string
}

interface SetType {
  id: string
  name: string
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
}

export function CustomerFiltersPanel({
  filters,
  onFiltersChange,
  onClear,
}: CustomerFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [organs, setOrgans] = useState<Organ[]>([])
  const [setTypes, setSetTypes] = useState<SetType[]>([])

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

  return (
    <Card>
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">סינון וחיפוש</span>
          {hasActiveFilters && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              פעיל
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </div>

      {isOpen && (
        <CardContent className="pt-0 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>חיפוש לפי שם / מזהה / מייל</Label>
              <Input
                placeholder="הקלד לחיפוש..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
              />
            </div>

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
                  <SelectItem value="ACTIVE">פעיל</SelectItem>
                  <SelectItem value="BLOCKED">חסום</SelectItem>
                  <SelectItem value="FROZEN">מוקפא</SelectItem>
                  <SelectItem value="EXCEPTION">חריג</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <Label>מתאריך</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <Label>עד תאריך</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
              />
            </div>

            {/* Missing Details */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex items-center gap-2 h-10">
                <Checkbox
                  id="missingDetails"
                  checked={filters.missingDetails}
                  onCheckedChange={(checked) =>
                    updateFilter("missingDetails", checked === true)
                  }
                />
                <Label htmlFor="missingDetails" className="cursor-pointer">
                  חסרי פרטים
                </Label>
              </div>
            </div>

            {/* Clear Filters */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                variant="outline"
                onClick={onClear}
                className={cn(
                  "w-full",
                  !hasActiveFilters && "opacity-50 cursor-not-allowed"
                )}
                disabled={!hasActiveFilters}
              >
                <X className="h-4 w-4 ml-2" />
                נקה סינון
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export { defaultFilters }
