import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { exportAllData } from "@/lib/backup"
import { prisma } from "@/lib/prisma"

// GET /api/backup/export — ייצוא גיבוי מלא של מסד הנתונים
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }

    const backup = await exportAllData()

    // Save last backup date
    await prisma.systemSetting.upsert({
      where: { key: "lastBackupDate" },
      update: { value: new Date().toISOString() },
      create: { key: "lastBackupDate", value: new Date().toISOString() },
    })

    const date = new Date().toISOString().slice(0, 10)
    const json = JSON.stringify(backup, null, 2)

    return new Response(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="motyplus-backup-${date}.json"`,
      },
    })
  } catch (error) {
    console.error("Backup export error:", error)
    return NextResponse.json(
      { error: "שגיאה ביצירת גיבוי" },
      { status: 500 }
    )
  }
}
