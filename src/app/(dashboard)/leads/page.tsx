"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LeadPipeline } from "@/components/leads/lead-pipeline"
import { Plus, Loader2, Filter } from "lucide-react"

interface Lead {
  id: string
  fullName: string
  phone: string
  email: string | null
  organInterest: string | null
  source: string | null
  stage: string
  createdAt: string
  assignedAgent?: { name: string } | null
}

interface Agent {
  id: string
  name: string
}

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterAgent, setFilterAgent] = useState<string>("all")
  const [filterDate, setFilterDate] = useState<string>("all")

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterAgent !== "all") params.set("agentId", filterAgent)
      if (filterDate !== "all") params.set("dateRange", filterDate)

      const res = await fetch(`/api/leads?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads || data)
      }
    } catch (err) {
      console.error("Error fetching leads:", err)
    } finally {
      setLoading(false)
    }
  }, [filterAgent, filterDate])

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch("/api/users?role=AGENT")
        if (res.ok) {
          const data = await res.json()
          setAgents(data.users || data)
        }
      } catch (err) {
        console.error("Error fetching agents:", err)
      }
    }
    fetchAgents()
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const handleStageChange = async (leadId: string, newStage: string) => {
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
    )

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      })

      if (!res.ok) {
        // Revert on error
        fetchLeads()
      }
    } catch {
      fetchLeads()
    }
  }

  const activeLostCount = leads.filter((l) => l.stage === "CLOSED_LOST").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">לידים</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {leads.length} לידים | {activeLostCount} אבדו
          </p>
        </div>
        <Button onClick={() => router.push("/leads/new")}>
          <Plus className="h-4 w-4 ml-2" />
          ליד חדש
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterAgent} onValueChange={setFilterAgent}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="סוכן" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוכנים</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDate} onValueChange={setFilterDate}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="תאריך" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הזמנים</SelectItem>
            <SelectItem value="today">היום</SelectItem>
            <SelectItem value="week">השבוע</SelectItem>
            <SelectItem value="month">החודש</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <LeadPipeline leads={leads} onStageChange={handleStageChange} />
      )}
    </div>
  )
}
