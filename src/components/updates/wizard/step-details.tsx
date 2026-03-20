"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"

const VERSION_SUGGESTIONS = [
  "V3.0", "V3.1", "V3.2",
  "V4.0", "V4.1", "V4.2",
  "V5.0", "V5.1", "V5.2",
  "V6.0", "V6.1", "V6.2",
  "V7.0", "V7.1",
]

export interface UpdateDetailsData {
  version: string
  price: number
  description: string
  releaseDate: string
}

interface StepDetailsProps {
  data: UpdateDetailsData
  onChange: (data: UpdateDetailsData) => void
  onSubmit: () => Promise<void>
  isExisting: boolean
  loading: boolean
  error: string
}

export function StepDetails({ data, onChange, onSubmit, isExisting, loading, error }: StepDetailsProps) {
  const handleChange = (field: keyof UpdateDetailsData, value: string | number) => {
    onChange({ ...data, [field]: value })
  }

  const isValid = data.version.trim().length > 0 && data.price > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {isExisting ? "פרטי עדכון" : "יצירת עדכון חדש"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="wizard-version">שם גרסה</Label>
            <Select
              value={data.version}
              onValueChange={(v) => handleChange("version", v)}
              disabled={isExisting}
            >
              <SelectTrigger id="wizard-version">
                <SelectValue placeholder="בחר גרסה" />
              </SelectTrigger>
              <SelectContent>
                {VERSION_SUGGESTIONS.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wizard-price">מחיר</Label>
            <Input
              id="wizard-price"
              type="number"
              min={0}
              value={data.price}
              onChange={(e) => handleChange("price", parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wizard-date">תאריך שחרור</Label>
          <Input
            id="wizard-date"
            type="date"
            value={data.releaseDate}
            onChange={(e) => handleChange("releaseDate", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wizard-desc">תיאור</Label>
          <Textarea
            id="wizard-desc"
            value={data.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="תיאור העדכון..."
            rows={3}
          />
        </div>

        {!isExisting && (
          <Button
            onClick={onSubmit}
            disabled={!isValid || loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <Plus className="h-4 w-4 ml-2" />
            )}
            {loading ? "יוצר עדכון..." : "צור עדכון והמשך"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
