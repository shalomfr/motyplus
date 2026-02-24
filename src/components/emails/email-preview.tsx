"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye } from "lucide-react"

interface EmailPreviewProps {
  subject: string
  body: string
  recipient?: string
}

export function EmailPreview({ subject, body, recipient }: EmailPreviewProps) {
  const processedBody = body
    .replace(/\{\{customerName\}\}/g, "ישראל ישראלי")
    .replace(/\{\{customerEmail\}\}/g, "israel@example.com")
    .replace(/\{\{customerPhone\}\}/g, "050-1234567")
    .replace(/\{\{organName\}\}/g, "אורגן לדוגמה")
    .replace(/\{\{version\}\}/g, "V4.0")
    .replace(/\{\{downloadLink\}\}/g, "https://example.com/download")
    .replace(/\{\{purchaseDate\}\}/g, "01/01/2025")
    .replace(/\{\{expiryDate\}\}/g, "01/01/2026")
    .replace(/\{\{couponCode\}\}/g, "DEMO10")
    .replace(/\{\{discountPercent\}\}/g, "10")

  const processedSubject = subject
    .replace(/\{\{customerName\}\}/g, "ישראל ישראלי")
    .replace(/\{\{version\}\}/g, "V4.0")
    .replace(/\{\{organName\}\}/g, "אורגן לדוגמה")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Eye className="h-5 w-5" />
          תצוגה מקדימה
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          {/* Email header */}
          <div className="bg-muted/50 p-4 border-b space-y-2 text-sm">
            {recipient && (
              <div className="flex gap-2">
                <span className="text-muted-foreground font-medium">אל:</span>
                <span dir="ltr">{recipient}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-muted-foreground font-medium">נושא:</span>
              <span>{processedSubject || "(ללא נושא)"}</span>
            </div>
          </div>

          {/* Email body */}
          <div
            className="p-4 min-h-[200px] text-sm"
            dir="rtl"
            dangerouslySetInnerHTML={{
              __html: processedBody || '<p class="text-muted-foreground">(ללא תוכן)</p>',
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          * התצוגה המקדימה מציגה נתוני דוגמה במקום המשתנים הדינמיים
        </p>
      </CardContent>
    </Card>
  )
}
