import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const DEFAULT_FOLDERS = [
  { key: "update", name: "מיילים של עדכון", color: "blue", iconName: "RefreshCw", order: 0 },
  { key: "after_purchase", name: "אחרי רכישה", color: "emerald", iconName: "ShoppingBag", order: 1 },
  { key: "welcome", name: "שליחות פרטיות", color: "green", iconName: "UserPlus", order: 2 },
  { key: "promotion", name: "מבצעים והצעות מחיר", color: "orange", iconName: "Percent", order: 3 },
  { key: "greeting", name: "ברכות וחגים", color: "pink", iconName: "Gift", order: 4 },
  { key: "reminder", name: "תזכורות", color: "amber", iconName: "Bell", order: 5 },
]

// GET — fetch all folders, auto-seed defaults if empty
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    let folders = await prisma.emailFolder.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { templates: true } } },
    })

    // Auto-rename: "לקוח חדש" → "שליחות פרטיות"
    const welcomeFolder = folders.find((f) => f.key === "welcome" && f.name === "לקוח חדש")
    if (welcomeFolder) {
      await prisma.emailFolder.update({
        where: { id: welcomeFolder.id },
        data: { name: "שליחות פרטיות" },
      })
      folders = await prisma.emailFolder.findMany({
        orderBy: { order: "asc" },
        include: { _count: { select: { templates: true } } },
      })
    }

    // Seed defaults if no folders exist
    if (folders.length === 0) {
      await prisma.emailFolder.createMany({ data: DEFAULT_FOLDERS })

      // Migrate existing templates: match category → folder
      const allFolders = await prisma.emailFolder.findMany()
      for (const folder of allFolders) {
        await prisma.emailTemplate.updateMany({
          where: { category: folder.key, folderId: null },
          data: { folderId: folder.id },
        })
      }
      // Also map "general" → "greeting"
      const greetingFolder = allFolders.find((f) => f.key === "greeting")
      if (greetingFolder) {
        await prisma.emailTemplate.updateMany({
          where: { category: "general", folderId: null },
          data: { folderId: greetingFolder.id },
        })
      }

      folders = await prisma.emailFolder.findMany({
        orderBy: { order: "asc" },
        include: { _count: { select: { templates: true } } },
      })
    }

    return NextResponse.json(folders)
  } catch (error) {
    console.error("Error fetching folders:", error)
    return NextResponse.json({ error: "שגיאה בטעינת תיקיות" }, { status: 500 })
  }
}

// POST — create new folder
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, color = "gray", iconName = "FolderOpen" } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "יש להזין שם תיקייה" }, { status: 400 })
    }

    // Generate a unique key from name
    const key = `custom_${Date.now()}`

    // Get max order
    const maxOrder = await prisma.emailFolder.aggregate({ _max: { order: true } })
    const order = (maxOrder._max.order ?? -1) + 1

    const folder = await prisma.emailFolder.create({
      data: { name: name.trim(), key, color, iconName, order },
    })

    return NextResponse.json(folder, { status: 201 })
  } catch (error) {
    console.error("Error creating folder:", error)
    return NextResponse.json({ error: "שגיאה ביצירת תיקייה" }, { status: 500 })
  }
}
