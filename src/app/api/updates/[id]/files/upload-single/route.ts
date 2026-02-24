import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { uploadFileWithPath } from "@/lib/azure-storage";

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

// POST /api/updates/[id]/files/upload-single - העלאה ידנית לשילוב ספציפי
export async function POST(
  request: NextRequest,
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
    });

    if (!updateVersion) {
      return NextResponse.json(
        { error: "העדכון לא נמצא" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const setTypeId = formData.get("setTypeId") as string;
    const organId = formData.get("organId") as string;

    if (!file || !setTypeId || !organId) {
      return NextResponse.json(
        { error: "חסרים נתונים: קובץ, סוג סט ואורגן" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "הקובץ גדול מדי (מקסימום 100MB)" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const blobPath = `updates/${id}/${setTypeId}_${organId}.zip`;
    const fileUrl = await uploadFileWithPath(buffer, blobPath);

    const updateFile = await prisma.updateFile.upsert({
      where: {
        updateVersionId_setTypeId_organId: {
          updateVersionId: id,
          setTypeId,
          organId,
        },
      },
      update: {
        fileUrl,
        fileSize: buffer.length,
        originalPath: file.name,
      },
      create: {
        updateVersionId: id,
        setTypeId,
        organId,
        fileUrl,
        fileSize: buffer.length,
        originalPath: file.name,
      },
      include: {
        setType: { select: { name: true } },
        organ: { select: { name: true } },
      },
    });

    return NextResponse.json({
      message: "הקובץ הועלה בהצלחה",
      file: updateFile,
    });
  } catch (error) {
    console.error("Error uploading single file:", error);
    return NextResponse.json(
      { error: "שגיאה בהעלאת הקובץ" },
      { status: 500 }
    );
  }
}
