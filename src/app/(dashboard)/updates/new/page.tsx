"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { UpdateForm } from "@/components/updates/update-form"

export default function NewUpdatePage() {
  const router = useRouter()
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/updates")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">עדכון חדש</h2>
      </div>
      <UpdateForm mode="create" />
    </div>
  )
}
