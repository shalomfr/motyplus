"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailInput } from "@/components/ui/email-input"
import { Label } from "@/components/ui/label"
import { Loader2, Send, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface InviteCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteCustomerDialog({ open, onOpenChange }: InviteCustomerDialogProps) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const canSend = name.trim().length >= 2 && email.includes("@")

  const handleSend = async () => {
    if (!canSend) return
    setIsSending(true)
    try {
      const res = await fetch("/api/public/invite-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "שגיאה", description: data.error, variant: "destructive" })
        return
      }
      setSent(true)
      toast({ title: "ההזמנה נשלחה בהצלחה", variant: "success" as "default" })
    } catch {
      toast({ title: "שגיאה בשליחה", variant: "destructive" })
    } finally {
      setIsSending(false)
    }
  }

  const handleClose = (val: boolean) => {
    if (!val) {
      setName("")
      setEmail("")
      setSent(false)
    }
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>הזמן לקוח</DialogTitle>
          <DialogDescription>
            שלח ללקוח קישור לטופס ההזמנה והתשלום
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="bg-green-100 rounded-full p-3">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <p className="text-center font-medium text-gray-700">
              ההזמנה נשלחה ל-{email}
            </p>
            <Button variant="outline" onClick={() => handleClose(false)}>
              סגור
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="invite-name">שם הלקוח</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="שם מלא"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="invite-email">כתובת מייל</Label>
                <EmailInput
                  id="invite-email"
                  value={email}
                  onValueChange={(val) => setEmail(val)}
                  placeholder="email@example.com"
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSend}
                disabled={!canSend || isSending}
                className="w-full"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    שולח...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 ml-2" />
                    שלח הזמנה
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
