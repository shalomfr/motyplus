"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, Check, Send, Loader2, FileCheck, FileX } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkListCustomer {
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
  hasUpdateFile?: boolean
}

interface WorkListTableProps {
  updateId: string
  customers: WorkListCustomer[]
  organs: { id: string; name: string }[]
  onRefresh: () => void
}

export function WorkListTable({ updateId, customers, organs, onRefresh }: WorkListTableProps) {
  const [organFilter, setOrganFilter] = useState<string>("all")
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set())
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [sendingIds, setSendingIds] = useState<Set<number>>(new Set())

  const filteredCustomers = organFilter === "all"
    ? customers
    : customers.filter((c) => c.organ.id === organFilter)

  const handleCopyId = async (customerId: number) => {
    await navigator.clipboard.writeText(String(customerId))
    setCopiedId(customerId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleMarkReady = async (customerId: number, field: "infoUploaded" | "samplesReady", value: boolean) => {
    setLoadingIds((prev) => new Set(prev).add(customerId))
    try {
      await fetch(`/api/updates/${updateId}/work/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      onRefresh()
    } catch (err) {
      console.error("Error updating work status:", err)
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(customerId)
        return next
      })
    }
  }

  const handleSendUpdate = async (customerId: number) => {
    setSendingIds((prev) => new Set(prev).add(customerId))
    try {
      await fetch(`/api/updates/${updateId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: [customerId] }),
      })
      onRefresh()
    } catch (err) {
      console.error("Error sending update:", err)
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev)
        next.delete(customerId)
        return next
      })
    }
  }

  const groupedByOrgan = filteredCustomers.reduce<Record<string, WorkListCustomer[]>>((acc, customer) => {
    const organName = customer.organ.name
    if (!acc[organName]) acc[organName] = []
    acc[organName].push(customer)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-48">
          <Select value={organFilter} onValueChange={setOrganFilter}>
            <SelectTrigger>
              <SelectValue placeholder="סנן לפי אורגן" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל האורגנים</SelectItem>
              {organs.map((organ) => (
                <SelectItem key={organ.id} value={organ.id}>
                  {organ.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {filteredCustomers.length} לקוחות זכאים
        </p>
      </div>

      {Object.entries(groupedByOrgan).map(([organName, organCustomers]) => (
        <div key={organName} className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
            <Badge variant="outline">{organName}</Badge>
            <span>({organCustomers.length})</span>
          </h3>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">מזהה</TableHead>
                  <TableHead>שם</TableHead>
                  <TableHead>אורגן</TableHead>
                  <TableHead className="w-20">קובץ זמין</TableHead>
                  <TableHead className="w-24">מידע הועלה</TableHead>
                  <TableHead className="w-24">דגימות מוכנות</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead className="w-32">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organCustomers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className={cn(
                      customer.sent && "bg-green-50"
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{customer.id}</span>
                        <button
                          onClick={() => handleCopyId(customer.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="העתק מזהה"
                        >
                          {copiedId === customer.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{customer.fullName}</TableCell>
                    <TableCell>{customer.organ.name}</TableCell>
                    <TableCell>
                      {customer.hasUpdateFile ? (
                        <FileCheck className="h-4 w-4 text-green-500" />
                      ) : (
                        <FileX className="h-4 w-4 text-red-400" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={customer.infoUploaded}
                        onCheckedChange={(checked) =>
                          handleMarkReady(customer.id, "infoUploaded", checked === true)
                        }
                        disabled={loadingIds.has(customer.id) || customer.sent}
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={customer.samplesReady}
                        onCheckedChange={(checked) =>
                          handleMarkReady(customer.id, "samplesReady", checked === true)
                        }
                        disabled={loadingIds.has(customer.id) || customer.sent}
                      />
                    </TableCell>
                    <TableCell>
                      {customer.sent ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">נשלח</Badge>
                      ) : customer.infoUploaded && customer.samplesReady ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">מוכן</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 border-gray-200">בהכנה</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!customer.sent && (
                        <Button
                          size="sm"
                          onClick={() => handleSendUpdate(customer.id)}
                          disabled={!customer.infoUploaded || !customer.samplesReady || sendingIds.has(customer.id)}
                        >
                          {sendingIds.has(customer.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin ml-1" />
                          ) : (
                            <Send className="h-3 w-3 ml-1" />
                          )}
                          שלח עדכון
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {filteredCustomers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          אין לקוחות זכאים לעדכון זה
        </div>
      )}
    </div>
  )
}
