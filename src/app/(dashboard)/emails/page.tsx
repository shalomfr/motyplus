"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Mail, Send } from "lucide-react"

export default function EmailsPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">מיילים</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto pt-8">
        <Card
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-blue-300"
          onClick={() => router.push("/emails/templates")}
        >
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-blue-100 rounded-2xl">
              <Mail className="h-10 w-10 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold">תבניות מייל</h3>
              <p className="text-sm text-muted-foreground mt-2">
                ניהול תבניות, תיקיות, ייבוא וייצוא
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-green-300"
          onClick={() => router.push("/emails/sending")}
        >
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-green-100 rounded-2xl">
              <Send className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold">שליחת מיילים</h3>
              <p className="text-sm text-muted-foreground mt-2">
                שליחת עדכונים, מיילים קבוצתיים ומותאמים
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
