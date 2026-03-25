"use client"

import DOMPurify from "dompurify"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye } from "lucide-react"

interface EmailPreviewProps {
  subject: string
  body: string
  recipient?: string
}

export function EmailPreview({ subject, body, recipient }: EmailPreviewProps) {
  const sampleVars: Record<string, string> = {
    customerName: "ישראל ישראלי",
    fullName: "ישראל ישראלי",
    firstName: "ישראל",
    email: "israel@example.com",
    phone: "050-1234567",
    organ: "Genos 2",
    organName: "Genos 2",
    setType: "סט שלם",
    version: "V4.0",
    updateVersion: "V4.0",
    releaseDate: "16/03/2026",
    currentVersion: "V3.0",
    purchaseDate: "01/01/2025",
    updateExpiryDate: "01/01/2026",
    expiryDate: "01/01/2026",
    samplesLink: "https://drive.google.com/samples",
    rhythmsLink: "https://drive.google.com/rhythms",
    driveLink: "https://drive.google.com/preview",
    youtubeLink: "https://youtube.com/preview",
    customLink: "",
    remainingAmount: "350",
    remainingForFullSet: "₪350",
    paymentLink: "https://pay.example.com/link/demo",
    todayDate: new Date().toLocaleDateString("he-IL"),
  }

  const FSI = "\u2068" // First Strong Isolate
  const PDI = "\u2069" // Pop Directional Isolate

  let processedBody = body
  let processedSubject = subject
  for (const [key, val] of Object.entries(sampleVars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g")
    const isolated = `${FSI}${val}${PDI}`
    processedBody = processedBody.replace(regex, isolated)
    processedSubject = processedSubject.replace(regex, isolated)
  }

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
              __html: DOMPurify.sanitize(processedBody || '<p class="text-muted-foreground">(ללא תוכן)</p>'),
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
