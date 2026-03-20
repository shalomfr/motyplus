"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Music, Users } from "lucide-react"
import { SamplesUploader } from "@/components/updates/samples-uploader"

interface StepSamplesProps {
  updateId: string
  cpiReady: number
  cpiTotal: number
}

export function StepSamples({ updateId, cpiReady, cpiTotal }: StepSamplesProps) {
  const percentage = cpiTotal > 0 ? Math.round((cpiReady / cpiTotal) * 100) : 0

  return (
    <div className="space-y-4">
      {/* CPI Coverage Summary */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
              <Users className="h-4 w-4" />
              כיסוי דגימות CPI
            </div>
            <Badge variant="outline" className="text-blue-700 border-blue-300">
              {cpiReady}/{cpiTotal} לקוחות מוכנים
            </Badge>
          </div>
          <Progress
            value={percentage}
            className="h-2.5"
          />
          <p className="text-xs text-blue-600 mt-2">
            {percentage}% מהלקוחות הזכאים יש להם קובץ CPI מוכן
          </p>
        </CardContent>
      </Card>

      {/* Existing SamplesUploader */}
      <SamplesUploader updateId={updateId} hideSendButton />
    </div>
  )
}
