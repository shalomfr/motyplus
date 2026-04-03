"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CheckCircle2,
  XCircle,
  FileCode,
  RefreshCw,
  ExternalLink,
  Loader2,
  GitBranch,
  AlertTriangle,
} from "lucide-react"

interface FixConversation {
  id: string
  status: string
  targetRepo: string | null
  summary: string | null
  issueUrl: string | null
  prUrl: string | null
  previewUrl: string | null
  errorMessage: string | null
  createdAt: string
}

interface DiffFile {
  filename: string
  status: string
  additions: number
  deletions: number
  patch: string
}

interface RepoStatus {
  key: string
  label: string
  stagingRepo: string
  mainRepo: string
  openPRs: number
  pendingFixes: number
  lastCommit: string | null
  aheadBy: number
  behindBy: number
  error?: string
}

const REPO_LABELS: Record<string, string> = {
  motyplus: "CRM",
  "motyplus-order": "טופס הזמנה",
  "motyplus-whatsapp": "וואצאפ",
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  CLARIFYING: { text: "בירור", color: "bg-blue-100 text-blue-700" },
  CONFIRMED: { text: "אושר", color: "bg-indigo-100 text-indigo-700" },
  PROCESSING: { text: "בעבודה", color: "bg-orange-100 text-orange-700" },
  PR_READY: { text: "PR מוכן", color: "bg-purple-100 text-purple-700" },
  PREVIEW_LIVE: { text: "Preview", color: "bg-cyan-100 text-cyan-700" },
  APPROVED: { text: "אושר", color: "bg-green-100 text-green-700" },
  MERGED: { text: "מוזג", color: "bg-green-200 text-green-800" },
  DEPLOYED: { text: "פעיל", color: "bg-green-300 text-green-900" },
  REJECTED: { text: "נדחה", color: "bg-red-100 text-red-700" },
  FAILED: { text: "נכשל", color: "bg-red-100 text-red-700" },
}

