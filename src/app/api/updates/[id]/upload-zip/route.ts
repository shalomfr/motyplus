import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { uploadFileWithPath, deleteFilesWithPrefix } from "@/lib/azure-storage";
import { processUpdateZip } from "@/lib/zip-processor";

const MAX_SIZE = 500 * 1024 * 1024; // 500MB

// POST /api/updates/[id]/upload-zip - העלאת ZIP ראשי ועיבודו
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

    if (!file) {
      return NextResponse.json(
        { error: "לא סופק קובץ" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "הקובץ גדול מדי (מקסימום 500MB)" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "zip") {
      return NextResponse.json(
        { error: "יש להעלות קובץ ZIP בלבד" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Delete old files for this update version
    await deleteFilesWithPrefix(`updates/${id}/`);
    await prisma.updateFile.deleteMany({
      where: { updateVersionId: id },
    });

    // Upload master ZIP
    const masterZipPath = `updates/${id}/master.zip`;
    const masterZipUrl = await uploadFileWithPath(buffer, masterZipPath);

    // Process and split into per-combination ZIPs
    const result = await processUpdateZip(buffer, id);

    // Update the master ZIP URL on the version
    await prisma.updateVersion.update({
      where: { id },
      data: { masterZipUrl },
    });

    return NextResponse.json({
      message: `עיבוד הושלם: ${result.matched.length} שילובים נוצרו`,
      masterZipUrl,
      matched: result.matched.map((m) => ({
        setType: m.setTypeName,
        organ: m.organName,
        fileSize: m.fileSize,
        originalPath: m.originalPath,
      })),
      unmatchedFolders: result.unmatchedFolders,
      totalFiles: result.totalFiles,
    });
  } catch (error) {
    console.error("Error processing update ZIP:", error);
    return NextResponse.json(
      { error: "שגיאה בעיבוד קובץ ה-ZIP" },
      { status: 500 }
    );
  }
}
