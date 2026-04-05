"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Lightbulb,
  ClipboardList,
  Hammer,
  CheckCircle2,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Download,
} from "lucide-react"

interface Task {
  id: number
  title: string
  description: string | null
  status: "IDEA" | "PLANNING" | "IN_PROGRESS" | "DONE"
  priority: "LOW" | "MEDIUM" | "HIGH"
  category: string
  order: number
  createdAt: string
  completedAt: string | null
}

interface TaskCounts {
  IDEA: number
  PLANNING: number
  IN_PROGRESS: number
  DONE: number
  total: number
}

const COLUMNS = [
  { key: "IDEA" as const, label: "רעיון", icon: Lightbulb, color: "bg-amber-500", lightBg: "bg-amber-50 border-amber-200" },
  { key: "PLANNING" as const, label: "תכנון", icon: ClipboardList, color: "bg-orange-500", lightBg: "bg-orange-50 border-blue-200" },
  { key: "IN_PROGRESS" as const, label: "בביצוע", icon: Hammer, color: "bg-orange-500", lightBg: "bg-orange-50 border-blue-200" },
  { key: "DONE" as const, label: "הושלם", icon: CheckCircle2, color: "bg-green-500", lightBg: "bg-green-50 border-green-200" },
]

const CATEGORIES = [
  "דף הבית", "לקוחות", "עדכונים", "מיילים", "לידים",
  "מבצעים", "לוח בקרה", "הגדרות", "נתונים", "כללי",
]

