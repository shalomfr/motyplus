"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Loader2, Database } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

// ===== Types =====

interface Organ {
  id: string
  name: string
  supportsUpdates: boolean
  sortOrder: number
  isActive: boolean
}

interface SetType {
  id: string
  name: string
  price: number
  includesUpdates: boolean
  sortOrder: number
  isActive: boolean
}

interface UpdateVersion {
  id: string
  version: string
  price: number
  status: string
}

// ===== Organs Tab =====

function OrgansTab() {
  const [organs, setOrgans] = useState<Organ[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingOrgan, setEditingOrgan] = useState<Organ | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState("")
  const [formSupportsUpdates, setFormSupportsUpdates] = useState(false)
  const [formSortOrder, setFormSortOrder] = useState(0)

  const fetchOrgans = useCallback(async () => {
    try {
      const res = await fetch("/api/data/organs")
      if (res.ok) {
        const data = await res.json()
        setOrgans(data.organs || data)
      }
    } catch (err) {
      console.error("Error fetching organs:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrgans()
  }, [fetchOrgans])

  const openCreate = () => {
    setEditingOrgan(null)
    setFormName("")
    setFormSupportsUpdates(false)
    setFormSortOrder(0)
    setShowDialog(true)
  }

  const openEdit = (organ: Organ) => {
    setEditingOrgan(organ)
    setFormName(organ.name)
    setFormSupportsUpdates(organ.supportsUpdates)
    setFormSortOrder(organ.sortOrder)
    setShowDialog(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const url = editingOrgan ? `/api/data/organs/${editingOrgan.id}` : "/api/data/organs"
      const method = editingOrgan ? "PATCH" : "POST"

      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          supportsUpdates: formSupportsUpdates,
          sortOrder: formSortOrder,
        }),
      })

      setShowDialog(false)
      fetchOrgans()
    } catch (err) {
      console.error("Error saving organ:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("האם למחוק את האורגן?")) return
    try {
      await fetch(`/api/data/organs/${id}`, { method: "DELETE" })
      fetchOrgans()
    } catch (err) {
      console.error("Error deleting organ:", err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף אורגן
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>שם</TableHead>
            <TableHead>תומך בעדכונים</TableHead>
            <TableHead>סדר מיון</TableHead>
            <TableHead>סטטוס</TableHead>
            <TableHead className="w-24">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organs.map((organ) => (
            <TableRow key={organ.id}>
              <TableCell className="font-medium">{organ.name}</TableCell>
              <TableCell>
                {organ.supportsUpdates ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">כן</Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-800 border-gray-200">לא</Badge>
                )}
              </TableCell>
              <TableCell>{organ.sortOrder}</TableCell>
              <TableCell>
                {organ.isActive ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">פעיל</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 border-red-200">לא פעיל</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(organ)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(organ.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {organs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">אין אורגנים</div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrgan ? "עריכת אורגן" : "אורגן חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="שם האורגן" />
            </div>
            <div className="space-y-2">
              <Label>סדר מיון</Label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="supportsUpdates"
                checked={formSupportsUpdates}
                onCheckedChange={(checked) => setFormSupportsUpdates(checked === true)}
              />
              <Label htmlFor="supportsUpdates">תומך בעדכונים</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>ביטול</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ===== Sets Tab =====

function SetsTab() {
  const [sets, setSets] = useState<SetType[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingSet, setEditingSet] = useState<SetType | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState("")
  const [formPrice, setFormPrice] = useState(0)
  const [formIncludesUpdates, setFormIncludesUpdates] = useState(false)
  const [formSortOrder, setFormSortOrder] = useState(0)

  const fetchSets = useCallback(async () => {
    try {
      const res = await fetch("/api/data/sets")
      if (res.ok) {
        const data = await res.json()
        setSets(data.sets || data)
      }
    } catch (err) {
      console.error("Error fetching sets:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSets()
  }, [fetchSets])

  const openCreate = () => {
    setEditingSet(null)
    setFormName("")
    setFormPrice(0)
    setFormIncludesUpdates(false)
    setFormSortOrder(0)
    setShowDialog(true)
  }

  const openEdit = (set: SetType) => {
    setEditingSet(set)
    setFormName(set.name)
    setFormPrice(Number(set.price))
    setFormIncludesUpdates(set.includesUpdates)
    setFormSortOrder(set.sortOrder)
    setShowDialog(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const url = editingSet ? `/api/data/sets/${editingSet.id}` : "/api/data/sets"
      const method = editingSet ? "PATCH" : "POST"

      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          price: formPrice,
          includesUpdates: formIncludesUpdates,
          sortOrder: formSortOrder,
        }),
      })

      setShowDialog(false)
      fetchSets()
    } catch (err) {
      console.error("Error saving set:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("האם למחוק את סוג הסט?")) return
    try {
      await fetch(`/api/data/sets/${id}`, { method: "DELETE" })
      fetchSets()
    } catch (err) {
      console.error("Error deleting set:", err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף סט
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>שם</TableHead>
            <TableHead>מחיר</TableHead>
            <TableHead>כולל עדכונים</TableHead>
            <TableHead>סדר מיון</TableHead>
            <TableHead>סטטוס</TableHead>
            <TableHead className="w-24">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sets.map((set) => (
            <TableRow key={set.id}>
              <TableCell className="font-medium">{set.name}</TableCell>
              <TableCell>{formatCurrency(Number(set.price))}</TableCell>
              <TableCell>
                {set.includesUpdates ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">כן</Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-800 border-gray-200">לא</Badge>
                )}
              </TableCell>
              <TableCell>{set.sortOrder}</TableCell>
              <TableCell>
                {set.isActive ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">פעיל</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 border-red-200">לא פעיל</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(set)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(set.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {sets.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">אין סוגי סטים</div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSet ? "עריכת סט" : "סט חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="שם הסט" />
            </div>
            <div className="space-y-2">
              <Label>מחיר</Label>
              <Input
                type="number"
                min={0}
                value={formPrice}
                onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>סדר מיון</Label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="includesUpdates"
                checked={formIncludesUpdates}
                onCheckedChange={(checked) => setFormIncludesUpdates(checked === true)}
              />
              <Label htmlFor="includesUpdates">כולל עדכונים</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>ביטול</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ===== Updates & Prices Tab =====

function UpdatesPricesTab() {
  const [updates, setUpdates] = useState<UpdateVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const res = await fetch("/api/updates")
        if (res.ok) {
          const data = await res.json()
          setUpdates(data.updates || data)
        }
      } catch (err) {
        console.error("Error fetching updates:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchUpdates()
  }, [])

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: "טיוטה",
    PREPARING: "בהכנה",
    READY: "מוכן",
    SENDING: "בשליחה",
    COMPLETED: "הושלם",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>גרסה</TableHead>
            <TableHead>מחיר</TableHead>
            <TableHead>סטטוס</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {updates.map((update) => (
            <TableRow key={update.id}>
              <TableCell className="font-medium">{update.version}</TableCell>
              <TableCell>{formatCurrency(Number(update.price))}</TableCell>
              <TableCell>
                <Badge variant="outline">{STATUS_LABELS[update.status] || update.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {updates.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">אין גרסאות עדכון</div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        * ניהול גרסאות עדכון מתבצע דרך מודול העדכונים
      </p>
    </>
  )
}

// ===== Main Page =====

export default function DataPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-7 w-7 text-gray-600" />
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">ניהול נתונים</h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="organs" dir="rtl">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="organs">אורגנים</TabsTrigger>
              <TabsTrigger value="sets">סטים</TabsTrigger>
              <TabsTrigger value="updates">עדכונים ומחירים</TabsTrigger>
            </TabsList>

            <TabsContent value="organs" className="mt-6">
              <OrgansTab />
            </TabsContent>

            <TabsContent value="sets" className="mt-6">
              <SetsTab />
            </TabsContent>

            <TabsContent value="updates" className="mt-6">
              <UpdatesPricesTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
