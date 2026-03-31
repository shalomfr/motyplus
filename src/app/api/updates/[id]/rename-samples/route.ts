import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { listFiles, renameFile } from "@/lib/file-storage"
import { addVersionToFilename } from "@/lib/cpi-filename"

// POST /api/updates/[id]/rename-samples — batch rename CPI files to include version
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }

    const { id } = await params
    const update = await prisma.updateVersion.findUnique({
      where: { id },
      select: { version: true },
    })

    if (!update) {
      return NextResponse.json({ error: "עדכון לא נמצא" }, { status: 404 })
    }

    const folder = "updates/samples"
    const files = await listFiles(folder)

    let renamed = 0
    let skipped = 0
    let failed = 0

    for (const file of files) {
      const currentName = file.path.split("/").pop() || ""
      const newName = addVersionToFilename(currentName, update.version)

      if (!newName) {
        // Already has correct version or unparseable
        skipped++
        continue
      }

      try {
        await renameFile(file.id, newName)
        renamed++
      } catch (err) {
        console.error(`Failed to rename ${currentName} → ${newName}:`, err)
        failed++
      }
    }

    return NextResponse.json({ renamed, skipped, failed, total: files.length })
  } catch (error) {
    console.error("Error renaming samples:", error)
    return NextResponse.json(
      { error: "שגיאה בשינוי שמות הקבצים" },
      { status: 500 }
    )
  }
}
