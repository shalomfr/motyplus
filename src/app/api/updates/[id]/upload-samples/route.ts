import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadFile, listFiles, deleteFile } from "@/lib/file-storage"

const MAX_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_EXTENSIONS = ["cpi"]

// POST /api/updates/[id]/upload-samples — upload a single CPI file
export async function POST(
  request: NextRequest,
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

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "לא סופק קובץ" }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "הקובץ גדול מדי (מקסימום 50MB)" },
        { status: 400 }
      )
    }

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "סוג קובץ לא מורשה. מותר: .cpi" },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const folder = "updates/samples"

    const path = await uploadFile(buffer, file.name, folder)

    return NextResponse.json({
      path,
      name: file.name,
      size: file.size,
    })
  } catch (error) {
    console.error("Error uploading sample:", error)
    return NextResponse.json(
      { error: "שגיאה בהעלאת הקובץ" },
      { status: 500 }
    )
  }
}

// GET /api/updates/[id]/upload-samples — list CPI files
export async function GET(
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
    const rawFiles = await listFiles(folder)

    const files = rawFiles.map((f) => {
      const name = f.path.split("/").pop() || ""
      const baseName = name.replace(/\.cpi$/i, "")
      const isAdditional = baseName.includes("_")
      const customerId = isAdditional
        ? parseInt(baseName.split("_")[0])
        : parseInt(baseName)

      return {
        path: f.path,
        name,
        size: f.size,
        customerId: isNaN(customerId) ? null : customerId,
        isAdditional,
      }
    })

    // Count unique customers covered
    const customerIds = new Set(
      files.filter((f) => f.customerId !== null).map((f) => f.customerId)
    )

    return NextResponse.json({
      files,
      totalFiles: files.length,
      totalCustomers: customerIds.size,
    })
  } catch (error) {
    console.error("Error listing samples:", error)
    return NextResponse.json(
      { error: "שגיאה בטעינת הקבצים" },
      { status: 500 }
    )
  }
}

// DELETE /api/updates/[id]/upload-samples — delete a CPI file
export async function DELETE(
  request: NextRequest,
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

    const { fileName } = await request.json()
    if (!fileName) {
      return NextResponse.json({ error: "לא סופק שם קובץ" }, { status: 400 })
    }

    const filePath = `updates/samples/${fileName}`
    await deleteFile(filePath)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting sample:", error)
    return NextResponse.json(
      { error: "שגיאה במחיקת הקובץ" },
      { status: 500 }
    )
  }
}

// Route segment config — allow large file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}
