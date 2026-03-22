"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <AlertTriangle className="h-12 w-12 text-red-500" />
      <h2 className="text-xl font-bold">משהו השתבש</h2>
      <p className="text-muted-foreground text-center max-w-md">
        אירעה שגיאה בלתי צפויה. נסה לרענן את העמוד.
      </p>
      <Button onClick={reset}>נסה שוב</Button>
    </div>
  )
}
