"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Mail, User } from "lucide-react"

interface SampleCustomer {
  id: number
  fullName: string
  email: string
  organ: string
  setType: string
}

interface EmailPreviewSheetProps {
  open: boolean
  onClose: () => void
  segmentLabel: string
  segmentColor: string
  subject: string
  body: string
  sampleCustomers: SampleCustomer[]
}

export function EmailPreviewSheet({
  open,
  onClose,
  segmentLabel,
  subject,
  body,
  sampleCustomers,
}: EmailPreviewSheetProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            תצוגת מייל — {segmentLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email Preview */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 p-3 border-b text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground font-medium">נושא:</span>
                <span>{subject || "(ללא נושא)"}</span>
              </div>
            </div>
            <div
              className="p-4 min-h-[200px] text-sm"
              dir="rtl"
              dangerouslySetInnerHTML={{
                __html: body || '<p class="text-muted-foreground">(התבנית לא נמצאה)</p>',
              }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            * התצוגה מציגה נתוני דוגמה. בשליחה בפועל — המשתנים יוחלפו בנתוני הלקוח האמיתיים.
          </p>

          {/* Sample Customers */}
          {sampleCustomers.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4" />
                לקוחות לדוגמה מסגמנט זה
              </h4>
              <div className="space-y-1.5">
                {sampleCustomers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 text-sm bg-muted/30 rounded-lg px-3 py-2"
                  >
                    <span className="font-medium">{c.fullName}</span>
                    <span className="text-muted-foreground" dir="ltr">{c.email}</span>
                    <Badge variant="outline" className="text-xs mr-auto">{c.organ}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
