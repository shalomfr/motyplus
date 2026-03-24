"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw, AlertTriangle, UserPlus, UserCog, Users,
  Mail, Loader2, Tags, Settings, Plus, Send,
  ClipboardList, CheckCircle2, Upload, FileText, ChevronDown, ChevronUp,
  LayoutDashboard
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect } from "react"
import { HeroMusicSpiral3D } from "@/components/ui/HeroMusicSpiral3D"
import { NewOrderWizardDialog } from "@/components/customers/new-order-wizard-dialog"

interface MissingInfoCustomer {
  id: number
  fullName: string
  organName: string
  phone: string
}

export default function HomePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [missingInfo, setMissingInfo] = useState<MissingInfoCustomer[]>([])
  const [missingInfoExpanded, setMissingInfoExpanded] = useState(false)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [heroRevealed, setHeroRevealed] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setHeroRevealed(true), 600)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    fetch("/api/customers/missing-info")
      .then((r) => r.ok ? r.json() : { customers: [] })
      .then((data) => setMissingInfo(data.customers || []))
      .catch(() => {
        toast({
          title: "שגיאה בטעינת לקוחות חסרי אינפו",
          description: "לא ניתן לטעון את הרשימה כרגע",
          variant: "destructive",
        })
      })
  }, [toast])

  const handleUploadInfoFor = (customerId: number) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".n27"
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0]
      if (!file) return
      setUploadingId(customerId)
      try {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch(`/api/customers/${customerId}/upload-info`, { method: "POST", body: fd })
        if (res.ok) {
          toast({ title: "הקובץ הועלה בהצלחה", variant: "success" as "default" })
          setMissingInfo(prev => prev.filter(c => c.id !== customerId))
        } else {
          const data = await res.json()
          toast({ title: "שגיאה", description: data.error, variant: "destructive" })
        }
      } catch { toast({ title: "שגיאה בהעלאה", variant: "destructive" }) }
      finally { setUploadingId(null) }
    }
    input.click()
  }

  const userName = session?.user?.name || "משתמש"

  const quickActions = [
    { label: "לקוח חדש", icon: UserPlus, href: "/customers/new", bg: "bg-green-50 hover:bg-green-100", color: "text-green-600", border: "border-green-200/60" },
    { label: "הזמן לקוח", icon: Send, href: "__invite__", bg: "bg-indigo-50 hover:bg-indigo-100", color: "text-indigo-600", border: "border-indigo-200/60" },
    { label: "רשימת לקוחות", icon: Users, href: "/customers", bg: "bg-sky-50 hover:bg-sky-100", color: "text-sky-600", border: "border-sky-200/60" },
    { label: "שליחת מיילים", icon: Mail, href: "/emails", bg: "bg-pink-50 hover:bg-pink-100", color: "text-pink-600", border: "border-pink-200/60" },
    { label: "עדכונים", icon: RefreshCw, href: "/updates", bg: "bg-orange-50 hover:bg-orange-100", color: "text-orange-600", border: "border-orange-200/60" },
    { label: "מבצעים", icon: Tags, href: "/promotions", bg: "bg-red-50 hover:bg-red-100", color: "text-red-500", border: "border-red-200/60" },
    { label: "לוח בקרה", icon: LayoutDashboard, href: "/dashboard", bg: "bg-cyan-50 hover:bg-cyan-100", color: "text-cyan-600", border: "border-cyan-200/60" },
    { label: "משימות", icon: ClipboardList, href: "/tasks", bg: "bg-amber-50 hover:bg-amber-100", color: "text-amber-600", border: "border-amber-200/60" },
    { label: "הגדרות", icon: Settings, href: "/settings", bg: "bg-gray-50 hover:bg-gray-100", color: "text-gray-500", border: "border-gray-200/60" },
    { label: "צור עדכון", icon: Plus, href: "/updates/wizard", bg: "bg-orange-50 hover:bg-orange-100", color: "text-orange-500", border: "border-orange-200/60" },
  ]

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 min-h-[calc(100vh-64px)]" style={{ background: "linear-gradient(135deg, #0A3D6E 0%, #0F508E 40%, #1A6AB5 100%)" }}>

      {/* Main card: גדול Hero עם וידאו + כפתורים בצד */}
      <div className="mx-auto w-full max-w-[1600px] px-2 sm:px-4 lg:px-6">
        <div className="overflow-hidden rounded-[28px] shadow-2xl sm:rounded-[32px]">

          {/* Hero מלא: וידאו רקע + טקסט + עמודת כפתורים */}
          <div className="relative min-h-[min(88vh,920px)] w-full" style={{ backgroundColor: "#0F508E" }}>
            <HeroMusicSpiral3D variant="hero-cover" />
            {/* קריאות לטקסט בצד ימין (RTL) */}
            <div
              className="pointer-events-none absolute inset-0 z-[1]"
              style={{
                background:
                  "linear-gradient(270deg, rgba(10,40,70,0.72) 0%, rgba(10,40,70,0.35) 42%, rgba(10,40,70,0.08) 72%, transparent 100%)",
              }}
              aria-hidden
            />
            <div className="relative z-[2] flex min-h-[min(88vh,920px)] flex-col lg:grid lg:grid-cols-[1fr_minmax(280px,400px)]">
              <div className="flex flex-1 flex-col justify-center px-6 pb-6 pt-10 sm:px-10 sm:pt-14 lg:px-14 lg:pb-14 lg:ps-16 xl:ps-20">
                {/* רוחב מוגבל + ריווח מקצה ה"סיום" (שמאל ב-RTL) כדי שלא יחפוף את הווידאו */}
                <div className={`w-full max-w-[13.5rem] self-start break-words sm:max-w-[16rem] md:max-w-[18rem] lg:max-w-[20rem] xl:max-w-[22rem] pe-2 sm:pe-4 lg:pe-8 transition-all duration-[2000ms] ease-in-out ${heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                  <h1 className="mb-3 text-4xl font-black leading-[1.15] text-white drop-shadow-md sm:text-5xl lg:text-6xl xl:text-7xl">
                    <span className="block">שלום,</span>
                    <span className="mt-1 block bg-gradient-to-l from-cyan-200 to-white bg-clip-text text-transparent break-words">
                      {userName}
                    </span>
                  </h1>
                  <p className="text-lg font-light leading-snug text-white/85 drop-shadow sm:text-xl">
                    מה נעשה היום?
                  </p>
                </div>
              </div>

              {/* כפתורים על הרקע — פאנל זכוכית בצד (ב־RTL: עמודה שמאלית) */}
              <div className={`flex flex-col justify-center border-t border-white/25 bg-white/35 px-4 py-6 backdrop-blur-xl lg:border-t-0 lg:border-s lg:border-white/40 lg:px-5 lg:py-10 transition-all duration-[2000ms] ease-in-out ${heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                <p className="mb-4 hidden text-center text-xs font-semibold uppercase tracking-wide text-white/70 lg:block">
                  פעולות מהירות
                </p>
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:grid-cols-2 lg:gap-3">
                  {quickActions.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => item.href === "__invite__" ? setInviteOpen(true) : router.push(item.href)}
                        className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/95 px-2 py-4 text-center shadow-md shadow-black/15 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-xl sm:py-5"
                      >
                        <Icon
                          className={`h-7 w-7 shrink-0 sm:h-8 sm:w-8 ${item.color}`}
                          strokeWidth={1.5}
                        />
                        <span className="text-[11px] font-semibold leading-tight text-gray-800 sm:text-xs">
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* גוף לבן — מפריד והתראות */}
          <div className="bg-white">

          {/* Timeline / divider */}
          <div className="px-8 sm:px-12 pb-8">
            <div className="relative flex items-center gap-0">
              <div className="flex-1 h-[2px] bg-gradient-to-l from-[#0F508E] to-transparent rounded-full" />
              <div className="w-3 h-3 rounded-full bg-[#0F508E] shadow-lg shadow-blue-500/30" />
              <div className="flex-1 h-[2px] bg-gradient-to-r from-[#0F508E] to-transparent rounded-full" />
            </div>
          </div>

          {/* Bottom section — alerts */}
          <div className="px-8 sm:px-12 pb-10 space-y-4">
            {/* Update reminder */}
            <div className="flex items-center justify-between p-5 rounded-2xl bg-gray-50/80 border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                  <RefreshCw size={22} className="text-orange-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">לקוחות צריכים עדכון</p>
                  <p className="text-sm text-gray-400">עברה שנה מאז הקנייה — הגיע זמן עדכון</p>
                </div>
              </div>
              <Button onClick={() => router.push("/updates")} className="gradient-accent-btn text-white rounded-xl px-6">
                לרשימת עבודה
              </Button>
            </div>

            {/* Missing info */}
            <div className={`p-5 rounded-2xl border ${missingInfo.length > 0 ? "bg-red-50/50 border-red-200/60" : "bg-green-50/50 border-green-200/60"}`}>
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setMissingInfoExpanded(!missingInfoExpanded)}>
                <h3 className="font-bold text-gray-800 flex items-center gap-3">
                  {missingInfo.length > 0 ? (
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-green-500" /></div>
                  )}
                  לקוחות חסרי אינפו
                  {missingInfo.length > 0 && (
                    <Badge variant="outline" className="bg-red-100 text-red-600 border-red-300">{missingInfo.length}</Badge>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  {missingInfo.length === 0 && <span className="text-sm text-green-600 font-medium">לכל הלקוחות יש אינפו</span>}
                  {missingInfo.length > 0 && (missingInfoExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />)}
                </div>
              </div>
              {missingInfoExpanded && missingInfo.length > 0 && (
                <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                  {missingInfo.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-gray-400">{customer.id}</span>
                        <span className="font-medium truncate">{customer.fullName}</span>
                        <span className="text-xs text-gray-400">{customer.organName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="h-8 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                          onClick={(e) => { e.stopPropagation(); handleUploadInfoFor(customer.id) }} disabled={uploadingId === customer.id}>
                          {uploadingId === customer.id ? <Loader2 className="h-3 w-3 ml-1 animate-spin" /> : <Upload className="h-3 w-3 ml-1" />}
                          העלה אינפו
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); router.push(`/customers/${customer.id}`) }}>
                          <FileText className="h-3 w-3 ml-1" /> פרטים
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      <NewOrderWizardDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}
