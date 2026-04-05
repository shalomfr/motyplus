"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, Music, Package, UserCheck, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { TaskCube } from "@/components/work-orders/task-cube"
import { SamplePrepCube } from "@/components/work-orders/sample-prep-cube"
import { SetSendingCube } from "@/components/work-orders/set-sending-cube"
import { ApprovalCube } from "@/components/work-orders/approval-cube"
import { NewOrderWizardDialog } from "@/components/customers/new-order-wizard-dialog"

type CubeType = "samples" | "sets" | "approval"

interface Counts {
  samples: { total: number; pending: number }
  sets: { total: number }
  approval: { total: number }
}

export default function WorkOrdersPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCube = (searchParams.get("cube") as CubeType) || "samples"

  const [activeCube, setActiveCube] = useState<CubeType>(initialCube)
  const [counts, setCounts] = useState<Counts>({
    samples: { total: 0, pending: 0 },
    sets: { total: 0 },
    approval: { total: 0 },
  })
  const [activeUpdate, setActiveUpdate] = useState<{ id: string; version: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [newOrderOpen, setNewOrderOpen] = useState(false)

  // Cube detail data
  const [sampleCustomers, setSampleCustomers] = useState<any[]>([])
  const [setCustomers, setSetCustomers] = useState<any[]>([])
  const [approvalCustomers, setApprovalCustomers] = useState<any[]>([])

  // Fetch counts for all cubes
  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/work-orders?cube=all")
      if (res.ok) {
        const data = await res.json()
        setCounts(data.counts)
        setActiveUpdate(data.activeUpdate)
      }
    } catch {
      // silent
    }
  }, [])

  // Fetch detail data for active cube
  const fetchCubeData = useCallback(async (cube: CubeType) => {
    try {
      const res = await fetch(`/api/work-orders?cube=${cube}`)
      if (res.ok) {
        const data = await res.json()
        if (cube === "samples") {
          setSampleCustomers(data.customers || [])
          setActiveUpdate(data.activeUpdate)
        } else if (cube === "sets") {
          setSetCustomers(data.customers || [])
        } else if (cube === "approval") {
          setApprovalCustomers(data.customers || [])
        }
      }
    } catch {
      toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" })
    }
  }, [toast])

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchCounts()
      await fetchCubeData(activeCube)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When cube changes, fetch its data
  const handleCubeChange = async (cube: CubeType) => {
    setActiveCube(cube)
    router.replace(`/work-orders?cube=${cube}`, { scroll: false })
    await fetchCubeData(cube)
  }

  const handleRefresh = async () => {
    await Promise.all([fetchCounts(), fetchCubeData(activeCube)])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
            רשימת עבודה
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            משימות יומיות: הכנת דגימות, שליחת סטים, אישור לקוחות
          </p>
        </div>
        <Button onClick={() => setNewOrderOpen(true)} className="gap-2 w-full sm:w-auto">
          <UserPlus className="h-4 w-4" />
          הזמנת לקוח חדש
        </Button>
      </div>

      {/* Cube cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TaskCube
          title="הכנת דגימות"
          count={counts.samples.pending}
          icon={Music}
          bgColor="bg-purple-100"
          textColor="text-purple-700"
          active={activeCube === "samples"}
          onClick={() => handleCubeChange("samples")}
          subtitle={activeUpdate ? `עדכון ${activeUpdate.version}` : "אין עדכון פעיל"}
        />
        <TaskCube
          title="לקוחות חדשים"
          count={counts.sets.total}
          icon={Package}
          bgColor="bg-blue-100"
          textColor="text-blue-700"
          active={activeCube === "sets"}
          onClick={() => handleCubeChange("sets")}
        />
        <TaskCube
          title="אישור לקוחות"
          count={counts.approval.total}
          icon={UserCheck}
          bgColor="bg-yellow-100"
          textColor="text-yellow-700"
          active={activeCube === "approval"}
          onClick={() => handleCubeChange("approval")}
        />
      </div>

      {/* Active cube detail */}
      {activeCube === "samples" && (
        <SamplePrepCube
          customers={sampleCustomers}
          activeUpdate={activeUpdate}
          onRefresh={handleRefresh}
        />
      )}
      {activeCube === "sets" && (
        <SetSendingCube
          customers={setCustomers}
          onRefresh={handleRefresh}
        />
      )}
      {activeCube === "approval" && (
        <ApprovalCube
          customers={approvalCustomers}
          onRefresh={handleRefresh}
        />
      )}

      {/* Wizards */}
      <NewOrderWizardDialog
        open={newOrderOpen}
        onOpenChange={setNewOrderOpen}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
