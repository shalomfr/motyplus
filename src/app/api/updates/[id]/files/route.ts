import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/updates/[id]/files - רשימת קבצי עדכון (מטריצה)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const updateVersion = await prisma.updateVersion.findUnique({
      where: { id },
      select: { id: true, version: true, masterZipUrl: true },
    });

    if (!updateVersion) {
      return NextResponse.json(
        { error: "העדכון לא נמצא" },
        { status: 404 }
      );
    }

    const files = await prisma.updateFile.findMany({
      where: { updateVersionId: id },
      include: {
        setType: { select: { id: true, name: true, folderAlias: true } },
        organ: { select: { id: true, name: true, folderAlias: true } },
      },
      orderBy: [
        { setType: { sortOrder: "asc" } },
        { organ: { sortOrder: "asc" } },
      ],
    });

    // Also return all active set types and organs for matrix display
    const setTypes = await prisma.setType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, folderAlias: true },
    });

    const organs = await prisma.organ.findMany({
      where: { supportsUpdates: true, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, folderAlias: true },
    });

    return NextResponse.json({
      files,
      setTypes,
      organs,
      masterZipUrl: updateVersion.masterZipUrl,
    });
  } catch (error) {
    console.error("Error fetching update files:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת קבצי העדכון" },
      { status: 500 }
    );
  }
}