export default function FixRequestsAdminPage() {
  const [conversations, setConversations] = useState<FixConversation[]>([])
  const [repoStatuses, setRepoStatuses] = useState<RepoStatus[]>([])
  const [diffDialog, setDiffDialog] = useState<{
    open: boolean
    files: DiffFile[]
    prUrl?: string
    convId?: string
  }>({ open: false, files: [] })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [convsRes, syncRes] = await Promise.all([
        fetch("/api/fix-requests"),
        fetch("/api/fix-requests/admin/sync-status"),
      ])

      if (convsRes.ok) {
        const data = await convsRes.json()
        setConversations(data.conversations)
      }
      if (syncRes.ok) {
        const data = await syncRes.json()
        setRepoStatuses(data.repos)
      }
    } catch (err) {
      console.error("Error fetching admin data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const viewDiff = async (convId: string) => {
    setActionLoading(convId)
    try {
      const res = await fetch(`/api/fix-requests/admin/${convId}/diff`)
      if (res.ok) {
        const data = await res.json()
        setDiffDialog({
          open: true,
          files: data.files,
          prUrl: data.prUrl,
          convId,
        })
      }
    } finally {
      setActionLoading(null)
    }
  }

  const approve = async (convId: string) => {
    if (!confirm("לאשר את השינוי ולמזג ב-staging?")) return
    setActionLoading(convId)
    try {
      await fetch(`/api/fix-requests/admin/${convId}/approve`, {
        method: "POST",
      })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const reject = async (convId: string) => {
    const reason = prompt("סיבת דחייה (אופציונלי):")
    if (reason === null) return
    setActionLoading(convId)
    try {
      await fetch(`/api/fix-requests/admin/${convId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const syncFromMain = async (repoKey: string) => {
    setSyncing(repoKey)
    try {
      await fetch("/api/fix-requests/admin/sync-from-main", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repoKey }),
      })
      setTimeout(fetchData, 3000)
    } finally {
      setSyncing(null)
    }
  }

  const relativeTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `לפני ${mins} דקות`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `לפני ${hours} שעות`
    return `לפני ${Math.floor(hours / 24)} ימים`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-800">לוח בקרה — תיקונים</h1>

      {/* Repo sync status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {repoStatuses.map((repo) => (
          <Card key={repo.key} className="border-[#e8ecf4]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">{repo.label}</h3>
                <GitBranch className="w-4 h-4 text-gray-400" />
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">PRs פתוחים</span>
                  <span className="font-medium">{repo.openPRs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">תיקונים בתהליך</span>
                  <span className="font-medium">{repo.pendingFixes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">commits מקדימים</span>
                  <span
                    className={`font-medium ${
                      repo.aheadBy > 3 ? "text-orange-600" : "text-green-600"
                    }`}
                  >
                    {repo.aheadBy === 0 ? "מסונכרן ✓" : repo.aheadBy}
                  </span>
                </div>
                {repo.lastCommit && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">שינוי אחרון</span>
                    <span className="text-xs text-gray-400">
                      {relativeTime(repo.lastCommit)}
                    </span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3 gap-2"
                onClick={() => syncFromMain(repo.key)}
                disabled={syncing === repo.key}
              >
                {syncing === repo.key ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                סנכרן מהראשי
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conversations table */}
      <Card className="border-[#e8ecf4]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e8ecf4] bg-gray-50/50">
                  <th className="text-right py-3 px-4 font-medium text-gray-500">
                    #
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">
                    תיאור
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">
                    ריפו
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">
                    סטטוס
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">
                    זמן
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody>
                {conversations
                  .filter((c) => c.status !== "CLARIFYING")
                  .map((conv, i) => {
                    const statusCfg = STATUS_LABELS[conv.status] || {
                      text: conv.status,
                      color: "bg-gray-100 text-gray-700",
                    }
                    const isLoading = actionLoading === conv.id
                    const canApprove = ["PR_READY", "PREVIEW_LIVE"].includes(
                      conv.status
                    )
                    const canReject = [
                      "CONFIRMED",
                      "PROCESSING",
                      "PR_READY",
                      "PREVIEW_LIVE",
                    ].includes(conv.status)
                    const hasPR = !!conv.prUrl

                    return (
                      <tr
                        key={conv.id}
                        className="border-b border-[#e8ecf4] hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-400">{i + 1}</td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-800">
                            {conv.summary || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {conv.targetRepo
                              ? REPO_LABELS[conv.targetRepo] || conv.targetRepo
                              : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${statusCfg.color}`}
                          >
                            {statusCfg.text}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-400">
                          {relativeTime(conv.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            {hasPR && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewDiff(conv.id)}
                                disabled={isLoading}
                                title="צפייה ב-diff"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <FileCode className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                            {canApprove && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => approve(conv.id)}
                                disabled={isLoading}
                                className="text-green-600 hover:text-green-700"
                                title="אשר"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canReject && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => reject(conv.id)}
                                disabled={isLoading}
                                className="text-red-600 hover:text-red-700"
                                title="דחה"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {conv.issueUrl && (
                              <a
                                href={conv.issueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="ghost" size="sm" title="Issue">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {conversations.filter((c) => c.status !== "CLARIFYING").length ===
            0 && (
            <div className="text-center py-12 text-gray-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              <p>אין בקשות תיקון עדיין</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diff dialog */}
      <Dialog
        open={diffDialog.open}
        onOpenChange={(open) => setDiffDialog((d) => ({ ...d, open }))}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden" dir="ltr">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" dir="rtl">
              <FileCode className="w-5 h-5" />
              שינויים בקוד
              {diffDialog.prUrl && (
                <a
                  href={diffDialog.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline mr-2"
                >
                  <ExternalLink className="w-3 h-3 inline" /> PR
                </a>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh] space-y-4">
            {diffDialog.files.map((file) => (
              <div key={file.filename} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 flex items-center gap-3 text-sm border-b">
                  <span className="font-mono font-medium">{file.filename}</span>
                  <span className="text-green-600">+{file.additions}</span>
                  <span className="text-red-600">-{file.deletions}</span>
                </div>
                {file.patch && (
                  <pre className="p-4 text-xs overflow-x-auto bg-gray-900 text-gray-100">
                    {file.patch.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.startsWith("+")
                            ? "bg-green-900/30 text-green-300"
                            : line.startsWith("-")
                              ? "bg-red-900/30 text-red-300"
                              : line.startsWith("@@")
                                ? "text-blue-300"
                                : ""
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </pre>
                )}
              </div>
            ))}
          </div>

          {diffDialog.convId && (
            <div className="flex gap-2 justify-end mt-4" dir="rtl">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
                onClick={() => {
                  setDiffDialog((d) => ({ ...d, open: false }))
                  if (diffDialog.convId) approve(diffDialog.convId)
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                אשר
              </Button>
              <Button
                variant="outline"
                className="text-red-600 gap-2"
                onClick={() => {
                  setDiffDialog((d) => ({ ...d, open: false }))
                  if (diffDialog.convId) reject(diffDialog.convId)
                }}
              >
                <XCircle className="w-4 h-4" />
                דחה
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
