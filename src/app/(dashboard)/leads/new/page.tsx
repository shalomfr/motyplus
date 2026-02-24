"use client"

import { LeadForm } from "@/components/leads/lead-form"

export default function NewLeadPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">ליד חדש</h2>
      <LeadForm mode="create" />
    </div>
  )
}
