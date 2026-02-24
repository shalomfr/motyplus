"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CustomerForm } from "@/components/customers/customer-form"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight } from "lucide-react"

export default function NewCustomerPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "שגיאה ביצירת הלקוח")
      }

      const newCustomer = await res.json()

      toast({
        title: "הלקוח נוצר בהצלחה",
        description: `לקוח ${newCustomer.fullName} נוסף למערכת`,
        variant: "success" as "default",
      })

      router.push(`/customers/${newCustomer.id}`)
    } catch (error) {
      toast({
        title: "שגיאה",
        description:
          error instanceof Error ? error.message : "שגיאה ביצירת הלקוח",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
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
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            הוספת לקוח חדש
          </h1>
          <p className="text-muted-foreground mt-1">
            מלא את הפרטים הנדרשים ליצירת כרטיס לקוח
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl">
        <CustomerForm
          mode="create"
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  )
}
