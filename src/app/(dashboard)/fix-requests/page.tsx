"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  MessageCircle,
  Send,
  Clock,
  Loader2,
  GitCommit,
  Rocket,
  CheckCircle2,
  XCircle,
  Plus,
  ExternalLink,
  Image,
  ChevronLeft,
} from "lucide-react"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

interface FixConversation {
  id: string
  status: string
  targetRepo: string | null
  summary: string | null
  issueUrl: string | null
  prUrl: string | null
  previewUrl: string | null
  errorMessage: string | null
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Clock; color: string; bgColor: string; animate?: boolean }
> = {
  CLARIFYING: { label: "בירור", icon: MessageCircle, color: "text-blue-600", bgColor: "bg-blue-100" },
  CONFIRMED: { label: "אושר", icon: CheckCircle2, color: "text-indigo-600", bgColor: "bg-indigo-100" },
  PROCESSING: { label: "בעבודה", icon: Loader2, color: "text-orange-600", bgColor: "bg-orange-100", animate: true },
  PR_READY: { label: "PR מוכן", icon: GitCommit, color: "text-purple-600", bgColor: "bg-purple-100" },
  PREVIEW_LIVE: { label: "Preview", icon: Rocket, color: "text-cyan-600", bgColor: "bg-cyan-100" },
  APPROVED: { label: "אושר", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100" },
  MERGED: { label: "מוזג", icon: CheckCircle2, color: "text-green-700", bgColor: "bg-green-100" },
  DEPLOYED: { label: "פעיל", icon: CheckCircle2, color: "text-green-800", bgColor: "bg-green-200" },
  REJECTED: { label: "נדחה", icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" },
  FAILED: { label: "נכשל", icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" },
}

const PIPELINE_STEPS = [
  { key: "CONFIRMED", label: "אושר" },
  { key: "PROCESSING", label: "בעבודה" },
  { key: "PR_READY", label: "PR" },
  { key: "PREVIEW_LIVE", label: "preview" },
  { key: "DEPLOYED", label: "פעיל" },
]

const PIPELINE_ORDER = PIPELINE_STEPS.map((s) => s.key)

function getStepIndex(status: string): number {
  const idx = PIPELINE_ORDER.indexOf(status)
  if (status === "APPROVED" || status === "MERGED") return PIPELINE_ORDER.indexOf("PREVIEW_LIVE") + 0.5
  return idx === -1 ? -1 : idx
}

const REPO_LABELS: Record<string, string> = {
  motyplus: "CRM",
  "motyplus-order": "טופס הזמנה",
  "motyplus-whatsapp": "וואצאפ",
}

export default function FixRequestsPage() {
  const [conversations, setConversations] = useState<FixConversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [readyToConfirm, setReadyToConfirm] = useState(false)
  const [pastedImage, setPastedImage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selected = conversations.find((c) => c.id === selectedId)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/fix-requests")
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations)
      }
    } catch (err) {
      console.error("Error fetching conversations:", err)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Poll status for active conversations
  useEffect(() => {
    const active = conversations.filter((c) =>
      ["CONFIRMED", "PROCESSING", "PR_READY"].includes(c.status)
    )
    if (active.length === 0) return

    const interval = setInterval(async () => {
      for (const conv of active) {
        try {
          const res = await fetch(`/api/fix-requests/${conv.id}/status`)
          if (res.ok) {
            const updated = await res.json()
            setConversations((prev) =>
              prev.map((c) => (c.id === conv.id ? { ...c, ...updated } : c))
            )
          }
        } catch { /* ignore */ }
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [conversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selected?.messages])

  const createConversation = async () => {
    if (!input.trim() && !pastedImage) return
    setSending(true)
    const msg = input.trim()
    const img = pastedImage
    setInput("")
    setPastedImage(null)
    try {
      // Create empty conversation first
      const res = await fetch("/api/fix-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "_init_" }),
      })
      if (res.ok) {
        const data = await res.json()
        setConversations((prev) => [data.conversation, ...prev])
        setSelectedId(data.conversation.id)
        // Send the real message through chat (which saves + gets AI response)
        await sendChatMessage(data.conversation.id, msg || "צילום מסך מצורף", img)
      }
    } finally {
      setSending(false)
    }
  }

  const sendChatMessage = async (convId: string, message: string, image?: string | null) => {
    setSending(true)
    setReadyToConfirm(false)
    try {
      const res = await fetch(`/api/fix-requests/${convId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, image: image || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.readyToConfirm) setReadyToConfirm(true)
        await fetchConversations()
      }
    } finally {
      setSending(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          setPastedImage(reader.result as string)
        }
        reader.readAsDataURL(file)
        return
      }
    }
  }

  const handleSend = async () => {
    if ((!input.trim() && !pastedImage) || sending) return
    const img = pastedImage
    setPastedImage(null)

    if (!selectedId) {
      await createConversation()
    } else {
      const msg = input.trim() || (img ? "צילום מסך מצורף" : "")
      setInput("")
      await sendChatMessage(selectedId, msg, img)
    }
  }

  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [progressLog, setProgressLog] = useState<string[]>([])

  const addLog = (msg: string) => setProgressLog((prev) => [...prev, `${new Date().toLocaleTimeString("he-IL")} — ${msg}`])

  const handleConfirm = async () => {
    if (!selectedId) return
    setConfirming(true)
    setConfirmError(null)
    setProgressLog([])
    addLog("שולח בקשה...")
    try {
      const res = await fetch(`/api/fix-requests/${selectedId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json()
      if (res.ok) {
        setReadyToConfirm(false)
        addLog(`Issue נוצר ב-GitHub: #${data.issueNumber}`)
        addLog("Claude Code מתחיל לעבוד על התיקון...")
        await fetchConversations()
        // Start polling for status updates
        startStatusPolling(selectedId)
      } else {
        setConfirmError(data.error || "שגיאה באישור הבקשה")
        addLog(`שגיאה: ${data.error || "לא ידוע"}`)
      }
    } catch (err) {
      setConfirmError("שגיאת רשת")
      addLog("שגיאת רשת — נסה שוב")
    } finally {
      setConfirming(false)
    }
  }

  const startStatusPolling = (convId: string) => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/fix-requests/${convId}/status`)
        if (!res.ok) return
        const data = await res.json()

        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, ...data } : c))
        )

        if (data.status === "PROCESSING" && !progressLog.includes("Claude Code עובד...")) {
          addLog("Claude Code עובד על התיקון...")
        }
        if (data.status === "PR_READY") {
          addLog(`PR נוצר: ${data.prUrl || ""}`)
          addLog("ממתין לדיפלוי...")
        }
        if (data.status === "PREVIEW_LIVE") {
          addLog("האתר עלה! אפשר לבדוק.")
          clearInterval(poll)
        }
        if (data.status === "FAILED") {
          addLog(`נכשל: ${data.errorMessage || ""}`)
          clearInterval(poll)
        }
      } catch { /* ignore */ }
    }, 8000)

    // Stop polling after 10 minutes
    setTimeout(() => clearInterval(poll), 600000)
  }

  const startNewChat = () => {
    setSelectedId(null)
    setInput("")
    setReadyToConfirm(false)
  }

  const isActiveChat = selected?.status === "CLARIFYING"
  const showPipeline = selected && selected.status !== "CLARIFYING"

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4" dir="rtl">
      {/* Sidebar — conversation list */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-2">
        <Button onClick={startNewChat} className="w-full gap-2 gradient-blue-btn">
          <Plus className="w-4 h-4" />
          שיחה חדשה
        </Button>

        <div className="flex-1 overflow-y-auto space-y-2">
          {conversations.map((conv) => {
            const statusCfg = STATUS_CONFIG[conv.status] || STATUS_CONFIG.CLARIFYING
            const StatusIcon = statusCfg.icon
            const firstMsg = conv.messages[0]?.content || "שיחה חדשה"
            const isSelected = conv.id === selectedId

            return (
              <Card
                key={conv.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? "ring-2 ring-blue-500 shadow-md" : ""
                }`}
                onClick={() => {
                  setSelectedId(conv.id)
                  setReadyToConfirm(false)
                }}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <div className={`p-1 rounded ${statusCfg.bgColor}`}>
                      <StatusIcon
                        className={`w-3.5 h-3.5 ${statusCfg.color} ${
                          statusCfg.animate ? "animate-spin" : ""
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {firstMsg.slice(0, 50)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        {conv.targetRepo && (
                          <span className="text-xs text-gray-400">
                            {REPO_LABELS[conv.targetRepo] || conv.targetRepo}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-[#e8ecf4] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#e8ecf4] bg-gray-50/50">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-800">
              {selected ? `בקשת תיקון` : "שיחה חדשה"}
            </h2>
            {selected && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  STATUS_CONFIG[selected.status]?.bgColor || "bg-gray-100"
                } ${STATUS_CONFIG[selected.status]?.color || "text-gray-600"}`}
              >
                {STATUS_CONFIG[selected.status]?.label || selected.status}
              </span>
            )}
          </div>
          {selected && (
            <Button variant="ghost" size="sm" onClick={startNewChat}>
              <ChevronLeft className="w-4 h-4 ml-1" />
              חזור
            </Button>
          )}
        </div>

        {/* Pipeline status */}
        {showPipeline && (
          <div className="px-6 py-4 border-b border-[#e8ecf4] bg-gradient-to-l from-blue-50/50 to-white">
            <div className="flex items-center justify-between max-w-lg mx-auto">
              {PIPELINE_STEPS.map((step, i) => {
                const currentIdx = getStepIndex(selected.status)
                const stepIdx = i
                const isDone = stepIdx <= currentIdx
                const isCurrent = Math.floor(currentIdx) === stepIdx
                const isFailed = selected.status === "FAILED" || selected.status === "REJECTED"

                return (
                  <div key={step.key} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isFailed && isCurrent
                            ? "bg-red-500 text-white"
                            : isDone
                              ? "bg-blue-600 text-white"
                              : isCurrent
                                ? "bg-blue-600 text-white animate-pulse"
                                : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {isDone ? "✓" : i + 1}
                      </div>
                      <span className="text-[10px] mt-1 text-gray-500">
                        {step.label}
                      </span>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div
                        className={`w-12 h-0.5 mx-1 ${
                          stepIdx < currentIdx ? "bg-blue-600" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Links */}
            <div className="flex gap-4 mt-3 justify-center">
              {selected.issueUrl && (
                <a
                  href={selected.issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Issue
                </a>
              )}
              {selected.prUrl && (
                <a
                  href={selected.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Pull Request
                </a>
              )}
              {selected.previewUrl && (
                <a
                  href={selected.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 hover:underline flex items-center gap-1 font-bold"
                >
                  <ExternalLink className="w-3 h-3" />
                  פתח את האתר המעודכן
                </a>
              )}
            </div>

            {/* Error message */}
            {selected.errorMessage &&
              (selected.status === "FAILED" ||
                selected.status === "REJECTED") && (
                <div className="mt-2 p-2 bg-red-50 rounded-lg text-sm text-red-700 text-center">
                  {selected.errorMessage}
                </div>
              )}
          </div>
        )}

        {/* Progress log */}
        {progressLog.length > 0 && (
          <div className="px-6 py-3 border-b border-[#e8ecf4] bg-gray-900 text-green-400 font-mono text-xs max-h-40 overflow-y-auto">
            {progressLog.map((log, i) => (
              <div key={i} className="py-0.5">
                {log}
                {i === progressLog.length - 1 && !log.includes("נכשל") && !log.includes("עלה!") && (
                  <span className="inline-block w-2 h-3 bg-green-400 ml-1 animate-pulse" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Confirm error */}
        {confirmError && (
          <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm text-center">
            {confirmError}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!selected && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <MessageCircle className="w-16 h-16 text-gray-200" />
              <p className="text-lg">תאר את התיקון שאתה צריך</p>
              <p className="text-sm">אני אשאל שאלות בירור ואדאג שהכל ברור</p>
            </div>
          )}

          {selected?.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-bl-sm"
                    : "bg-gray-100 text-gray-800 rounded-br-sm"
                }`}
              >
                {msg.content.startsWith("[screenshot:") && (
                  <img
                    src={msg.content.match(/\[screenshot:(.*?)\]/)?.[1] || ""}
                    alt="צילום מסך"
                    className="max-w-full rounded-lg mb-2 cursor-pointer"
                    onClick={(e) => window.open((e.target as HTMLImageElement).src)}
                  />
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content.replace(/\[screenshot:.*?\]\n?/, "")}
                </p>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3 rounded-br-sm">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Confirm button */}
        {readyToConfirm && selected?.status === "CLARIFYING" && (
          <div className="px-6 py-3 border-t border-[#e8ecf4] bg-green-50">
            <Button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3"
            >
              {confirming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              אשר ושלח לתיקון
            </Button>
          </div>
        )}

        {/* Input */}
        {(isActiveChat || !selected) && (
          <div className="px-6 py-4 border-t border-[#e8ecf4]">
            {/* Pasted image preview */}
            {pastedImage && (
              <div className="mb-2 relative inline-block">
                <img
                  src={pastedImage}
                  alt="צילום מסך"
                  className="max-h-32 rounded-lg border border-gray-200"
                />
                <button
                  onClick={() => setPastedImage(null)}
                  className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                onPaste={handlePaste}
                placeholder={pastedImage ? "הוסף תיאור לצילום המסך..." : "כתוב הודעה או הדבק צילום מסך (Ctrl+V)..."}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                dir="rtl"
                disabled={sending}
              />
              <Button
                onClick={handleSend}
                disabled={(!input.trim() && !pastedImage) || sending}
                size="icon"
                className="gradient-blue-btn rounded-xl"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
