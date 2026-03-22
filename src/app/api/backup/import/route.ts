import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { importAllData, BackupData } from "@/lib/backup"

// POST /api/backup/import — שחזור מגיבוי
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }
    if ((session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "פעולה זו מותרת למנהלים בלבד" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 })
    }

    if (!file.name.endsWith(".json")) {
      return NextResponse.json({ error: "הקובץ חייב להיות JSON" }, { status: 400 })
    }

    const text = await file.text()
    let backup: BackupData

    try {
      backup = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "קובץ JSON לא תקין" }, { status: 400 })
    }

    if (!backup.metadata?.version || !backup.data) {
      return NextResponse.json(
        { error: "מבנה קובץ הגיבוי לא תקין — חסר metadata או data" },
        { status: 400 }
      )
    }

    const result = await importAllData(backup)

    return NextResponse.json({
      success: true,
      message: "השחזור הושלם בהצלחה",
      tablesRestored: result.tablesRestored,
      totalRecords: result.totalRecords,
      backupDate: backup.metadata.exportedAt,
    })
  } catch (error) {
    console.error("Backup import error:", error)
    return NextResponse.json(
      { error: `שגיאה בשחזור: ${error instanceof Error ? error.message : "שגיאה לא ידועה"}` },
      { status: 500 }
    )
  }
}
