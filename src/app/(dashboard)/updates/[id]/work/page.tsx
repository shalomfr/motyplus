"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WorkListTable } from "@/components/updates/work-list-table"
import { ArrowRight, Loader2, ListChecks } from "lucide-react"

interface WorkCustomer {
  id: number
  fullName: string
  organ: { id: string; name: string }
  email: string
  phone: string
  currentUpdateVersion: string | null
  status: string
  infoUploaded: boolean
  samplesReady: boolean
  sent: boolean
}

interface Organ {
  id: string
  name: string
}

export default function UpdateWorkPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [customers, setCustomers] = useState<WorkCustomer[]>([])
  const [organs, setOrgans] = useState<Organ[]>([])
  const [loading, setLoading] = useState(true)
  const [updateVersion, setUpdateVersion] = useState("")

  const fetchData = useCallback(async () => {
    try {
      const [workRes, organsRes] = await Promise.all([
        fetch(`/api/updates/${id}/work`),
        fetch("/api/data/organs"),
      ])

      if (workRes.ok) {
        const workData = await workRes.json()
        setCustomers(workData.customers || [])
        setUpdateVersion(workData.version || "")
      }

      if (organsRes.ok) {
        const organsData = await organsRes.json()
        setOrgans(organsData.organs || organsData || [])
      }
    } catch (err) {
      console.error("Error fetching work data:", err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const readyCount = customers.filter((c) => c.infoUploaded && c.samplesReady && !c.sent).length
  const sentCount = customers.filter((c) => c.sent).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/updates/${id}`)}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
            רשימת עבודה - {updateVersion}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {customers.length} לקוחות זכאים | {readyCount} מוכנים לשליחה | {sentCount} נשלחו
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            לקוחות זכאים לעדכון
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkListTable
            updateId={id}
            customers={customers}
            organs={organs}
            onRefresh={handleRefresh}
          />
        </CardContent>
      </Card>
    </div>
  )
}
