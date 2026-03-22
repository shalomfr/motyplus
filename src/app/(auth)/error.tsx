"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Auth error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <AlertTriangle className="h-12 w-12 text-red-500" />
      <h2 className="text-xl font-bold">שגיאה</h2>
      <p className="text-muted-foreground">אירעה שגיאה. נסה שוב.</p>
      <Button onClick={reset}>נסה שוב</Button>
    </div>
  )
}
