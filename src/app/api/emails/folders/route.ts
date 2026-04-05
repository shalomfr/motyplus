import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const DEFAULT_FOLDERS = [
  { key: "update", name: "מעודכנים", color: "blue", iconName: "RefreshCw", order: 0 },
  { key: "not_updated", name: "לא מעודכנים", color: "orange", iconName: "AlertTriangle", order: 1 },
  { key: "half_set", name: "חלקי סט", color: "purple", iconName: "Package", order: 2 },
  { key: "after_purchase", name: "אחרי רכישה", color: "emerald", iconName: "ShoppingBag", order: 3 },
  { key: "welcome", name: "שליחות פרטיות", color: "green", iconName: "UserPlus", order: 4 },
  { key: "promotion", name: "מבצעים והצעות מחיר", color: "orange", iconName: "Percent", order: 5 },
  { key: "greeting", name: "ברכות וחגים", color: "pink", iconName: "Gift", order: 6 },
  { key: "reminder", name: "תזכורות", color: "amber", iconName: "Bell", order: 7 },
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

    // Auto-rename old folder names to new names
    const renames: Record<string, Record<string, string>> = {
      welcome: { "לקוח חדש": "שליחות פרטיות" },
      update: { "מיילים של עדכון": "מעודכנים" },
      half_set: { "חצי סט": "חלקי סט" },
    }
    let needsRefresh = false
    for (const [key, nameMap] of Object.entries(renames)) {
      for (const [oldName, newName] of Object.entries(nameMap)) {
        const folder = folders.find((f) => f.key === key && f.name === oldName)
        if (folder) {
          await prisma.emailFolder.update({ where: { id: folder.id }, data: { name: newName } })
          needsRefresh = true
        }
      }
    }

    // Ensure "לא מעודכנים" and "חלקי סט" folders exist
    const existingKeys = new Set(folders.map((f) => f.key))
    const missingFolders = DEFAULT_FOLDERS.filter((d) => !existingKeys.has(d.key))
    if (missingFolders.length > 0) {
      await prisma.emailFolder.createMany({ data: missingFolders })
      needsRefresh = true
    }

    if (needsRefresh) {
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
