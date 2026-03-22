import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// PATCH — update folder name/color/icon
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, color, iconName } = body

    const folder = await prisma.emailFolder.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(iconName !== undefined && { iconName }),
      },
    })

    return NextResponse.json(folder)
  } catch (error) {
    console.error("Error updating folder:", error)
    return NextResponse.json({ error: "שגיאה בעדכון תיקייה" }, { status: 500 })
  }
}

// DELETE — delete folder (templates become uncategorized)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Unlink templates from this folder
    await prisma.emailTemplate.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    })

    await prisma.emailFolder.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting folder:", error)
    return NextResponse.json({ error: "שגיאה במחיקת תיקייה" }, { status: 500 })
  }
}
