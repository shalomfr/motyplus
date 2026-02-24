"use client"

import { UpdateForm } from "@/components/updates/update-form"

export default function NewUpdatePage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">עדכון חדש</h2>
      <UpdateForm mode="create" />
    </div>
  )
}
