"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { LeadForm } from "@/components/leads/lead-form"

export default function NewLeadPage() {
  const router = useRouter()
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/leads")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">ליד חדש</h2>
      </div>
      <LeadForm mode="create" />
    </div>
  )
}