const PRIORITY_CONFIG = {
  HIGH: { label: "גבוהה", icon: ArrowUp, color: "text-red-500" },
  MEDIUM: { label: "בינונית", icon: ArrowRight, color: "text-yellow-500" },
  LOW: { label: "נמוכה", icon: ArrowDown, color: "text-gray-400" },
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [counts, setCounts] = useState<TaskCounts>({ IDEA: 0, PLANNING: 0, IN_PROGRESS: 0, DONE: 0, total: 0 })
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [quickAdd, setQuickAdd] = useState("")
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [menuTaskId, setMenuTaskId] = useState<number | null>(null)
  const [dragTaskId, setDragTaskId] = useState<number | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (filterCategory && filterCategory !== "all") params.set("category", filterCategory)

      const res = await fetch(`/api/tasks?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setTasks(data.tasks)
      setCounts(data.counts)
      setCategories(data.categories)
    } catch (e) {
      console.error("Error fetching tasks:", e)
    } finally {
      setLoading(false)
    }
  }, [search, filterCategory])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuTaskId(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleQuickAdd = async () => {
    if (!quickAdd.trim()) return
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: quickAdd.trim() }),
      })
      if (res.ok) {
        setQuickAdd("")
        fetchTasks()
      }
    } catch (e) {
      console.error("Error adding task:", e)
    }
  }

  const handleUpdateTask = async (id: number, data: Partial<Task>) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        fetchTasks()
        if (editTask?.id === id) setEditTask(null)
      }
    } catch (e) {
      console.error("Error updating task:", e)
    }
  }

  const handleDeleteTask = async (id: number) => {
    if (!confirm("למחוק את המשימה?")) return
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" })
      if (res.ok) {
        setMenuTaskId(null)
        fetchTasks()
      }
    } catch (e) {
      console.error("Error deleting task:", e)
    }
  }

  // Drag & Drop
  const handleDragStart = (taskId: number) => {
    setDragTaskId(taskId)
  }

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    setDragOverColumn(columnKey)
  }

  const handleDrop = async (columnKey: string) => {
    if (!dragTaskId) return
    const task = tasks.find((t) => t.id === dragTaskId)
    if (!task || task.status === columnKey) {
      setDragTaskId(null)
      setDragOverColumn(null)
      return
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === dragTaskId ? { ...t, status: columnKey as Task["status"] } : t
      )
    )

    try {
      await fetch("/api/tasks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: dragTaskId,
          newStatus: columnKey,
          newOrder: task.order,
        }),
      })
      fetchTasks()
    } catch (e) {
      console.error("Error reordering:", e)
      fetchTasks()
    }

    setDragTaskId(null)
    setDragOverColumn(null)
  }

  const totalTasks = counts.IDEA + counts.PLANNING + counts.IN_PROGRESS + counts.DONE
  const donePercent = totalTasks > 0 ? Math.round((counts.DONE / totalTasks) * 100) : 0

  const getColumnTasks = (status: string) =>
    tasks.filter((t) => t.status === status)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }



  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">משימות והתקדמות</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-initial"
            onClick={() => {
              const statusLabels: Record<string, string> = { IDEA: "רעיון", PLANNING: "תכנון", IN_PROGRESS: "בביצוע", DONE: "הושלם" }
              const priorityLabels: Record<string, string> = { HIGH: "גבוהה", MEDIUM: "בינונית", LOW: "נמוכה" }
              const lines = ["# משימות Motty Beats", ""]
              for (const col of COLUMNS) {
                const colTasks = tasks.filter(t => t.status === col.key)
                if (colTasks.length === 0) continue
                lines.push(`## ${col.label} (${colTasks.length})`, "")
                colTasks.forEach((t, i) => {
                  const check = t.status === "DONE" ? "x" : " "
                  lines.push(`${i + 1}. [${check}] **${t.title}** [${t.category}] [${priorityLabels[t.priority]}]`)
                  if (t.description) lines.push(`   ${t.description}`)
                  lines.push("")
                })
              }
              lines.push("---", `סה"כ: ${tasks.length} | הושלם: ${counts.DONE} | ${Math.round((counts.DONE / (counts.IDEA + counts.PLANNING + counts.IN_PROGRESS + counts.DONE || 1)) * 100)}%`)
              const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `tasks-${new Date().toISOString().slice(0, 10)}.md`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <Download className="h-4 w-4 ml-1" />
            ייצוא
          </Button>
          <Button className="flex-1 sm:flex-initial" onClick={() => setEditTask({ id: 0, title: "", description: null, status: "IDEA", priority: "MEDIUM", category: "כללי", order: 0, createdAt: "", completedAt: null })}>
            <Plus className="h-4 w-4 ml-1" />
            משימה חדשה
          </Button>
        </div>
      </div>

      {/* סיכום */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 sm:gap-6 mb-2 text-sm flex-wrap">
            <span className="font-medium">סה&quot;כ: {totalTasks}</span>
            {COLUMNS.map((col) => (
              <span key={col.key} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${col.color}`} />
                {col.label}: {counts[col.key]}
              </span>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${donePercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{donePercent}% הושלם</p>
        </CardContent>
      </Card>

      {/* פילטרים */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש משימות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="קטגוריה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            {(categories.length > 0 ? categories : CATEGORIES).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* קנבן */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:snap-none sm:grid sm:grid-cols-2 xl:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0">
        {COLUMNS.map((col) => {
          const Icon = col.icon
          const columnTasks = getColumnTasks(col.key)
          const isDragOver = dragOverColumn === col.key

          return (
            <div
              key={col.key}
              className={`rounded-xl border-2 transition-colors min-h-[250px] sm:min-h-[300px] flex-shrink-0 w-[75vw] sm:w-auto snap-start ${
                isDragOver ? "border-orange-400 bg-orange-50/50" : "border-white/10 bg-white/5"
              }`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Column header */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${col.lightBg}`}>
                <Icon className="h-4 w-4" />
                <span className="font-semibold text-sm">{col.label}</span>
                <span className="mr-auto bg-white/80 rounded-full px-2 py-0.5 text-xs font-medium">
                  {columnTasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div className="p-2 space-y-2">
                {columnTasks.map((task) => {
                  const PriorityIcon = PRIORITY_CONFIG[task.priority].icon
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      onDragEnd={() => { setDragTaskId(null); setDragOverColumn(null) }}
                      className={`bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative group ${
                        dragTaskId === task.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-gray-300 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium text-gray-800 cursor-pointer hover:text-blue-600 leading-snug"
                            onClick={() => setEditTask(task)}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] bg-gray-100 rounded px-1.5 py-0.5 text-gray-500">
                              {task.category}
                            </span>
                            <PriorityIcon className={`h-3 w-3 ${PRIORITY_CONFIG[task.priority].color}`} />
                          </div>
                        </div>
                        <div className="relative" ref={menuTaskId === task.id ? menuRef : undefined}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setMenuTaskId(menuTaskId === task.id ? null : task.id) }}
                            className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-400" />
                          </button>
                          {menuTaskId === task.id && (
                            <div className="absolute left-0 top-8 bg-white rounded-lg shadow-lg border py-1 z-10 min-w-[120px]">
                              <button
                                onClick={() => { setEditTask(task); setMenuTaskId(null) }}
                                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-white/5"
                              >
                                עריכה
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                                מחיקה
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {columnTasks.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-8">
                    אין משימות
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick add */}
      <div className="flex gap-2">
        <Input
          placeholder="הוסף רעיון מהיר..."
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
          className="flex-1"
        />
        <Button onClick={handleQuickAdd} disabled={!quickAdd.trim()}>
          <Plus className="h-4 w-4 ml-1" />
          הוסף
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask?.id === 0 ? "משימה חדשה" : "עריכת משימה"}</DialogTitle>
          </DialogHeader>
          {editTask && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">שם המשימה</label>
                <Input
                  value={editTask.title}
                  onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                  placeholder="מה צריך לעשות?"
                />
              </div>
              <div>
                <label className="text-sm font-medium">תיאור</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[80px] resize-y"
                  value={editTask.description || ""}
                  onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
                  placeholder="פרטים נוספים..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">סטטוס</label>
                  <Select
                    value={editTask.status}
                    onValueChange={(v) => setEditTask({ ...editTask, status: v as Task["status"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">עדיפות</label>
                  <Select
                    value={editTask.priority}
                    onValueChange={(v) => setEditTask({ ...editTask, priority: v as Task["priority"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">גבוהה</SelectItem>
                      <SelectItem value="MEDIUM">בינונית</SelectItem>
                      <SelectItem value="LOW">נמוכה</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">קטגוריה</label>
                <Select
                  value={editTask.category}
                  onValueChange={(v) => setEditTask({ ...editTask, category: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditTask(null)}>ביטול</Button>
                <Button
                  onClick={async () => {
                    if (!editTask.title.trim()) return
                    if (editTask.id === 0) {
                      // New task
                      const res = await fetch("/api/tasks", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: editTask.title,
                          description: editTask.description,
                          status: editTask.status,
                          priority: editTask.priority,
                          category: editTask.category,
                        }),
                      })
                      if (res.ok) {
                        setEditTask(null)
                        fetchTasks()
                      }
                    } else {
                      handleUpdateTask(editTask.id, {
                        title: editTask.title,
                        description: editTask.description,
                        status: editTask.status,
                        priority: editTask.priority,
                        category: editTask.category,
                      })
                    }
                  }}
                >
                  שמור
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
