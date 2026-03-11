"use client"

import React from "react"
import { Progress } from "@/components/ui/progress"
import { FileText, CheckCircle2, XCircle, Upload, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error"

interface FileUploadProgressProps {
  fileName: string
  progress: number
  status: UploadStatus
  errorMessage?: string
  colorScheme?: "blue" | "green"
}

const colorMap = {
  blue: {
    indicator: "bg-blue-500",
    icon: "text-blue-500",
    border: "border-blue-200",
    bg: "bg-blue-50",
    successBg: "bg-green-50",
    successBorder: "border-green-200",
  },
  green: {
    indicator: "bg-green-500",
    icon: "text-green-500",
    border: "border-green-200",
    bg: "bg-green-50",
    successBg: "bg-green-50",
    successBorder: "border-green-200",
  },
}

export function FileUploadProgress({
  fileName,
  progress,
  status,
  errorMessage,
  colorScheme = "blue",
}: FileUploadProgressProps) {
  const colors = colorMap[colorScheme]

  if (status === "idle") return null

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all duration-300",
        status === "success" && `${colors.successBg} ${colors.successBorder}`,
        status === "error" && "bg-red-50 border-red-200",
        (status === "uploading" || status === "processing") && `${colors.bg} ${colors.border}`,
      )}
    >
      {/* Header row: icon + filename + status */}
      <div className="flex items-center gap-2 mb-2">
        {status === "uploading" && (
          <Upload className={cn("h-4 w-4 shrink-0", colors.icon)} />
        )}
        {status === "processing" && (
          <Loader2 className={cn("h-4 w-4 shrink-0 animate-spin", colors.icon)} />
        )}
        {status === "success" && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
        )}
        {status === "error" && (
          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
        )}

        <FileText className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="text-sm truncate flex-1">{fileName}</span>

        {(status === "uploading" || status === "processing") && (
          <span className="text-sm font-semibold tabular-nums" dir="ltr">
            {status === "processing" ? "מעבד..." : `${progress}%`}
          </span>
        )}
        {status === "success" && (
          <span className="text-sm font-medium text-green-600">הועלה בהצלחה</span>
        )}
        {status === "error" && (
          <span className="text-sm font-medium text-red-600">נכשל</span>
        )}
      </div>

      {/* Progress bar */}
      {(status === "uploading" || status === "processing") && (
        <Progress
          value={status === "processing" ? 100 : progress}
          indicatorClassName={cn(
            colors.indicator,
            status === "processing" && "animate-pulse"
          )}
          className="h-2"
        />
      )}

      {/* Success bar - full green */}
      {status === "success" && (
        <Progress value={100} indicatorClassName="bg-green-500" className="h-2" />
      )}

      {/* Error message */}
      {status === "error" && errorMessage && (
        <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
      )}
    </div>
  )
}
