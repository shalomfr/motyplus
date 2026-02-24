import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { deleteFile } from "@/lib/azure-storage";

// DELETE /api/updates/[id]/files/[fileId] - מחיקת קובץ עדכון
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { id, fileId } = await params;

    const file = await prisma.updateFile.findFirst({
      where: { id: fileId, updateVersionId: id },
    });

    if (!file) {
      return NextResponse.json(
        { error: "הקובץ לא נמצא" },
        { status: 404 }
      );
    }

    // Delete from Azure Blob Storage
    await deleteFile(file.fileUrl);

    // Delete from database
    await prisma.updateFile.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ message: "הקובץ נמחק בהצלחה" });
  } catch (error) {
    console.error("Error deleting update file:", error);
    return NextResponse.json(
      { error: "שגיאה במחיקת הקובץ" },
      { status: 500 }
    );
  }
}
