"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
import {
  Copy,
  Check,
  FileCheck,
  FileX,
  RefreshCw,
  Download,
  Loader2,
  Music,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CpiCustomer {
  id: number
  fullName: string
  organ: { id: string; name: string }
  hasUpdateFile?: boolean
}

interface CpiPrepCardProps {
  customers: CpiCustomer[]
  organs: { id: string; name: string }[]
  version: string
  onRefresh: () => void
}

export function CpiPrepCard({ customers, organs, version, onRefresh }: CpiPrepCardProps) {
  const [organFilter, setOrganFilter] = useState<string>("all")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [hideReady, setHideReady] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // סינון
  let filtered = organFilter === "all"
    ? customers
    : customers.filter((c) => c.organ.id === organFilter)

  if (hideReady) {
    filtered = filtered.filter((c) => !c.hasUpdateFile)
  }

  // מיון: חסרי CPI קודם, אח"כ מוכנים
  filtered = [...filtered].sort((a, b) => {
    if (a.hasUpdateFile === b.hasUpdateFile) return 0
    return a.hasUpdateFile ? 1 : -1
  })

  // מונים
  const totalEligible = customers.length
  const withCpi = customers.filter((c) => c.hasUpdateFile).length
  const withoutCpi = totalEligible - withCpi

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(key)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSync = async () => {
    setSyncing(true)
    await onRefresh()
    // Small delay to show the sync animation
    setTimeout(() => setSyncing(false), 500)
  }

  const handleExportCsv = () => {
    const rows = filtered.map((c) => ({
      id: c.id,
      name: c.fullName,
      organ: c.organ.name,
      fullId: `${c.id}_${version}`,
      hasCpi: c.hasUpdateFile ? "כן" : "לא",
    }))

    const header = "מזהה,שם,אורגן,מזהה מלא,CPI קיים"
    const csvRows = rows.map((r) =>
      `${r.id},"${r.name}","${r.organ}",${r.fullId},${r.hasCpi}`
    )
    const csv = "\uFEFF" + [header, ...csvRows].join("\n") // BOM for Hebrew in Excel

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cpi-list-${version}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Music className="h-5 w-5" />
            הכנת דגימות לעדכון {version}
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              {withoutCpi} חסרי CPI
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {withCpi} מוכנים
            </Badge>
            <Badge variant="outline">
              {totalEligible} סה&quot;כ
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
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

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={hideReady}
                onCheckedChange={(checked) => setHideReady(checked === true)}
              />
              <span className="text-sm">הצג רק חסרי CPI</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="gap-1"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              סנכרן עם Drive
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1"
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" />
              ייצוא CSV
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {filtered.length} לקוחות מוצגים
        </p>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {hideReady && withCpi === totalEligible
              ? "כל הלקוחות כבר מוכנים! אין חסרי CPI."
              : "אין לקוחות להצגה"
            }
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">מזהה</TableHead>
                  <TableHead>שם</TableHead>
                  <TableHead>אורגן</TableHead>
                  <TableHead className="w-16 text-center">CPI</TableHead>
                  <TableHead className="w-28">העתק מזהה</TableHead>
                  <TableHead className="w-36">העתק מזהה מלא</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((customer) => {
                  const fullId = `${customer.id}_${version}`
                  return (
                    <TableRow
                      key={customer.id}
                      className={cn(
                        customer.hasUpdateFile && "bg-green-50"
                      )}
                    >
                      <TableCell className="font-mono text-sm">
                        {customer.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {customer.fullName}
                      </TableCell>
                      <TableCell>{customer.organ.name}</TableCell>
                      <TableCell className="text-center">
                        {customer.hasUpdateFile ? (
                          <FileCheck className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <FileX className="h-4 w-4 text-red-400 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleCopy(String(customer.id), `id-${customer.id}`)}
                        >
                          {copiedId === `id-${customer.id}` ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {customer.id}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs font-mono"
                          onClick={() => handleCopy(fullId, `full-${customer.id}`)}
                        >
                          {copiedId === `full-${customer.id}` ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {fullId}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
